//! The kitchen's lists, settings and answered keys as rows: the statements the store's changes, the import and the
//! sync feed are made of. Every table name here comes from `tables.rs`, never from a request.

use chassis::Error;
use chassis::storage::rusqlite::{Connection, OptionalExtension, Transaction};
use serde_json::{Map, Value};

use super::super::data::{COLLECTIONS, FORMAT};
use super::super::{Answered, Data};
use super::codec::{self, Rows, to_i64};
use super::spec::{POS, Table, quoted};
use super::tables::{SETTINGS, list_table};

/// The whole kitchen as the store holds it in memory.
pub fn load_data(conn: &Connection) -> Result<Data, Error> {
    let mut data = Data::empty();
    for name in COLLECTIONS {
        let items = codec::load(conn, table(name)?, Rows::All)?;
        *data.collection(name).ok_or_else(|| unknown(name))? = items;
    }
    data.format = FORMAT;
    (data.settings, data.settings_rev) = load_settings(conn)?;
    data.answered = load_answered(conn)?;
    Ok(data)
}

/// One item of a list by its id, `None` when the list does not hold it.
pub fn load_item(conn: &Connection, list: &str, id: &str) -> Result<Option<Value>, Error> {
    Ok(codec::load(conn, table(list)?, Rows::Id(id))?
        .into_iter()
        .next())
}

/// Write `item` into `list` at `pos`, replacing the item with the same id if there is one.
pub fn put_item(tx: &Transaction, list: &str, pos: usize, item: &Value) -> Result<(), Error> {
    let t = table(list)?;
    let Value::Object(obj) = item else {
        return Err(Error::internal(
            format!("an item of {list} is not a JSON object"),
            "report this; nothing was saved",
        ));
    };
    if let Some(id) = obj.get("id").and_then(Value::as_str) {
        delete_item(tx, list, id)?;
    }
    codec::insert(tx, t, None, pos, obj)?;
    Ok(())
}

/// Remove the item `id` of `list` with its nested rows (`ON DELETE CASCADE`).
pub fn delete_item(tx: &Transaction, list: &str, id: &str) -> Result<(), Error> {
    let sql = format!(
        "DELETE FROM {} WHERE \"id\" = ?1",
        quoted(table(list)?.name)
    );
    tx.prepare_cached(&sql)?.execute([id])?;
    Ok(())
}

/// Remove every item of `list`.
pub fn clear_list(tx: &Transaction, list: &str) -> Result<(), Error> {
    tx.execute(&format!("DELETE FROM {}", quoted(table(list)?.name)), [])?;
    Ok(())
}

/// Move the item `id` of `list` to `pos`.
pub fn set_pos(tx: &Transaction, list: &str, id: &str, pos: usize) -> Result<(), Error> {
    let sql = format!(
        "UPDATE {} SET {POS} = ?1 WHERE \"id\" = ?2",
        quoted(table(list)?.name)
    );
    tx.prepare_cached(&sql)?.execute((to_i64(pos)?, id))?;
    Ok(())
}

/// How many items `list` holds, for the import's per-list counts.
pub fn count(conn: &Connection, list: &str) -> Result<u64, Error> {
    let sql = format!("SELECT COUNT(*) FROM {}", quoted(table(list)?.name));
    let n: i64 = conn.query_row(&sql, [], |r| r.get(0))?;
    Ok(n.unsigned_abs())
}

/// The settings and their revision (an empty object and 0 before anything was written).
pub fn load_settings(conn: &Connection) -> Result<(Map<String, Value>, u64), Error> {
    let settings = match codec::load(conn, &SETTINGS, Rows::All)?.into_iter().next() {
        Some(Value::Object(m)) => m,
        _ => Map::new(),
    };
    let rev: Option<i64> = conn
        .query_row("SELECT rev FROM settings_rev WHERE k_row = 1", [], |r| {
            r.get(0)
        })
        .optional()?;
    Ok((
        settings,
        rev.and_then(|r| u64::try_from(r).ok()).unwrap_or(0),
    ))
}

/// Replace the settings row and its revision.
pub fn write_settings(
    tx: &Transaction,
    settings: &Map<String, Value>,
    rev: u64,
) -> Result<(), Error> {
    tx.execute("DELETE FROM settings", [])?;
    codec::insert(tx, &SETTINGS, None, 0, settings)?;
    let rev = i64::try_from(rev)
        .map_err(|_| Error::internal("settings_rev beyond 2^63", "report this"))?;
    tx.execute(
        "INSERT INTO settings_rev (k_row, rev) VALUES (1, ?1) ON CONFLICT(k_row) DO UPDATE SET rev = excluded.rev",
        [rev],
    )?;
    Ok(())
}

/// How many answered take keys are stored, for the import's counts.
pub fn count_answered(conn: &Connection) -> Result<u64, Error> {
    let n: i64 = conn.query_row("SELECT COUNT(*) FROM answered", [], |r| r.get(0))?;
    Ok(n.unsigned_abs())
}

/// The answered take keys, oldest first.
pub fn load_answered(conn: &Connection) -> Result<Vec<Answered>, Error> {
    let mut stmt = conn.prepare_cached("SELECT \"key\", answer FROM answered ORDER BY k_pos")?;
    let raw: Vec<(String, String)> = stmt
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect::<Result<_, _>>()?;
    raw.into_iter()
        .map(|(key, answer)| {
            let answer = serde_json::from_str(&answer).map_err(|e| {
                Error::internal(
                    format!("kitchen.db: the answer kept for take key {key} is not JSON: {e}"),
                    "restore kitchen.db from the backup taken before the last update",
                )
            })?;
            Ok(Answered { key, answer })
        })
        .collect()
}

/// Replace the answered keys with `all` (at most `ANSWERS_KEEP`, so rewriting them whole is cheap).
pub fn write_answered(tx: &Transaction, all: &[Answered]) -> Result<(), Error> {
    tx.execute("DELETE FROM answered", [])?;
    let mut stmt =
        tx.prepare_cached("INSERT INTO answered (k_pos, \"key\", answer) VALUES (?1, ?2, ?3)")?;
    for (i, a) in all.iter().enumerate() {
        stmt.execute((to_i64(i)?, &a.key, a.answer.to_string()))?;
    }
    Ok(())
}

/// The table of a list name; the names come from `COLLECTIONS`, so an unknown one is a programming error.
fn table(list: &str) -> Result<&'static Table, Error> {
    list_table(list).ok_or_else(|| unknown(list))
}

fn unknown(list: &str) -> Error {
    Error::internal(
        format!("there is no table for the list {list:?}"),
        "report this",
    )
}
