//! The size check (fix-field-limits-1): every string and every capped list in an item, at any depth, against the
//! numbers in `limits.rs`. A refusal names the field the way the other refusals do (`recipes[0].steps[3].text.nl`) and
//! the limit it broke, so a page can put the message at that field.

use serde_json::{Map, Value};

use super::Refused;
use super::limits::{LIST_CAPS, MAX_NAME_CHARS, MAX_TEXT_CHARS, NAME_KEYS};

/// Whether every text and list in the item is within its limit.
pub(super) fn within_limits(obj: &Map<String, Value>) -> Result<(), Refused> {
    for (k, v) in obj {
        walk(v, k, NAME_KEYS.contains(&k.as_str()), list_cap(k))?;
    }
    Ok(())
}

/// The cap of a list under `key`, when it has one.
fn list_cap(key: &str) -> Option<usize> {
    LIST_CAPS.iter().find(|(k, _)| *k == key).map(|(_, n)| *n)
}

/// One value at `at`. `named`: a string here is a name (its own key or the key above an `{nl, en}` pair is a name key).
/// `cap`: the length limit of this value when it is a list.
fn walk(v: &Value, at: &str, named: bool, cap: Option<usize>) -> Result<(), Refused> {
    match v {
        Value::String(s) => text(s, at, named),
        Value::Array(items) => {
            if let Some(limit) = cap
                && items.len() > limit
            {
                return Err(Refused::TooMany {
                    field: at.into(),
                    limit,
                });
            }
            for (i, item) in items.iter().enumerate() {
                walk(item, &format!("{at}[{i}]"), named, None)?;
            }
            Ok(())
        }
        Value::Object(map) => {
            for (k, inner) in map {
                // `nl` and `en` are the halves of the name or text above; any other key decides for itself.
                let half = matches!(k.as_str(), "nl" | "en");
                let is_name = if half {
                    named
                } else {
                    NAME_KEYS.contains(&k.as_str())
                };
                walk(inner, &format!("{at}.{k}"), is_name, list_cap(k))?;
            }
            Ok(())
        }
        _ => Ok(()),
    }
}

/// A string within its limit: a name's or a text's. Counted in characters, not bytes.
fn text(s: &str, at: &str, named: bool) -> Result<(), Refused> {
    let limit = if named {
        MAX_NAME_CHARS
    } else {
        MAX_TEXT_CHARS
    };
    if s.chars().count() > limit {
        return Err(Refused::TooLong {
            field: at.into(),
            limit,
        });
    }
    Ok(())
}
