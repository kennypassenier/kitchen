//! The one-time import of `kitchen.json` into `kitchen.db` (feat-db-import-1, Kenny 03/11/2026 06:12 "Geen
//! terugval"). The kit runs [`run`] once, after the migrations, inside ONE transaction (`AppDbSpec::with_import`):
//!
//! 1. `kitchen.json` is copied to `kitchen.json.pre-db` before anything else (`backup.rs`);
//! 2. the file is parsed as any FORMAT 5 kitchen, whichever version wrote it (4.1.0, 5.0.0, 6.0.0): every list and
//!    field that version did not know is absent and defaults, an older format is lifted by `migrate`, a file without
//!    recipe sources gets the verified sites, and an item without a `rev` gets `"rev": 0` ("Behouden");
//! 3. every list, the settings with their revision and the answered take keys are written, each item with its
//!    change-log entry;
//! 4. everything is read back in the same transaction and compared value for value with step 2 (`verify.rs`);
//! 5. the per-list counts go to the kit, which checks them, commits and only then renames the file
//!    `kitchen.json.migrated`.
//!
//! Any failure rolls the whole transaction back: the database stays empty, `kitchen.json` stays where it was, and the
//! service refuses to start with the reason (`boot.rs`). With no `kitchen.json` at all (a new kitchen) the seed is
//! written instead and nothing is renamed.

use chassis::Error;
use chassis::storage::rusqlite::Transaction;
use chassis::storage::{ImportContext, ImportReport, ImportStore};
use serde_json::Value;

use super::super::data::{COLLECTIONS, FORMAT};
use super::super::seed::{seed, sources_seed};
use super::super::{Data, migrate};
use super::{plan, rows};

pub mod backup;
pub mod verify;

/// The file the kitchen lived in before the database.
pub const FILE: &str = "kitchen.json";

/// The import hook handed to `AppDbSpec::with_import`.
pub fn run(tx: &Transaction, ctx: &ImportContext) -> Result<ImportReport, Error> {
    let path = ctx.json_path(FILE);
    backup::keep_first_copy(&path)?;
    let (data, files) = match ctx.read_json::<Data>(FILE)? {
        Some(parsed) => (normalize(parsed)?, vec![path]),
        None => (seed(), Vec::new()),
    };
    plan::apply(tx, &plan::plan_all(&data))?;
    verify::same(&rows::load_data(tx)?, &data)?;
    report(tx, &data, files)
}

/// The file's kitchen as the database will hold it: refused when a newer Kitchen wrote it, lifted when an older
/// format, filled where a version did not know a part yet.
pub fn normalize(mut data: Data) -> Result<Data, Error> {
    if data.format > FORMAT {
        return Err(Error::config(
            format!(
                "kitchen.json was written by a newer Kitchen (format {}); this one reads format {FORMAT}",
                data.format
            ),
            "install the Kitchen version that wrote it; nothing was imported",
        ));
    }
    if data.format < FORMAT {
        migrate(&mut data);
    }
    if data.recipe_sources.is_none() {
        data.recipe_sources = Some(sources_seed());
    }
    for list in COLLECTIONS {
        if let Some(items) = data.collection(list) {
            items.iter_mut().for_each(zero_rev);
        }
    }
    Ok(data)
}

/// "absent → 0 on import" (Kenny 03/11/2026 06:12, "Behouden"): an item stored before revisions existed gets
/// `"rev": 0`, the value `rev_of` already read it as, so page and feed agree on it.
fn zero_rev(item: &mut Value) {
    if let Some(obj) = item.as_object_mut() {
        obj.entry("rev").or_insert(Value::from(0));
    }
}

/// The counts the kit checks per list (a mismatch rolls back and names the list). `kitchen.json` holds every list, so
/// it is reported as moved once, with the first list; the kit renames it after the commit.
fn report(
    tx: &Transaction,
    data: &Data,
    files: Vec<std::path::PathBuf>,
) -> Result<ImportReport, Error> {
    let mut stores = Vec::new();
    for &list in COLLECTIONS {
        let expected = data.list(list).map_or(0, <[Value]>::len) as u64;
        stores.push(ImportStore::new(list, expected, rows::count(tx, list)?));
    }
    stores.push(ImportStore::new(
        "answered",
        data.answered.len() as u64,
        rows::count_answered(tx)?,
    ));
    if let Some(first) = stores.first_mut() {
        *first = first.clone().moved(files);
    }
    Ok(ImportReport::from_stores(stores))
}
