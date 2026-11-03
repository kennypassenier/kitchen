//! The collections the pages' local database syncs (feat-db-sync-1, Kenny 03/11/2026 06:12 "Nu ook de pagina's") and
//! the feed's view of their current bodies.
//!
//! Every list is a collection of the same name, keyed by `id` with revision `rev`, written through its existing
//! routes (`/data/<list>`, `/data/<list>/:id`). A dish carries its recipes, so the dish is the synced unit and its
//! `rev` covers them ("Binnen het gerecht"). The settings are a collection of one item, [`SETTINGS_KEY`], whose `rev`
//! is `settings_rev` ("Behouden"), at `/data/settings/:id`. Every collection is shared: Kitchen has one household.
//!
//! The indexes are the fields the pages filter and sort on (`web/js`: categories, the dish and shelf a log line or a
//! freezer item points at, dates, a draft's key, a category's order); they only travel in the manifest.

use std::collections::HashMap;

use chassis::Error;
use chassis::storage::rusqlite::Connection;
use chassis::storage::sync::{SyncCollection, SyncLoad};
use serde_json::{Map, Value};

use super::super::data::COLLECTIONS;
use super::rows;

/// The name of the settings' collection.
pub const SETTINGS_COLLECTION: &str = "settings";
/// The key of the one settings item.
pub const SETTINGS_KEY: &str = "kitchen";

/// The fields each list is indexed on for the pages' local queries.
const INDEXES: &[(&str, &[&str])] = &[
    ("freezer", &["dish_id", "frozen_on"]),
    ("shelf", &["energy"]),
    ("log", &["dish_id", "shelf_id", "date"]),
    ("resting", &["dish_id", "until"]),
    ("dishes", &["category"]),
    ("dish_categories", &["order"]),
    ("ingredients", &["category"]),
    ("ingredient_categories", &["order"]),
    ("drafts", &["key"]),
    ("recipe_sources", &["language"]),
];

/// Every collection: one per list, then the settings.
pub fn collections() -> Vec<SyncCollection> {
    let lists = COLLECTIONS.iter().map(|&list| {
        let indexes = INDEXES
            .iter()
            .find(|(l, _)| *l == list)
            .map_or(&[][..], |(_, i)| i);
        indexes
            .iter()
            .fold(SyncCollection::new(list), |c, i| c.index(i))
            .routes(&format!("/data/{list}"), &format!("/data/{list}/:id"))
            .shared()
    });
    let settings = SyncCollection::new(SETTINGS_COLLECTION)
        .routes("/data/settings", "/data/settings/:id")
        .shared();
    lists.chain([settings]).collect()
}

/// The settings as the one item of their collection: `{id, rev, ..keys}`. The keys are Kitchen's fixed settings,
/// none of which is `id` or `rev`.
pub fn settings_item(settings: &Map<String, Value>, rev: u64) -> Value {
    let mut item = settings.clone();
    item.insert("id".into(), Value::String(SETTINGS_KEY.into()));
    item.insert("rev".into(), Value::from(rev));
    Value::Object(item)
}

/// The feed's loader: the current body of each key, read from the database in the feed's own snapshot, exactly as
/// `GET /data/<list>/<id>` answers it.
#[derive(Debug, Clone, Copy)]
pub struct KitchenLoad;

impl SyncLoad for KitchenLoad {
    fn load(
        &self,
        conn: &Connection,
        collection: &str,
        keys: &[String],
    ) -> Result<HashMap<String, Value>, Error> {
        let mut out = HashMap::new();
        if collection == SETTINGS_COLLECTION {
            if keys.iter().any(|k| k == SETTINGS_KEY) {
                let (settings, rev) = rows::load_settings(conn)?;
                out.insert(SETTINGS_KEY.to_string(), settings_item(&settings, rev));
            }
            return Ok(out);
        }
        if !COLLECTIONS.contains(&collection) {
            return Err(Error::invalid(
                format!("the feed asked for {collection:?}, which Kitchen does not keep"),
                "declare it in store/db/sync.rs or stop asking for it",
            ));
        }
        for key in keys {
            if let Some(item) = rows::load_item(conn, collection, key)? {
                out.insert(key.clone(), item);
            }
        }
        Ok(out)
    }
}
