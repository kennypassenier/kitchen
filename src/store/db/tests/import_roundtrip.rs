//! The import of each committed fixture (`tests/fixtures/db_move/`, FORMAT 5 files as Kitchen 4.1.0, 5.0.0 and 6.0.0
//! wrote them) through the service's own path: the copy is taken, every value lands, the kit renames the file.

use serde_json::Value;

use super::super::import::{backup, normalize, verify};
use super::super::{app_db_spec, rows};
use super::{Data, fixture};
use chassis::storage::{AppDb, ImportState};

/// Import `name` into a fresh `kitchen.db` beside a copy of it, and check everything the move promises.
fn imports_whole(name: &str) {
    let dir = tempfile::tempdir().unwrap();
    let original = std::fs::read(fixture(name)).unwrap();
    let file = dir.path().join("kitchen.json");
    std::fs::write(&file, &original).unwrap();
    let db = AppDb::open(&dir.path().join("kitchen.db"), app_db_spec(), Vec::new()).unwrap();
    assert_eq!(db.import_state(), ImportState::Done, "{name}");
    assert!(!file.exists(), "{name}: the kit renamed kitchen.json");
    assert_eq!(
        std::fs::read(dir.path().join("kitchen.json.migrated")).unwrap(),
        original
    );
    assert_eq!(
        std::fs::read(backup::copy_path(&file)).unwrap(),
        original,
        "{name}: the pre-db copy"
    );
    let want = normalize(serde_json::from_slice::<Data>(&original).unwrap()).unwrap();
    let got = db.read_blocking(rows::load_data).unwrap();
    verify::same(&got, &want).unwrap_or_else(|e| panic!("{name}: {e}"));
    every_item_has_a_rev(&got, name);
}

fn every_item_has_a_rev(d: &Data, name: &str) {
    for list in crate::store::data::COLLECTIONS {
        for item in d.list(list).unwrap() {
            assert!(
                item.get("rev").and_then(Value::as_u64).is_some(),
                "{name}: {list} item {item}"
            );
        }
    }
}

#[test]
fn the_4_1_0_file_imports_value_for_value() {
    imports_whole("kitchen-4.1.0.json");
}

#[test]
fn the_5_0_0_file_imports_value_for_value() {
    imports_whole("kitchen-5.0.0.json");
}

#[test]
fn the_6_0_0_file_imports_value_for_value_with_its_revisions_and_keys() {
    imports_whole("kitchen-6.0.0.json");
    let raw: Value =
        serde_json::from_slice(&std::fs::read(fixture("kitchen-6.0.0.json")).unwrap()).unwrap();
    let data = normalize(serde_json::from_value(raw.clone()).unwrap()).unwrap();
    assert_eq!(data.settings_rev, raw["settings_rev"].as_u64().unwrap());
    assert_eq!(
        data.answered.len(),
        raw["answered"].as_array().unwrap().len()
    );
}

#[test]
fn a_second_start_does_not_import_again_and_keeps_the_data() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::copy(
        fixture("kitchen-6.0.0.json"),
        dir.path().join("kitchen.json"),
    )
    .unwrap();
    let path = dir.path().join("kitchen.db");
    let first = AppDb::open(&path, app_db_spec(), Vec::new()).unwrap();
    let before = first.read_blocking(rows::load_data).unwrap();
    drop(first);
    let again = AppDb::open(&path, app_db_spec(), Vec::new()).unwrap();
    assert_eq!(again.import_state(), ImportState::Done);
    verify::same(&again.read_blocking(rows::load_data).unwrap(), &before).unwrap();
}

#[test]
fn a_new_kitchen_gets_the_seed_and_renames_nothing() {
    let dir = tempfile::tempdir().unwrap();
    let db = AppDb::open(&dir.path().join("kitchen.db"), app_db_spec(), Vec::new()).unwrap();
    assert_eq!(db.import_state(), ImportState::Done);
    let got = db.read_blocking(rows::load_data).unwrap();
    verify::same(&got, &crate::store::seed()).unwrap();
    assert!(!dir.path().join("kitchen.json.pre-db").exists());
}
