//! Reading rows of a table back into JSON objects, nested lists included, recursively: the exact inverse of
//! `write.rs`. A count that does not match its child rows, a key both in a column and in `k_extra`, or a column value
//! the writer cannot produce is damage and an error, never a silent repair.

use chassis::Error;
use chassis::storage::rusqlite::types::Value as Sql;
use chassis::storage::rusqlite::{Connection, Row, params_from_iter};
use serde_json::{Map, Value};

use super::super::spec::{Child, EXTRA, Nest, PARENT, POS, ROW, Table, VALUE, quoted};
use super::cell;

/// Which rows of a table to read.
pub enum Rows<'a> {
    /// Every row of a top-level table.
    All,
    /// The rows of a child table under one parent row.
    Under(i64),
    /// The row of a top-level table with this `id`.
    Id(&'a str),
}

/// The rows of `t` that `which` selects, in list order, as JSON objects.
pub fn load(conn: &Connection, t: &'static Table, which: Rows) -> Result<Vec<Value>, Error> {
    let columns = t.data_columns();
    let (filter, param) = match which {
        Rows::All => (String::new(), None),
        Rows::Under(p) => (format!(" WHERE {PARENT} = ?"), Some(Sql::Integer(p))),
        Rows::Id(id) => (
            " WHERE \"id\" = ?".to_string(),
            Some(Sql::Text(id.to_string())),
        ),
    };
    let sql = format!(
        "SELECT {ROW}, {EXTRA}, {} FROM {}{filter} ORDER BY {POS}",
        columns
            .iter()
            .map(|c| quoted(c))
            .collect::<Vec<_>>()
            .join(", "),
        quoted(t.name)
    );
    let mut stmt = conn.prepare_cached(&sql)?;
    let raw: Vec<(i64, Vec<Sql>)> = stmt
        .query_map(params_from_iter(param), |r| cells_of(r, columns.len() + 2))?
        .collect::<Result<_, _>>()?;
    raw.into_iter()
        .map(|(row, cells)| object(conn, t, row, &cells).map(Value::Object))
        .collect()
}

/// A row's id and every other selected column.
fn cells_of(r: &Row, width: usize) -> Result<(i64, Vec<Sql>), chassis::storage::rusqlite::Error> {
    let row: i64 = r.get(0)?;
    let cells = (1..width)
        .map(|i| r.get::<_, Sql>(i))
        .collect::<Result<_, _>>()?;
    Ok((row, cells))
}

/// One row back into its object. `cells` is `k_extra` followed by the data columns.
fn object(
    conn: &Connection,
    t: &'static Table,
    row: i64,
    cells: &[Sql],
) -> Result<Map<String, Value>, Error> {
    let at = |key: &str| format!("{}[row {row}].{key}", t.name);
    let mut obj = extra(&cells[0], &at(EXTRA))?;
    let mut rest = &cells[1..];
    for f in t.fields {
        let width = f.kind.columns(f.key).len();
        let (mine, after) = rest.split_at(width);
        rest = after;
        if let Some(v) = cell::decode(f.kind, mine, &at(f.key))? {
            put(&mut obj, f.key, v, &at(f.key))?;
        }
    }
    for (c, n) in t.children.iter().zip(rest) {
        match n {
            Sql::Null => {}
            Sql::Integer(n) => {
                let v = nested(conn, c, row, *n, &at(c.key))?;
                put(&mut obj, c.key, v, &at(c.key))?;
            }
            other => return Err(cell::damaged(&at(c.key), std::slice::from_ref(other))),
        }
    }
    Ok(obj)
}

/// The `k_extra` object of a row (empty when NULL).
fn extra(cell: &Sql, at: &str) -> Result<Map<String, Value>, Error> {
    match cell {
        Sql::Null => Ok(Map::new()),
        Sql::Text(s) => match serde_json::from_str(s) {
            Ok(Value::Object(m)) => Ok(m),
            _ => Err(cell::damaged(at, std::slice::from_ref(cell))),
        },
        other => Err(cell::damaged(at, std::slice::from_ref(other))),
    }
}

/// Add a key that must not be there yet: the writer puts each key in exactly one place.
fn put(obj: &mut Map<String, Value>, key: &str, v: Value, at: &str) -> Result<(), Error> {
    if obj.insert(key.to_string(), v).is_some() {
        return Err(Error::internal(
            format!("kitchen.db holds {at} twice (in its column and in k_extra)"),
            "restore kitchen.db from the backup taken before the last update; do not edit the file by hand",
        ));
    }
    Ok(())
}

/// The nested value of child `c` under `row`, which must hold exactly `n` elements.
fn nested(conn: &Connection, c: &Child, row: i64, n: i64, at: &str) -> Result<Value, Error> {
    let items = match &c.nest {
        Nest::Rows(t) | Nest::One(t) => load(conn, t, Rows::Under(row))?,
        Nest::Strings(table) => strings(conn, table, row)?,
    };
    if i64::try_from(items.len()).ok() != Some(n) {
        return Err(Error::internal(
            format!(
                "kitchen.db: {at} should hold {n} entries but holds {}",
                items.len()
            ),
            "restore kitchen.db from the backup taken before the last update; do not edit the file by hand",
        ));
    }
    Ok(match &c.nest {
        Nest::One(_) => items.into_iter().next().unwrap_or(Value::Null),
        _ => Value::Array(items),
    })
}

/// The strings of a [`Nest::Strings`] table under `row`, in order.
fn strings(conn: &Connection, table: &str, row: i64) -> Result<Vec<Value>, Error> {
    let sql = format!(
        "SELECT {} FROM {} WHERE {PARENT} = ?1 ORDER BY {POS}",
        quoted(VALUE),
        quoted(table)
    );
    let mut stmt = conn.prepare_cached(&sql)?;
    let out = stmt
        .query_map([row], |r| r.get::<_, String>(0))?
        .map(|s| s.map(Value::String))
        .collect::<Result<_, _>>()?;
    Ok(out)
}
