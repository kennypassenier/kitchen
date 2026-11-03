//! The second safety net of the move: after the import wrote every row, still inside its transaction, the whole
//! kitchen is read back from the database and compared with what the file held, value for value; the first
//! difference fails the import, which rolls everything back (Kenny 03/11/2026 06:12, "Geen terugval").

use chassis::Error;
use serde_json::Value;

use super::super::super::Data;
use super::super::super::data::COLLECTIONS;

/// `Ok` when `read` (the database) holds exactly `expected` (the normalized file); else the first place they differ.
pub fn same(read: &Data, expected: &Data) -> Result<(), Error> {
    let lists = COLLECTIONS.iter().map(|&l| {
        let pick = |d: &Data| Value::Array(d.list(l).unwrap_or_default().to_vec());
        (l.to_string(), pick(expected), pick(read))
    });
    let singles = [
        (
            "settings".to_string(),
            Value::Object(expected.settings.clone()),
            Value::Object(read.settings.clone()),
        ),
        (
            "settings_rev".to_string(),
            Value::from(expected.settings_rev),
            Value::from(read.settings_rev),
        ),
        ("answered".to_string(), answered(expected), answered(read)),
    ];
    for (at, want, got) in lists.chain(singles) {
        if let Some(diff) = first_difference(&want, &got, &at) {
            return Err(Error::dependency(
                format!("kitchen.db does not hold what kitchen.json holds: {diff}"),
                "nothing was imported and kitchen.json is untouched; report this with kitchen.json.pre-db, \
                 the import is retried at the next start",
            ));
        }
    }
    Ok(())
}

/// The answered take keys as one comparable value.
fn answered(d: &Data) -> Value {
    let all = d
        .answered
        .iter()
        .map(|a| serde_json::json!({ "key": a.key, "answer": a.answer }));
    Value::Array(all.collect())
}

/// The first place `want` and `got` differ, as `dishes[3].recipes[0].label: file has …, database has …`.
pub fn first_difference(want: &Value, got: &Value, at: &str) -> Option<String> {
    match (want, got) {
        (Value::Object(w), Value::Object(g)) => {
            let keys = w.keys().chain(g.keys().filter(|k| !w.contains_key(*k)));
            keys.map(|k| (k, w.get(k), g.get(k)))
                .find_map(|(k, w, g)| match (w, g) {
                    (Some(w), Some(g)) => first_difference(w, g, &format!("{at}.{k}")),
                    _ => Some(format!(
                        "{at}.{k}: file has {}, database has {}",
                        shown(w),
                        shown(g)
                    )),
                })
        }
        (Value::Array(w), Value::Array(g)) if w.len() == g.len() => w
            .iter()
            .zip(g)
            .enumerate()
            .find_map(|(i, (w, g))| first_difference(w, g, &format!("{at}[{i}]"))),
        _ if want == got => None,
        _ => Some(format!(
            "{at}: file has {}, database has {}",
            shown(Some(want)),
            shown(Some(got))
        )),
    }
}

/// A value for the error line, cut short so one long recipe does not flood the log.
fn shown(v: Option<&Value>) -> String {
    const MAX_CHARS: usize = 120;
    match v {
        None => "nothing".into(),
        Some(v) => {
            let s = v.to_string();
            if s.chars().count() > MAX_CHARS {
                format!("{}…", s.chars().take(MAX_CHARS).collect::<String>())
            } else {
                s
            }
        }
    }
}
