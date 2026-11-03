//! Photo files nothing refers to, swept once when the kitchen starts (fix-photo-orphans-1, 02/11/2026).
//!
//! The undo-window sweep (photo_gc.rs) keeps the ids it is waiting on in memory, so a restart inside Undo's 120 s window
//! left those files behind; so did a photo uploaded in a tab that closed before its draft was written. Persisting the
//! pending ids would cover only the first case and adds a file to keep in step; this sweep covers both: at start no item
//! can be restored any more (Undo lives in memory too), so a photo file that no item of the kitchen refers to (a dish,
//! its recipes and steps, a draft, any collection, at any depth) is an orphan. Claude's choice, reversible.
//!
//! An upload in flight is never removed: only files last written more than [`ORPHAN_MIN_AGE`] ago are swept (an editor
//! writes its draft about a second after a photo lands). Only files named `<uuid>.jpg|webp` are looked at; anything else
//! in the folder stays. Each file that cannot be deleted is logged and counted, never skipped silently.

use std::collections::HashSet;
use std::path::Path;
use std::time::{Duration, SystemTime};

use super::Store;
use super::photo_gc::photo_ids;

/// How old an unreferenced photo file must be before the start-up sweep deletes it, so an upload whose draft is not
/// written yet is never taken (Claude's number, reversible).
pub const ORPHAN_MIN_AGE: Duration = Duration::from_secs(10 * 60);

/// What the start-up sweep did: files deleted, and files it meant to delete but could not (each one logged).
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct OrphanSweep {
    pub removed: usize,
    pub failed: usize,
}

impl Store {
    /// Delete the photo files nothing refers to and that are older than [`ORPHAN_MIN_AGE`]. Runs when the kitchen starts;
    /// answers what it did, or why the photos folder could not be read (then every file stays).
    pub async fn sweep_orphan_photos(&self) -> Result<OrphanSweep, String> {
        self.sweep_orphans_at(SystemTime::now()).await
    }

    pub(super) async fn sweep_orphans_at(&self, now: SystemTime) -> Result<OrphanSweep, String> {
        let Some(dir) = self.photos.clone() else {
            return Ok(OrphanSweep::default());
        };
        let kept = self.referenced_photos().await?;
        tokio::task::spawn_blocking(move || sweep_dir(&dir, &kept, now))
            .await
            .map_err(|e| format!("the photo sweep stopped: {e}"))?
    }

    /// Every photo id anything stored refers to (the whole kitchen, at any depth), plus those of deleted items still in
    /// their undo window (none right after a start, but the sweep stays right if it ever runs later). When the kitchen
    /// cannot be read as JSON (not expected: it is written that way) nothing is swept.
    async fn referenced_photos(&self) -> Result<HashSet<String>, String> {
        let all = serde_json::to_value(&*self.data.read().await)
            .map_err(|e| format!("the kitchen could not be read for the photo sweep: {e}"))?;
        let mut kept = HashSet::new();
        photo_ids(&all, &mut kept);
        self.removed
            .photo_ids_open(std::time::Instant::now(), &mut kept);
        Ok(kept)
    }
}

/// Delete the old `<uuid>.<ext>` files of `dir` whose id is not in `kept`. A missing folder is an empty one.
fn sweep_dir(dir: &Path, kept: &HashSet<String>, now: SystemTime) -> Result<OrphanSweep, String> {
    let mut done = OrphanSweep::default();
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(done),
        Err(e) => return Err(format!("cannot read {}: {e}", dir.display())),
    };
    for entry in entries {
        let path = match entry {
            Ok(entry) => entry.path(),
            Err(e) => {
                tracing::warn!(error = %e, "a photo file could not be looked at; it stays");
                done.failed += 1;
                continue;
            }
        };
        if let Some(id) = orphan_id(&path, kept, now) {
            match std::fs::remove_file(&path) {
                Ok(()) => done.removed += 1,
                Err(e) => {
                    tracing::warn!(photo = id, error = %e, "an orphan photo file could not be deleted");
                    done.failed += 1;
                }
            }
        }
    }
    Ok(done)
}

/// The photo id of `path` when it is an orphan: a `<uuid>.jpg|webp` file nothing refers to, last written at least
/// [`ORPHAN_MIN_AGE`] before `now`. A time that cannot be read, or lies in the future, counts as fresh: the file stays.
fn orphan_id(path: &Path, kept: &HashSet<String>, now: SystemTime) -> Option<String> {
    let id = path.file_stem()?.to_str()?;
    let ext = path.extension()?.to_str()?;
    let photo =
        crate::photos::valid_id(id) && crate::photos::Kind::ALL.iter().any(|k| k.ext() == ext);
    if !photo || kept.contains(id) {
        return None;
    }
    let written = std::fs::metadata(path).and_then(|m| m.modified()).ok()?;
    let age = now.duration_since(written).ok()?;
    (age >= ORPHAN_MIN_AGE).then(|| id.to_string())
}
