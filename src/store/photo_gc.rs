//! Photo files nobody refers to any more. A photo is a file next to `kitchen.json` (see `photos/`), referred to by id from
//! a recipe (`photo`, a step's `photos`) or a draft's form. Two ways a file loses its last reference:
//!
//! - a draft is discarded or pruned: its own photos go at once ([`Store::release_photos`]);
//! - a dish is saved without some of its photos (a recipe deleted through the dish, a step or photo removed) or the dish
//!   is deleted (fix-undo-photos-1, 02/11/2026). Undo can still put those back for [`UNDO_KEEP`], so the ids are noted
//!   ([`Dropped`]) and the sweep ([`Store::sweep_photos`], every [`SWEEP_EVERY`]) deletes them once that window closed.
//!   The page deletes them itself after its 10 s Undo too; the sweep is what stays when the page was reloaded or closed
//!   before that. Noted ids live in memory; a restart drops them, and the start-up sweep (photo_orphans.rs,
//!   fix-photo-orphans-1) deletes those files instead.
//!
//! Either way a file is deleted only when nothing refers to it: no dish, no draft and no deleted item still in its undo
//! window. A copy of a recipe shares its photo ids, so the copy keeps the file.

use std::collections::HashSet;
use std::time::{Duration, Instant};

use serde_json::Value;

use super::Store;
use super::undo::UNDO_KEEP;

/// How often the sweep looks for noted photos whose undo window closed.
pub const SWEEP_EVERY: Duration = Duration::from_secs(30);

/// Every photo id a value refers to: a `photo` string or a `photos` list of strings, at any depth.
pub(super) fn photo_ids(v: &Value, out: &mut HashSet<String>) {
    match v {
        Value::Object(o) => {
            for (k, v) in o {
                match (k.as_str(), v) {
                    ("photo", Value::String(id)) => {
                        out.insert(id.clone());
                    }
                    ("photos", Value::Array(a)) => {
                        out.extend(a.iter().filter_map(Value::as_str).map(String::from));
                    }
                    _ => photo_ids(v, out),
                }
            }
        }
        Value::Array(a) => a.iter().for_each(|v| photo_ids(v, out)),
        _ => {}
    }
}

/// The photo ids of one value.
pub(super) fn photo_ids_of(v: &Value) -> HashSet<String> {
    let mut out = HashSet::new();
    photo_ids(v, &mut out);
    out
}

/// The photo ids `old` refers to and `new` no longer does.
pub(super) fn dropped_photos(old: &Value, new: &Value) -> HashSet<String> {
    let now = photo_ids_of(new);
    photo_ids_of(old)
        .into_iter()
        .filter(|id| !now.contains(id))
        .collect()
}

/// Photo ids that dropped out of the kitchen, with when, waiting for their undo window to close.
#[derive(Debug, Default)]
pub(super) struct Dropped(std::sync::Mutex<Vec<(HashSet<String>, Instant)>>);

impl Dropped {
    /// Note ids that dropped out at `now`.
    pub(super) fn note(&self, ids: HashSet<String>, now: Instant) {
        if ids.is_empty() {
            return;
        }
        self.lock().push((ids, now));
    }

    /// Take out the ids whose window closed by `now`.
    fn due(&self, now: Instant) -> HashSet<String> {
        let mut all = self.lock();
        let (due, wait): (Vec<_>, Vec<_>) = std::mem::take(&mut *all)
            .into_iter()
            .partition(|(_, when)| now.duration_since(*when) >= UNDO_KEEP);
        *all = wait;
        due.into_iter().flat_map(|(ids, _)| ids).collect()
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Vec<(HashSet<String>, Instant)>> {
        self.0
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }
}

impl Store {
    /// Delete the noted photos whose undo window closed and that nothing refers to; the rest wait or stay.
    pub async fn sweep_photos(&self) {
        self.sweep_photos_at(Instant::now()).await;
    }

    pub(super) async fn sweep_photos_at(&self, now: Instant) {
        let due = self.dropped.due(now);
        self.remove_unreferenced(due, now).await;
    }

    /// Delete the photo files the removed `drafts` refer to, except those anything else still refers to.
    pub(super) async fn release_photos(&self, drafts: &[Value]) {
        let mut wanted = HashSet::new();
        drafts.iter().for_each(|v| photo_ids(v, &mut wanted));
        self.remove_unreferenced(wanted, Instant::now()).await;
    }

    /// Delete the files of `wanted` that no dish, no draft and no deleted item still in its undo window refers to.
    async fn remove_unreferenced(&self, wanted: HashSet<String>, now: Instant) {
        let Some(dir) = self.photos.clone() else {
            return;
        };
        if wanted.is_empty() {
            return;
        }
        let mut kept = HashSet::new();
        {
            let d = self.data.read().await;
            d.dishes.iter().for_each(|v| photo_ids(v, &mut kept));
            d.drafts.iter().for_each(|v| photo_ids(v, &mut kept));
        }
        self.removed.photo_ids_open(now, &mut kept);
        let done = tokio::task::spawn_blocking(move || {
            for id in wanted.difference(&kept) {
                if crate::photos::valid_id(id) {
                    remove_photo(&dir, id);
                }
            }
        })
        .await;
        if let Err(e) = done {
            tracing::warn!(error = %e, "photo files nobody refers to were not cleaned up");
        }
    }
}

/// Delete the files of photo `id`; a failure is logged (the file stays as an orphan: harmless, but not unseen).
fn remove_photo(dir: &std::path::Path, id: &str) {
    if let Err(e) = crate::photos::remove_files(dir, id) {
        tracing::warn!(photo = id, error = %e, "a photo nobody refers to could not be deleted");
    }
}
