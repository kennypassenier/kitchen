//! What one store change means for the database: the difference between the kitchen before and after a change, as
//! row operations, each with its change-log entry (feat-db-sync-1).
//!
//! The store keeps its domain logic on the in-memory [`Data`] exactly as before (only persistence changed, Kenny's
//! rule), so a change is known by its effect: [`plan`] compares the two versions list by list by `id`, and [`apply`]
//! writes the result in the caller's transaction, calling `tx.sync_upsert` / `tx.sync_delete` for every item it
//! touches. Data and change log therefore commit together or not at all.

use chassis::Error;
use chassis::storage::rusqlite::Transaction;
use chassis::storage::sync::SyncWrite;
use serde_json::{Map, Value};

use super::super::data::COLLECTIONS;
use super::super::{Answered, Data, rev_of};
use super::rows;
use super::sync::{SETTINGS_COLLECTION, SETTINGS_KEY};

/// One row operation of a change.
#[derive(Debug, Clone, PartialEq)]
pub enum Op {
    /// Write the item at its place, replacing the stored one with the same id; a changed or new item.
    Put {
        list: &'static str,
        pos: usize,
        item: Value,
    },
    /// The item is gone; `rev` is the revision of its tombstone (the removed item's plus one).
    Remove {
        list: &'static str,
        id: String,
        rev: u64,
    },
    /// An unchanged item moved, because one before it came or went.
    Move {
        list: &'static str,
        id: String,
        pos: usize,
    },
    /// Write the list whole: used when its items cannot be told apart by a unique string `id` (only ever true of a
    /// file written by hand); `gone` are the ids of the old version that are no longer there.
    Rewrite {
        list: &'static str,
        items: Vec<Value>,
        gone: Vec<(String, u64)>,
    },
    Settings {
        settings: Map<String, Value>,
        rev: u64,
    },
    Answered(Vec<Answered>),
}

/// The operations that turn `before` into `after`.
pub fn plan(before: &Data, after: &Data) -> Vec<Op> {
    let mut ops = Vec::new();
    for &list in COLLECTIONS {
        let (b, a) = (list_of(before, list), list_of(after, list));
        if b != a {
            plan_list(list, b, a, &mut ops);
        }
    }
    if before.settings != after.settings || before.settings_rev != after.settings_rev {
        ops.push(Op::Settings {
            settings: after.settings.clone(),
            rev: after.settings_rev,
        });
    }
    if before.answered != after.answered {
        ops.push(Op::Answered(after.answered.clone()));
    }
    ops
}

/// The operations that write all of `data` into empty tables: the import's.
pub fn plan_all(data: &Data) -> Vec<Op> {
    let mut ops: Vec<Op> = COLLECTIONS
        .iter()
        .map(|&list| Op::Rewrite {
            list,
            items: list_of(data, list).to_vec(),
            gone: Vec::new(),
        })
        .collect();
    ops.push(Op::Settings {
        settings: data.settings.clone(),
        rev: data.settings_rev,
    });
    ops.push(Op::Answered(data.answered.clone()));
    ops
}

/// Write `ops` and their change-log entries in `tx`.
pub fn apply(tx: &Transaction, ops: &[Op]) -> Result<(), Error> {
    for op in ops {
        match op {
            Op::Put { list, pos, item } => {
                rows::put_item(tx, list, *pos, item)?;
                record_upsert(tx, list, item)?;
            }
            Op::Remove { list, id, rev } => {
                rows::delete_item(tx, list, id)?;
                tx.sync_delete(list, id, *rev)?;
            }
            Op::Move { list, id, pos } => rows::set_pos(tx, list, id, *pos)?,
            Op::Rewrite { list, items, gone } => rewrite(tx, list, items, gone)?,
            Op::Settings { settings, rev } => {
                rows::write_settings(tx, settings, *rev)?;
                tx.sync_upsert(SETTINGS_COLLECTION, SETTINGS_KEY, *rev)?;
            }
            Op::Answered(all) => rows::write_answered(tx, all)?,
        }
    }
    Ok(())
}

fn rewrite(
    tx: &Transaction,
    list: &str,
    items: &[Value],
    gone: &[(String, u64)],
) -> Result<(), Error> {
    rows::clear_list(tx, list)?;
    for (pos, item) in items.iter().enumerate() {
        rows::put_item(tx, list, pos, item)?;
        record_upsert(tx, list, item)?;
    }
    for (id, rev) in gone {
        tx.sync_delete(list, id, *rev)?;
    }
    Ok(())
}

/// The change-log entry of a written item. An item without a string id cannot be addressed by a page, so it has no
/// entry (the feed is keyed by id); such items only exist in a file written by hand.
fn record_upsert(tx: &Transaction, list: &str, item: &Value) -> Result<(), Error> {
    if let Some(id) = id_of(item) {
        tx.sync_upsert(list, id, rev_of(item))?;
    }
    Ok(())
}

/// One list's operations; `b` and `a` differ.
fn plan_list(list: &'static str, b: &[Value], a: &[Value], ops: &mut Vec<Op>) {
    let (Some(b_ids), Some(a_ids)) = (unique_ids(b), unique_ids(a)) else {
        let gone = b
            .iter()
            .filter_map(|v| id_of(v).map(|id| (id, rev_of(v))))
            .filter(|(id, _)| !a.iter().any(|v| id_of(v) == Some(id)))
            .map(|(id, rev)| (id.to_string(), rev.saturating_add(1)))
            .collect();
        ops.push(Op::Rewrite {
            list,
            items: a.to_vec(),
            gone,
        });
        return;
    };
    for (i, id) in b_ids.iter().enumerate() {
        if !a_ids.contains(id) {
            ops.push(Op::Remove {
                list,
                id: id.to_string(),
                rev: rev_of(&b[i]).saturating_add(1),
            });
        }
    }
    for (pos, (id, item)) in a_ids.iter().zip(a).enumerate() {
        match b_ids.iter().position(|x| x == id) {
            Some(was) if b[was] == *item && was == pos => {}
            Some(was) if b[was] == *item => ops.push(Op::Move {
                list,
                id: id.to_string(),
                pos,
            }),
            _ => ops.push(Op::Put {
                list,
                pos,
                item: item.clone(),
            }),
        }
    }
}

/// The ids of a list in order, when every item has a string id and no two share one.
fn unique_ids(items: &[Value]) -> Option<Vec<&str>> {
    let ids: Vec<&str> = items.iter().map(id_of).collect::<Option<_>>()?;
    let mut seen = std::collections::HashSet::new();
    ids.iter().all(|id| seen.insert(*id)).then_some(ids)
}

fn id_of(v: &Value) -> Option<&str> {
    v.get("id").and_then(Value::as_str)
}

/// A list of the kitchen by name. Every name passed here comes from `COLLECTIONS`, which [`Data::list`] answers for
/// all of them, so the empty fallback is never taken.
fn list_of<'a>(d: &'a Data, list: &str) -> &'a [Value] {
    d.list(list).unwrap_or_default()
}
