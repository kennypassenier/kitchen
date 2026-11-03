use serde_json::Map;

use super::drafts::rfc3339_at;
use super::migrate::{migrate, to_2, to_3};
use super::*;

mod crud;
mod db_store;
mod db_sync;
mod idempotent;
mod limits;
mod migrate;
mod photo_gc;
mod photo_orphans;
mod rev;
mod rev_delete_settings;
mod undo;
mod validate;

pub(super) fn empty() -> Data {
    Data {
        format: FORMAT,
        recipes: vec![],
        freezer: vec![],
        shelf: vec![],
        log: vec![],
        resting: vec![],
        dishes: vec![],
        dish_parts: vec![],
        dish_categories: vec![],
        ingredients: vec![],
        ingredient_categories: vec![],
        drafts: vec![],
        recipe_sources: None,
        settings: Map::new(),
        settings_rev: 0,
        answered: vec![],
    }
}

/// A store over an in-memory `kitchen.db` holding `data` (written the way the import writes it), loaded and open,
/// with the database handle for looking at the rows and the change log (feat-db-store-1).
pub(super) async fn db_store(data: Data) -> (Store, chassis::storage::AppDb) {
    use chassis::storage::{AppDb, AppDbSpec};
    let db = AppDb::open_in_memory(AppDbSpec::new(db::migrations()), Vec::new()).unwrap();
    db.write_blocking(|tx| db::plan::apply(tx, &db::plan::plan_all(&data)))
        .unwrap();
    let s = Store::on_db(db.clone()).await.unwrap();
    (s, db)
}

/// `kitchen.db` in `dir`, opened the way the service opens it: migrations and the one-time import of a
/// `kitchen.json` in the same directory.
pub(super) fn file_db(dir: &std::path::Path) -> chassis::storage::AppDb {
    chassis::storage::AppDb::open(&dir.join("kitchen.db"), db::app_db_spec(), Vec::new()).unwrap()
}
