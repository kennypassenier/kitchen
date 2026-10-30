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

use serde_json::{Map, Value};
use tokio::sync::RwLock;

mod data;
mod drafts;
mod migrate;
mod ops;
mod seed;
mod validate;

use data::FORMAT;
pub use data::{Data, Refused};
pub use drafts::DRAFT_DAYS;
pub use migrate::migrate;
pub use seed::seed;
use seed::sources_seed;

pub struct Store {
    path: PathBuf,
    /// Where the photo files live (`<state dir>/photos`); none for an in-memory store.
    photos: Option<PathBuf>,
    data: RwLock<Data>,
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
        })
    }

    /// An empty kitchen that is never written, for tests.
    #[cfg(test)]
    pub fn in_memory(data: Data) -> Self {
        Self {
            path: PathBuf::new(),
            photos: None,
            data: RwLock::new(data),
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

    pub async fn settings(&self) -> Map<String, Value> {
        self.data.read().await.settings.clone()
    }

    /// Merge the given keys into the settings; a `null` removes a key.
    pub async fn merge_settings(&self, body: Value) -> Result<Map<String, Value>, Refused> {
        let Value::Object(patch) = body else {
            return Err(Refused::NotAnObject);
        };
        self.change(|d| {
            for (k, v) in &patch {
                if v.is_null() {
                    d.settings.remove(k);
                } else {
                    d.settings.insert(k.clone(), v.clone());
                }
            }
            Ok(d.settings.clone())
        })
        .await
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
