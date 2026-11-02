//! The kitchen's data: one JSON file under the state directory.
//!
//! Everything kitchen knows is small (tens of recipes, a freezer, a shelf,
//! a log), so it lives in memory and is written whole after every change,
//! temp + fsync + rename through the kit's `write_atomic`: a crash leaves the
//! old file or the new one, never half of either. The file is plain JSON on
//! purpose: it is the backup, and a person can read it.
//!
//! The collections are documented field by field in `docs/agent/DATA.md`. The
//! server checks only what it must to stay consistent (an object, an `id`
//! it issued, a known collection); the shape of a recipe belongs to the
//! pages, so the screens can grow without a server change.

use std::path::{Path, PathBuf};

use serde_json::Value;
use tokio::sync::RwLock;

mod caps;
mod data;
mod drafts;
mod idempotent;
mod limits;
mod migrate;
mod ops;
mod photo_gc;
mod photo_orphans;
mod seed;
mod settings;
mod undo;
mod validate;

use data::FORMAT;
pub use data::{Data, Refused};
pub use drafts::DRAFT_DAYS;
pub use idempotent::Answered;
pub use migrate::migrate;
pub(crate) use ops::rev_of;
pub use photo_gc::SWEEP_EVERY;
pub use photo_orphans::{ORPHAN_MIN_AGE, OrphanSweep};
pub use seed::seed;
use seed::sources_seed;

pub struct Store {
    path: PathBuf,
    /// Where the photo files live (`<state dir>/photos`); none for an in-memory store.
    photos: Option<PathBuf>,
    data: RwLock<Data>,
    /// What was deleted lately, so Undo can put it back (undo.rs).
    removed: undo::Removals,
    /// Photo ids that dropped out of a dish, swept once their undo window closed (photo_gc.rs).
    dropped: photo_gc::Dropped,
}

impl Store {
    /// Open the kitchen in `dir`, seeding it on the very first start.
    pub fn open(dir: &Path) -> Result<Self, String> {
        let path = dir.join("kitchen.json");
        let data = match std::fs::read(&path) {
            Ok(bytes) => {
                let mut data: Data = serde_json::from_slice(&bytes)
                    .map_err(|e| format!("{} is not a kitchen file: {e}", path.display()))?;
                if data.format > FORMAT {
                    return Err(format!(
                        "{} was written by a newer kitchen (format {}); this one reads format {FORMAT}",
                        path.display(),
                        data.format
                    ));
                }
                if data.format < FORMAT {
                    migrate(&mut data);
                    write(&path, &data)?;
                }
                if data.recipe_sources.is_none() {
                    data.recipe_sources = Some(sources_seed());
                    write(&path, &data)?;
                }
                data
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                let data = seed();
                write(&path, &data)?;
                data
            }
            Err(e) => return Err(format!("cannot read {}: {e}", path.display())),
        };
        Ok(Self {
            path,
            photos: Some(dir.join("photos")),
            data: RwLock::new(data),
            removed: undo::Removals::default(),
            dropped: photo_gc::Dropped::default(),
        })
    }

    /// An empty kitchen that is never written, for tests.
    #[cfg(test)]
    pub fn in_memory(data: Data) -> Self {
        Self {
            path: PathBuf::new(),
            photos: None,
            data: RwLock::new(data),
            removed: undo::Removals::default(),
            dropped: photo_gc::Dropped::default(),
        }
    }

    pub async fn snapshot(&self) -> Data {
        self.data.read().await.clone()
    }

    pub async fn list(&self, coll: &str) -> Result<Vec<Value>, Refused> {
        let mut d = self.data.write().await;
        d.collection(coll)
            .map(|c| c.clone())
            .ok_or_else(|| Refused::UnknownCollection(coll.into()))
    }

    /// One item of a list by its id (feat-offline-recipe: `GET /data/{list}/{id}`, so the offline copy can keep a
    /// single dish). An unknown list is `UnknownCollection`, an id the list does not hold is `NotFound`.
    pub async fn item(&self, coll: &str, id: &str) -> Result<Value, Refused> {
        let mut d = self.data.write().await;
        let list = d
            .collection(coll)
            .ok_or_else(|| Refused::UnknownCollection(coll.into()))?;
        list.iter()
            .find(|x| x.get("id").and_then(Value::as_str) == Some(id))
            .cloned()
            .ok_or(Refused::NotFound)
    }

    /// Apply a change and save it; on a failed save the change is undone,
    /// so memory never claims more than the disk holds.
    async fn change<T>(
        &self,
        f: impl FnOnce(&mut Data) -> Result<T, Refused>,
    ) -> Result<T, Refused> {
        let mut d = self.data.write().await;
        let before = d.clone();
        let out = f(&mut d)?;
        if !self.path.as_os_str().is_empty()
            && let Err(e) = write(&self.path, &d)
        {
            *d = before;
            return Err(Refused::Disk(e));
        }
        Ok(out)
    }
}

fn write(path: &Path, data: &Data) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(data).map_err(|e| e.to_string())?;
    chassis::shell::store::write_atomic(path, &bytes, "the kitchen file").map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests;
