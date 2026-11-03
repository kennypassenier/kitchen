//! The store's persistence adapter: the kitchen in the app database `kitchen.db` (feat-db-schema-1, Kenny's standing
//! rule 02/11/2026 21:01 "ALLE info gaat vanaf nu in databases", answers of 03/11/2026 06:12; design and decisions in
//! `docs/agent/DB_MOVE.md`).
//!
//! The domain (`store/*.rs`) is unchanged and still works on the in-memory [`Data`](super::Data); this module is the
//! only place that knows tables. Its parts:
//!
//! - `spec.rs` / `tables.rs` / `recipe_tables.rs`: every table as data, a real column per field and a child table per nested list;
//!   `schema_v1.sql` is the same as SQL (the kit's migration 1);
//! - `codec/`: one JSON object to its rows and back, losslessly;
//! - `rows.rs`: the statements for lists, settings and the answered take keys;
//! - `plan.rs`: a store change as row operations plus change-log entries, in one transaction;
//! - `import/`: the one-time import of `kitchen.json` with its backup and value-for-value check;
//! - `sync.rs`: the collections the pages' local database syncs and the feed's loader.

use chassis::storage::Migration;

mod codec;
pub mod plan;
mod recipe_tables;
pub mod rows;
mod spec;
pub mod sync;
mod tables;

#[cfg(test)]
mod tests;

/// The schema as the kit's numbered migrations. Append only: a later change is a second entry, never an edit of
/// `schema_v1.sql`.
pub fn migrations() -> Vec<Migration> {
    vec![Migration::sql(include_str!("schema_v1.sql"))]
}
