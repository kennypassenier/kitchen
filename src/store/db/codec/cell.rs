//! One field to its columns and back. A value that does not fit its kind is reported as `None` by [`encode`], and
//! the caller keeps it in `k_extra` instead; [`decode`] treats any combination of columns the encoder cannot produce as
//! damage and says so, never guessing.

use chassis::Error;
use chassis::storage::rusqlite::types::Value as Sql;
use serde_json::{Map, Number, Value};

use super::super::spec::Kind;

/// The columns of `kind` for `v`, in [`Kind::columns`] order; `None` when `v` does not fit the kind.
pub fn encode(kind: Kind, v: &Value) -> Option<Vec<Sql>> {
    match kind {
        Kind::Text => v.as_str().map(|s| vec![text(s)]),
        Kind::Int => v.as_i64().map(|i| vec![Sql::Integer(i)]),
        Kind::Num => number(v).map(|n| vec![n]),
        Kind::Bool => v.as_bool().map(|b| vec![Sql::Integer(i64::from(b))]),
        Kind::Pair => pair(v).map(|(nl, en)| vec![text(nl), text(en)]),
        Kind::TextOrPair => match (v.as_str(), pair(v)) {
            (Some(s), _) => Some(vec![text(s), Sql::Null, Sql::Null]),
            (None, Some((nl, en))) => Some(vec![Sql::Null, text(nl), text(en)]),
            (None, None) => None,
        },
        Kind::Json => serde_json::to_string(v).ok().map(|s| vec![Sql::Text(s)]),
    }
}

/// The columns of `kind` for an absent key: all NULL.
pub fn absent(kind: Kind) -> Vec<Sql> {
    vec![Sql::Null; kind.columns("k").len()]
}

/// The value `cells` (this kind's columns, in order) hold: `Ok(None)` when all are NULL (the key was absent).
/// `at` names the place for an error (`dishes.name`).
pub fn decode(kind: Kind, cells: &[Sql], at: &str) -> Result<Option<Value>, Error> {
    let bad = || damaged(at, cells);
    if cells.iter().all(|c| matches!(c, Sql::Null)) {
        return Ok(None);
    }
    let v = match (kind, cells) {
        (Kind::Text, [Sql::Text(s)]) => Value::String(s.clone()),
        (Kind::Int, [Sql::Integer(i)]) => Value::from(*i),
        (Kind::Num, [Sql::Integer(i)]) => Value::from(*i),
        (Kind::Num, [Sql::Real(f)]) => Value::Number(Number::from_f64(*f).ok_or_else(bad)?),
        (Kind::Bool, [Sql::Integer(0)]) => Value::Bool(false),
        (Kind::Bool, [Sql::Integer(1)]) => Value::Bool(true),
        (Kind::Pair, [Sql::Text(nl), Sql::Text(en)]) => pair_value(nl, en),
        (Kind::TextOrPair, [Sql::Text(s), Sql::Null, Sql::Null]) => Value::String(s.clone()),
        (Kind::TextOrPair, [Sql::Null, Sql::Text(nl), Sql::Text(en)]) => pair_value(nl, en),
        (Kind::Json, [Sql::Text(s)]) => serde_json::from_str(s).map_err(|_| bad())?,
        _ => return Err(bad()),
    };
    Ok(Some(v))
}

/// The error for columns the encoder cannot have written: the database was changed by hand or is damaged.
pub fn damaged(at: &str, cells: &[Sql]) -> Error {
    Error::internal(
        format!("kitchen.db holds a value Kitchen cannot have written at {at}: {cells:?}"),
        "restore kitchen.db from the backup taken before the last update; do not edit the file by hand",
    )
}

fn text(s: &str) -> Sql {
    Sql::Text(s.to_string())
}

/// A JSON number as SQLite keeps it: an integer stays an integer, a float a float. A whole number beyond i64 does not
/// fit (it goes to `k_extra`, which keeps it exactly).
fn number(v: &Value) -> Option<Sql> {
    match v {
        Value::Number(n) if n.is_i64() => n.as_i64().map(Sql::Integer),
        Value::Number(n) if n.is_f64() => n.as_f64().map(Sql::Real),
        _ => None,
    }
}

/// `{nl, en}` with exactly those two keys, both strings.
fn pair(v: &Value) -> Option<(&str, &str)> {
    let o = v.as_object()?;
    if o.len() != 2 {
        return None;
    }
    Some((o.get("nl")?.as_str()?, o.get("en")?.as_str()?))
}

fn pair_value(nl: &str, en: &str) -> Value {
    let mut m = Map::new();
    m.insert("nl".into(), Value::String(nl.to_string()));
    m.insert("en".into(), Value::String(en.to_string()));
    Value::Object(m)
}
