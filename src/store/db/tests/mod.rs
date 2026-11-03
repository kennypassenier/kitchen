//! Tests of the persistence adapter (feat-db-schema-1, feat-db-import-1). Written 03/11/2026, not run (Kenny's test
//! rule); listed in docs/OPEN.md release check 16.

use chassis::storage::{AppDb, AppDbSpec};

use super::super::Data;

mod codec;
mod import_roundtrip;
mod schema;

/// An empty in-memory `kitchen.db` at the current schema, without the import.
fn empty_db() -> AppDb {
    AppDb::open_in_memory(AppDbSpec::new(super::migrations()), Vec::new()).unwrap()
}

/// Write `data` into `db` the way the import does, and read it back.
fn round_trip(db: &AppDb, data: &Data) -> Data {
    let ops = super::plan::plan_all(data);
    db.write_blocking(|tx| super::plan::apply(tx, &ops))
        .unwrap();
    db.read_blocking(super::rows::load_data).unwrap()
}

/// The path of a committed fixture under `tests/fixtures/db_move/`.
fn fixture(name: &str) -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/db_move")
        .join(name)
}
