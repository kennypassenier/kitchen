//! A file the import cannot take is refused whole: the transaction rolls back, `kitchen.json` stays where it was, the
//! pre-db copy is kept, and the service refuses to start with the reason (`boot::import_verdict`).

use chassis::storage::{AppDb, ImportState};

use super::super::import::backup;
use super::super::{app_db_spec, rows};

/// Open `kitchen.db` beside a `kitchen.json` holding `bytes`; answers the handle and the directory.
fn open_beside(bytes: &[u8]) -> (AppDb, tempfile::TempDir) {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("kitchen.json"), bytes).unwrap();
    let db = AppDb::open(&dir.path().join("kitchen.db"), app_db_spec(), Vec::new()).unwrap();
    (db, dir)
}

fn refused(bytes: &[u8], says: &str) {
    let (db, dir) = open_beside(bytes);
    let ImportState::Failed { why } = db.import_state() else {
        panic!("the import must fail: {:?}", db.import_state());
    };
    assert!(why.contains(says), "{why}");
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
    let d = db.read_blocking(rows::load_data).unwrap();
    assert!(
        d.dishes.is_empty() && d.dish_categories.is_empty(),
        "nothing was written"
    );
    let verdict = crate::boot::import_verdict(&db.import_state()).unwrap_err();
    assert!(
        verdict.contains("kitchen.json") && verdict.contains(&why),
        "{verdict}"
    );
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
    drop(AppDb::open(&dir.path().join("kitchen.db"), app_db_spec(), Vec::new()).unwrap());
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
