//! Writing one JSON object as a row of its table, and its nested lists as rows of the child tables, recursively.
//!
//! The split is the lossless rule of the spec: a declared field whose value fits its kind goes to its columns; a
//! declared nested key whose value is a list of the right element type (or, for `One`, an object) goes to the child
//! table with its count in `n_<key>`; everything else, unknown keys included, goes to `k_extra` as it is.

use chassis::Error;
use chassis::storage::rusqlite::types::Value as Sql;
use chassis::storage::rusqlite::{Transaction, params_from_iter};
use serde_json::{Map, Value};

use super::super::spec::{Child, EXTRA, Nest, PARENT, POS, Table, VALUE, quoted};
use super::cell;

/// The parts of one object as its table holds them.
struct Split<'a> {
    /// Every data column of the table, in [`Table::data_columns`] order.
    cells: Vec<Sql>,
    /// The nested values that go to child tables.
    nested: Vec<(&'static Child, &'a Value)>,
    /// What no column holds, or `None` when that is nothing.
    extra: Option<String>,
}

/// Insert `obj` as a row of `t` at `pos` (under `parent` for a child table) with its nested rows; answers the new row id.
pub fn insert(
    tx: &Transaction,
    t: &'static Table,
    parent: Option<i64>,
    pos: usize,
    obj: &Map<String, Value>,
) -> Result<i64, Error> {
    let split = split(t, obj)?;
    let mut names = vec![POS.to_string(), EXTRA.to_string()];
    let mut values = vec![Sql::Integer(to_i64(pos)?), opt_text(split.extra)];
    if let Some(p) = parent {
        names.push(PARENT.to_string());
        values.push(Sql::Integer(p));
    }
    names.extend(t.data_columns());
    values.extend(split.cells);
    let sql = format!(
        "INSERT INTO {} ({}) VALUES ({})",
        quoted(t.name),
        names
            .iter()
            .map(|n| quoted(n))
            .collect::<Vec<_>>()
            .join(", "),
        vec!["?"; names.len()].join(", ")
    );
    tx.prepare_cached(&sql)?.execute(params_from_iter(values))?;
    let row = tx.last_insert_rowid();
    for (c, v) in split.nested {
        insert_nested(tx, c, row, v)?;
    }
    Ok(row)
}

/// Divide `obj` over the table's columns, its child tables and `k_extra`.
fn split<'a>(t: &'static Table, obj: &'a Map<String, Value>) -> Result<Split<'a>, Error> {
    let mut extra = Map::new();
    let mut cells = Vec::new();
    for f in t.fields {
        let fitted = obj.get(f.key).map(|v| (v, cell::encode(f.kind, v)));
        match fitted {
            Some((_, Some(c))) => cells.extend(c),
            Some((v, None)) => {
                extra.insert(f.key.to_string(), v.clone());
                cells.extend(cell::absent(f.kind));
            }
            None => cells.extend(cell::absent(f.kind)),
        }
    }
    let mut nested = Vec::new();
    for c in t.children {
        match obj.get(c.key).map(|v| (v, count(c, v))) {
            Some((v, Some(n))) => {
                cells.push(Sql::Integer(to_i64(n)?));
                nested.push((c, v));
            }
            Some((v, None)) => {
                extra.insert(c.key.to_string(), v.clone());
                cells.push(Sql::Null);
            }
            None => cells.push(Sql::Null),
        }
    }
    let known =
        |k: &str| t.fields.iter().any(|f| f.key == k) || t.children.iter().any(|c| c.key == k);
    for (k, v) in obj.iter().filter(|(k, _)| !known(k)) {
        extra.insert(k.clone(), v.clone());
    }
    let extra = (!extra.is_empty()).then(|| Value::Object(extra).to_string());
    Ok(Split {
        cells,
        nested,
        extra,
    })
}

/// The element count of a nested value that fits its child table, `None` when it does not.
fn count(c: &Child, v: &Value) -> Option<usize> {
    match (&c.nest, v) {
        (Nest::Rows(_), Value::Array(a)) if a.iter().all(Value::is_object) => Some(a.len()),
        (Nest::Strings(_), Value::Array(a)) if a.iter().all(Value::is_string) => Some(a.len()),
        (Nest::One(_), Value::Object(_)) => Some(1),
        _ => None,
    }
}

/// Insert the elements of a nested value (already checked by [`count`]) under `row`.
fn insert_nested(tx: &Transaction, c: &Child, row: i64, v: &Value) -> Result<(), Error> {
    match (&c.nest, v) {
        (Nest::Rows(t), Value::Array(items)) => {
            for (i, item) in items.iter().enumerate() {
                if let Value::Object(o) = item {
                    insert(tx, t, Some(row), i, o)?;
                }
            }
        }
        (Nest::One(t), Value::Object(o)) => {
            insert(tx, t, Some(row), 0, o)?;
        }
        (Nest::Strings(table), Value::Array(items)) => {
            let sql = format!(
                "INSERT INTO {} ({PARENT}, {POS}, {}) VALUES (?1, ?2, ?3)",
                quoted(table),
                quoted(VALUE)
            );
            let mut stmt = tx.prepare_cached(&sql)?;
            for (i, s) in items.iter().enumerate() {
                let s = s.as_str().unwrap_or_default();
                stmt.execute((row, to_i64(i)?, s))?;
            }
        }
        _ => {
            return Err(Error::internal(
                format!("`{}` changed shape while it was written", c.key),
                "report this; nothing was saved",
            ));
        }
    }
    Ok(())
}

fn opt_text(s: Option<String>) -> Sql {
    s.map_or(Sql::Null, Sql::Text)
}

/// A place or a count as SQLite's integer; Kitchen's lists are far below the limit, so a failure means damage.
pub fn to_i64(n: usize) -> Result<i64, Error> {
    i64::try_from(n)
        .map_err(|_| Error::internal(format!("{n} does not fit a row number"), "report this"))
}
