//! Format 1 to 2 (data-critical: the logic is the original, cut into named steps).

use serde_json::Value;

use super::super::Data;

/// The kind of part with this id, if any.
fn kind_of<'a>(kinds: &'a [Value], id: Option<&Value>) -> Option<&'a Value> {
    let id = id.and_then(Value::as_str)?;
    kinds
        .iter()
        .find(|k| k.get("id").and_then(Value::as_str) == Some(id))
}

/// A kind's place in the order; unknown kinds go last.
fn order_of(k: Option<&Value>) -> f64 {
    k.and_then(|k| k.get("order"))
        .and_then(Value::as_f64)
        .unwrap_or(f64::MAX)
}

/// The sides of one dish: one per choice of each part, in the kinds' order.
fn sides_of(kinds: &[Value], parts: &Value) -> Vec<Value> {
    let kind = |id: Option<&Value>| kind_of(kinds, id);
    let mut parts: Vec<&Value> = parts.as_array().into_iter().flatten().collect();
    parts.sort_by(|a, b| order_of(kind(a.get("part"))).total_cmp(&order_of(kind(b.get("part")))));
    let mut sides: Vec<Value> = Vec::new();
    for p in parts {
        let choice = kind(p.get("part"))
            .and_then(|k| k.get("wheel"))
            .and_then(Value::as_bool)
            == Some(true);
        for c in p
            .get("choices")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            sides.push(serde_json::json!({
                "name": { "nl": c.get("nl").cloned().unwrap_or_default(), "en": c.get("en").cloned().unwrap_or_default() },
                "choice": choice,
            }));
        }
    }
    sides
}

/// Format 1 to 2 (Kenny, 24/10/2026 05:03). Each dish's `parts` become its
/// `sides`, in the kinds' order: every choice of a part becomes one side,
/// with `choice` on when its kind was picked by the small wheel. The kinds
/// of part are dropped. Nothing else changes, and no dish is added or
/// removed.
pub(in crate::store) fn to_2(data: &mut Data) {
    let kinds = std::mem::take(&mut data.dish_parts);
    for dish in &mut data.dishes {
        let Some(obj) = dish.as_object_mut() else {
            continue;
        };
        let Some(parts) = obj.remove("parts") else {
            continue;
        };
        let sides = sides_of(&kinds, &parts);
        obj.entry("sides").or_insert(Value::Array(sides));
    }
    data.format = 2;
}
