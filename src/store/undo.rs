//! Undo of a delete (Kenny, 01/11/2026 20:21, "Ongedaan maken"): a restorable item goes at once and the page offers
//! Undo for 10 s. The server keeps what it removed, with its place in the list, for [`UNDO_KEEP`]; a restore within
//! that time puts back exactly those bytes at that place, under the same `id`, so everything that points at the item
//! (a log line at a dish, a dish at a category) finds it again. After that, or after a restart, the item is gone for
//! good. Keeping the removed item on the server (instead of letting the page send it back) means a restore can never
//! store anything that was not there, and needs no validation: an item saved before a rule came in comes back as it was.

use std::time::{Duration, Instant};

use serde_json::Value;

use super::{Refused, Store};

/// How long a removed item can be put back. Longer than the page's 10 s Undo window, so a slow connection or a paused
/// toast (the kit stops its clock under the pointer) still finds it; short, so memory never holds much.
pub(super) const UNDO_KEEP: Duration = Duration::from_secs(120);

/// One removed item: its list, its place in that list and when it went.
#[derive(Debug, Clone)]
pub(super) struct Removed {
    coll: String,
    at: usize,
    item: Value,
    when: Instant,
}

/// The removed items still in their undo window, newest last.
#[derive(Debug, Default)]
pub(super) struct Removals(std::sync::Mutex<Vec<Removed>>);

impl Removals {
    /// Remember a removed item; drops those whose window closed.
    pub(super) fn keep(&self, coll: &str, at: usize, item: Value, now: Instant) {
        let mut all = self
            .0
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        all.retain(|r| now.duration_since(r.when) < UNDO_KEEP);
        all.push(Removed {
            coll: coll.into(),
            at,
            item,
            when: now,
        });
    }

    /// Add the photo ids of the removed items whose window is still open at `now` (Undo may still put them back).
    pub(super) fn photo_ids_open(&self, now: Instant, out: &mut std::collections::HashSet<String>) {
        let all = self
            .0
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        all.iter()
            .filter(|r| now.duration_since(r.when) < UNDO_KEEP)
            .for_each(|r| super::photo_gc::photo_ids(&r.item, out));
    }

    /// Take the removed item `id` of `coll` out, if its window is still open.
    pub(super) fn take(&self, coll: &str, id: &str, now: Instant) -> Option<Removed> {
        let mut all = self
            .0
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        all.retain(|r| now.duration_since(r.when) < UNDO_KEEP);
        let at = all.iter().rposition(|r| {
            r.coll == coll && r.item.get("id").and_then(Value::as_str) == Some(id)
        })?;
        Some(all.remove(at))
    }
}

impl Store {
    /// Put a removed item back at its place, as it was. Refused when the window closed ([`Refused::UndoClosed`]) or
    /// when an item with that id is there again ([`Refused::Exists`]).
    pub async fn restore(&self, coll: &str, id: &str) -> Result<Value, Refused> {
        self.restore_at(coll, id, Instant::now()).await
    }

    pub(super) async fn restore_at(
        &self,
        coll: &str,
        id: &str,
        now: Instant,
    ) -> Result<Value, Refused> {
        let gone = self
            .removed
            .take(coll, id, now)
            .ok_or(Refused::UndoClosed)?;
        let back = gone.clone();
        let out = self
            .change(|d| {
                let c = d
                    .collection(coll)
                    .ok_or_else(|| Refused::UnknownCollection(coll.into()))?;
                if c.iter()
                    .any(|v| v.get("id").and_then(Value::as_str) == Some(id))
                {
                    return Err(Refused::Exists);
                }
                c.insert(back.at.min(c.len()), back.item.clone());
                Ok(back.item)
            })
            .await;
        if matches!(out, Err(Refused::Disk(_))) {
            // Not saved: the item stays restorable for the rest of its window.
            self.removed.keep(coll, gone.at, gone.item, gone.when);
        }
        out
    }
}
