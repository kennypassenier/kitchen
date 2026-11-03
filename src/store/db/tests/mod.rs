//! Tests of the persistence adapter (feat-db-schema-1). Written 03/11/2026, not run (Kenny's test rule); listed in
//! docs/OPEN.md release check 16.

use chassis::storage::{AppDb, AppDbSpec};

mod schema;

/// An empty in-memory `kitchen.db` at the current schema, without the import.
fn empty_db() -> AppDb {
    AppDb::open_in_memory(AppDbSpec::new(super::migrations()), Vec::new()).unwrap()
}
