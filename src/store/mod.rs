//! The kitchen's data: the store port the routes and the parents' wheel call, kept in the app database `kitchen.db`.
//!
//! Everything kitchen knows is small (tens of recipes, a freezer, a shelf, a log), so the store keeps the whole
//! kitchen in memory and its domain rules work on that copy, exactly as when it lived in `kitchen.json`. Since
//! feat-db-store-1 (Kenny's rule 02/11/2026 21:01, answers of 03/11/2026 06:12) every change is persisted as rows of
//! `kitchen.db` instead of a rewrite of the file: [`db::plan`] turns the before/after difference into row operations
//! and change-log entries (`tx.sync_upsert` / `tx.sync_delete`), written in ONE transaction; a failed write puts the
//! memory back, so memory never claims more than the database holds. `kitchen.json` is imported once (`db/import`).
//!
//! The kit opens the database only when the service starts (`App::run`), after the routes are declared, so the store
//! is made with the unopened handle and filled by [`Store::load`] from the start hook (`boot.rs`); until then
//! [`Store::is_ready`] is false and the routes answer 503.
//!
//! The collections are documented field by field in `docs/agent/DATA.md`. The
//! server checks only what it must to stay consistent (an object, an `id`
//! it issued, a known collection); the shape of a recipe belongs to the
//! pages, so the screens can grow without a server change.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

use chassis::storage::AppDb;
use serde_json::Value;
use tokio::sync::RwLock;

mod caps;
mod data;
pub mod db;
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
#[cfg(test)]
pub use seed::seed;

pub struct Store {
    /// The app database; `None` only for a store that is never written (tests).
    db: Option<AppDb>,
    /// Where the photo files live (`<state dir>/photos`); none for an in-memory store.
    photos: Option<PathBuf>,
    data: RwLock<Data>,
    /// Whether the store holds the kitchen and may answer ([`Store::open_for_requests`]); the routes answer 503 before.
    ready: AtomicBool,
    /// What was deleted lately, so Undo can put it back (undo.rs).
    removed: undo::Removals,
    /// Photo ids that dropped out of a dish, swept once their undo window closed (photo_gc.rs).
    dropped: photo_gc::Dropped,
}

impl Store {
    /// The store over the app database `db` (opened later by the kit), with the photos in `dir`/photos. Empty and
    /// not ready until [`Store::load`].
    pub fn new(db: AppDb, dir: &Path) -> Self {
        Self::build(Some(db), Some(dir.join("photos")), Data::empty(), false)
    }

    /// A kitchen that is never written, for tests.
    #[cfg(test)]
    pub fn in_memory(data: Data) -> Self {
        Self::build(None, None, data, true)
    }

    /// A store over an open database, loaded and ready, for tests of the persistence.
    #[cfg(test)]
    pub async fn on_db(db: AppDb) -> Result<Self, String> {
        let s = Self::build(Some(db), None, Data::empty(), false);
        s.load().await?;
        s.open_for_requests();
        Ok(s)
    }

    fn build(db: Option<AppDb>, photos: Option<PathBuf>, data: Data, ready: bool) -> Self {
        Self {
            db,
            photos,
            data: RwLock::new(data),
            ready: AtomicBool::new(ready),
            removed: undo::Removals::default(),
            dropped: photo_gc::Dropped::default(),
        }
    }

    /// Read the whole kitchen from the database into memory. Called once the kit opened the database and the import
    /// is done; the store still answers 503 until [`Store::open_for_requests`], so the start-up clean-ups run first.
    pub async fn load(&self) -> Result<(), String> {
        let Some(db) = self.db.clone() else {
            return Ok(());
        };
        let loaded = db
            .read(db::rows::load_data)
            .await
            .map_err(|e| format!("cannot read the kitchen from kitchen.db: {e}"))?;
        *self.data.write().await = loaded;
        Ok(())
    }

    /// Let the routes in: from now on [`Store::is_ready`] is true.
    pub fn open_for_requests(&self) {
        self.ready.store(true, Ordering::Release);
    }

    /// Whether the store holds the kitchen and may answer.
    pub fn is_ready(&self) -> bool {
        self.ready.load(Ordering::Acquire)
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

    /// Apply a change and persist it: the difference goes to the database with its change-log entries in one
    /// transaction; on a failed write the change is undone, so memory never claims more than the database holds.
    async fn change<T>(
        &self,
        f: impl FnOnce(&mut Data) -> Result<T, Refused>,
    ) -> Result<T, Refused> {
        let mut d = self.data.write().await;
        let before = d.clone();
        let out = f(&mut d)?;
        if let Some(db) = &self.db {
            let ops = db::plan::plan(&before, &d);
            if !ops.is_empty()
                && let Err(e) = db.write(move |tx| db::plan::apply(tx, &ops)).await
            {
                *d = before;
                return Err(Refused::Disk(e.to_string()));
            }
        }
        Ok(out)
    }
}

#[cfg(test)]
mod tests;
