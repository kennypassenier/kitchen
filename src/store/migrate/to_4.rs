//! Format 3 to 4 (data-critical: the logic is the original, cut into named steps).

use serde_json::Value;

use super::super::Data;

/// A recipe as it lives inside its dish: no name, created or updated, an empty label.
fn recipe_body(r: &Value) -> Value {
    let mut body = r.clone();
    if let Some(obj) = body.as_object_mut() {
        for k in ["name", "created", "updated"] {
            obj.remove(k);
        }
        obj.insert("label".into(), serde_json::json!({ "nl": "", "en": "" }));
    }
    body
}

/// The index of the dish a recipe goes into: the one that linked it, else the one with its name, else a new one.
fn dish_for(data: &mut Data, r: &Value, rid: &str, name: &str) -> usize {
    let same = |d: &Value| {
        ["nl", "en"].iter().any(|l| {
            !name.is_empty()
                && d["name"][l]
                    .as_str()
                    .is_some_and(|n| n.trim().eq_ignore_ascii_case(name))
        })
    };
    let at = data
        .dishes
        .iter()
        .position(|d| d.get("recipe_id").and_then(Value::as_str) == Some(rid))
        .or_else(|| data.dishes.iter().position(same));
    if let Some(i) = at {
        return i;
    }
    data.dishes.push(serde_json::json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "name": { "nl": "", "en": name },
        "category": null,
        "parents": false,
        "ingredients": [],
        "sides": [],
        "recipes": [],
        "created": r.get("created").cloned().unwrap_or(Value::Null),
    }));
    data.dishes.len() - 1
}

/// Move one recipe into its dish; the pair (recipe id, dish id), or None for a recipe without an id.
fn move_recipe(data: &mut Data, r: Value) -> Option<(String, String)> {
    let rid = r.get("id").and_then(Value::as_str).map(str::to_string)?;
    let name = r
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    let mut body = recipe_body(&r);
    let at = dish_for(data, &r, &rid, &name);
    let dish = &mut data.dishes[at];
    if !dish.get("recipes").is_some_and(Value::is_array) {
        dish["recipes"] = Value::Array(Vec::new());
    }
    let list = dish["recipes"].as_array_mut().expect("just made an array");
    body["default"] = Value::Bool(list.is_empty());
    list.push(body);
    Some((rid, dish["id"].as_str().unwrap_or_default().to_string()))
}

/// Log lines, freezer items and resting marks follow their recipe to its dish.
fn relink(data: &mut Data, moved: &[(String, String)]) {
    let dish_of = |rid: &Value| -> Value {
        rid.as_str()
            .and_then(|rid| moved.iter().find(|(r, _)| r == rid))
            .map(|(_, d)| Value::String(d.clone()))
            .unwrap_or(Value::Null)
    };
    for line in &mut data.log {
        if let Some(obj) = line.as_object_mut()
            && let Some(rid) = obj.get("recipe_id").cloned()
        {
            obj.insert("dish_id".into(), dish_of(&rid));
        }
    }
    for list in [&mut data.freezer, &mut data.resting] {
        for item in list.iter_mut() {
            if let Some(obj) = item.as_object_mut()
                && let Some(rid) = obj.remove("recipe_id")
            {
                obj.insert("dish_id".into(), dish_of(&rid));
            }
        }
    }
}

/// Format 3 to 4 (Kenny, 24/10/2026 09:17, 09:18, 09:27): the recipe belongs
/// to the dish, and a dish may have several (`dish.recipes`, one marked
/// `default`). Each recipe moves into the dish that linked it
/// (`recipe_id`), else the dish with its name (Dutch or English, any case),
/// else a new dish named after it; it keeps its id and every field but its
/// name, created and updated, gets an empty `label` (the pages say "Recipe
/// 1", "Recipe 2" until Kenny names it) and is the default when it is the
/// dish's first. A log line keeps its `recipe_id` and gets the dish's
/// `dish_id`; a freezer item and a resting mark get `dish_id` instead of
/// `recipe_id`. Nothing is added or removed but the new dishes that carry a
/// recipe and the resting marks whose recipe is gone.
pub(in crate::store) fn to_4(data: &mut Data) {
    let recipes = std::mem::take(&mut data.recipes);
    let moved: Vec<(String, String)> = recipes
        .into_iter()
        .filter_map(|r| move_recipe(data, r))
        .collect();
    for d in &mut data.dishes {
        if let Some(obj) = d.as_object_mut() {
            obj.remove("recipe_id");
            obj.entry("recipes").or_insert(Value::Array(Vec::new()));
        }
    }
    relink(data, &moved);
    data.resting
        .retain(|r| r.get("dish_id").is_some_and(|d| !d.is_null()));
    data.format = 4;
}
