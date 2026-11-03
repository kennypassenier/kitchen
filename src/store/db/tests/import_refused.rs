//! A file the import cannot take is refused whole: the transaction rolls back, `kitchen.json` stays where it was, the
//! pre-db copy is kept, and the kit refuses to open the database with the reason (`import_required`), so the service
//! does not start.

use chassis::storage::{AppDb, AppDbSpec, ImportState};

use super::super::import::{self, backup};
use super::super::{app_db_spec, migrations, rows};

/// Open `kitchen.db` beside a `kitchen.json` holding `bytes`; answers the kit's refusal and the directory.
fn open_beside(bytes: &[u8]) -> (String, tempfile::TempDir) {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("kitchen.json"), bytes).unwrap();
    let refusal = match AppDb::open(&dir.path().join("kitchen.db"), app_db_spec(), Vec::new()) {
        Ok(db) => panic!("the open must be refused: {:?}", db.import_state()),
        Err(e) => e.to_string(),
    };
    (refusal, dir)
}

/// The database as an open without the veto sees it: the import rolled back again, so nothing is in it.
fn open_without_veto(dir: &std::path::Path) -> AppDb {
    let spec = AppDbSpec::new(migrations()).with_import(import::run);
    AppDb::open(&dir.join("kitchen.db"), spec, Vec::new()).unwrap()
}

fn refused(bytes: &[u8], says: &str) {
    let (refusal, dir) = open_beside(bytes);
    assert!(refusal.contains(says), "{refusal}");
    let file = dir.path().join("kitchen.json");
    assert_eq!(
        std::fs::read(&file).unwrap(),
        bytes,
        "kitchen.json untouched"
    );
    assert!(!dir.path().join("kitchen.json.migrated").exists());
    assert_eq!(
        std::fs::read(backup::copy_path(&file)).unwrap(),
        bytes,
        "the copy is kept"
    );
    let db = open_without_veto(dir.path());
    let d = db.read_blocking(rows::load_data).unwrap();
    assert!(
        d.dishes.is_empty() && d.dish_categories.is_empty(),
        "nothing was written"
    );
    assert!(matches!(db.import_state(), ImportState::Failed { .. }));
}

#[test]
fn a_file_from_a_newer_kitchen_is_refused_and_left_alone() {
    refused(
        br#"{"format": 99, "dishes": [{"id": "d"}]}"#,
        "newer Kitchen",
    );
}

#[test]
fn a_broken_file_is_refused_and_left_alone() {
    refused(br#"{"format": 5, "dishes": [{"id": "#, "kitchen.json");
}

#[test]
fn a_retry_keeps_the_first_copy() {
    let (_db, dir) = open_beside(br#"{"format": 99}"#);
    let file = dir.path().join("kitchen.json");
    std::fs::write(&file, br#"{"format": 98}"#).unwrap();
    assert!(AppDb::open(&dir.path().join("kitchen.db"), app_db_spec(), Vec::new()).is_err());
    assert_eq!(
        std::fs::read(backup::copy_path(&file)).unwrap(),
        br#"{"format": 99}"#
    );
}

#[test]
fn only_a_done_import_lets_the_store_start() {
    assert!(crate::boot::import_verdict(&ImportState::Done).is_ok());
    assert!(crate::boot::import_verdict(&ImportState::NotRequested).is_err());
}
