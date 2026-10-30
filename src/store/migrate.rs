//! Lifting an older kitchen file to the current format, one format at a time (data-critical: moved verbatim).

use serde_json::Value;

use super::{Data, FORMAT};

/// Format 4 to 5 (Kenny, 24/10/2026 10:04): a shelf food's `title`,
/// `text` and `gear` and a freezer item's `dish` become `{nl, en}`, the
/// text they had in both halves, so nothing is lost; Kenny translates them
/// from the pages.
pub(super) fn to_5(data: &mut Data) {
    let both = |v: &mut Value| {
        if let Some(text) = v.as_str().map(str::to_string) {
            *v = serde_json::json!({ "nl": text, "en": text });
        }
    };
    for s in &mut data.shelf {
        for k in ["title", "text", "gear"] {
            if let Some(v) = s.get_mut(k) {
                both(v);
            }
        }
    }
    for f in &mut data.freezer {
        if let Some(v) = f.get_mut("dish") {
            both(v);
        }
    }
    data.format = 5;
}

/// Lift an older file to [`FORMAT`], one format at a time.
pub fn migrate(data: &mut Data) {
    if data.format < 2 {
        to_2(data);
    }
    if data.format < 3 {
        to_3(data);
    }
    if data.format < 4 {
        to_4(data);
    }
    if data.format < 5 {
        to_5(data);
    }
    data.format = FORMAT;
}

/// Format 1 to 2 (Kenny, 24/10/2026 05:03). Each dish's `parts` become its
/// `sides`, in the kinds' order: every choice of a part becomes one side,
/// with `choice` on when its kind was picked by the small wheel. The kinds
/// of part are dropped. Nothing else changes, and no dish is added or
/// removed.
pub(super) fn to_2(data: &mut Data) {
    let kinds = std::mem::take(&mut data.dish_parts);
    let kind = |id: Option<&Value>| {
        let id = id.and_then(Value::as_str)?;
        kinds
            .iter()
            .find(|k| k.get("id").and_then(Value::as_str) == Some(id))
    };
    let order = |k: Option<&Value>| {
        k.and_then(|k| k.get("order"))
            .and_then(Value::as_f64)
            .unwrap_or(f64::MAX)
    };
    for dish in &mut data.dishes {
        let Some(obj) = dish.as_object_mut() else {
            continue;
        };
        let Some(parts) = obj.remove("parts") else {
            continue;
        };
        let mut parts: Vec<&Value> = parts.as_array().into_iter().flatten().collect();
        parts.sort_by(|a, b| order(kind(a.get("part"))).total_cmp(&order(kind(b.get("part")))));
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
        obj.entry("sides").or_insert(Value::Array(sides));
    }
    data.format = 2;
}

/// The id of the ingredient named `nl` or `en` (any case), made when there
/// is none yet; a half the ingredient misses is filled from the name given.
fn ingredient_id(list: &mut Vec<Value>, other: &str, nl: &str, en: &str) -> Option<String> {
    let (nl, en) = (nl.trim(), en.trim());
    if nl.is_empty() && en.is_empty() {
        return None;
    }
    let same = |v: &Value, lang: &str, name: &str| {
        !name.is_empty()
            && v["name"][lang]
                .as_str()
                .is_some_and(|n| n.trim().to_lowercase() == name.to_lowercase())
    };
    if let Some(found) = list
        .iter_mut()
        .find(|v| same(v, "nl", nl) || same(v, "en", en))
    {
        for (lang, name) in [("nl", nl), ("en", en)] {
            if !name.is_empty()
                && found["name"][lang]
                    .as_str()
                    .is_none_or(|n| n.trim().is_empty())
            {
                found["name"][lang] = Value::from(name);
            }
        }
        return found["id"].as_str().map(str::to_string);
    }
    let id = uuid::Uuid::new_v4().to_string();
    list.push(serde_json::json!({
        "id": id,
        "name": { "nl": nl, "en": en },
        "category": other,
        "created": chassis::shell::time::now_rfc3339(),
    }));
    Some(id)
}

/// Format 2 to 3 (Kenny, 24/10/2026 05:15, 05:26). Every distinct side name
/// and recipe ingredient name becomes one ingredient (matched on its Dutch
/// or English name, any case; a recipe line's name is English), in the
/// category "Andere" / "Other", made when missing. A dish's side with
/// `choice` on becomes a side of one ingredient (`sides: [{ingredients:
/// [id]}]`, one entry on the small wheel); one with `choice` off becomes
/// one of the dish's fixed `ingredients`. A recipe line keeps its amount,
/// unit, group and note and gets `ingredient` instead of `name`. Nothing
/// else changes.
pub(super) fn to_3(data: &mut Data) {
    let is_other = |c: &Value| {
        c["name"]["en"]
            .as_str()
            .is_some_and(|n| n.trim().eq_ignore_ascii_case("other"))
    };
    let other = match data.ingredient_categories.iter().find(|c| is_other(c)) {
        Some(c) => c["id"].as_str().unwrap_or_default().to_string(),
        None => {
            let id = uuid::Uuid::new_v4().to_string();
            data.ingredient_categories.push(serde_json::json!({
                "id": id,
                "name": { "nl": "Andere", "en": "Other" },
                "order": data.ingredient_categories.len() + 1,
                "created": chassis::shell::time::now_rfc3339(),
            }));
            id
        }
    };
    let mut list = std::mem::take(&mut data.ingredients);
    for dish in &mut data.dishes {
        let Some(obj) = dish.as_object_mut() else {
            continue;
        };
        let old = obj
            .remove("sides")
            .and_then(|v| v.as_array().cloned())
            .unwrap_or_default();
        let mut fixed: Vec<Value> = Vec::new();
        let mut sides: Vec<Value> = Vec::new();
        for side in &old {
            let half = |lang: &str| side["name"][lang].as_str().unwrap_or_default().to_string();
            let Some(id) = ingredient_id(&mut list, &other, &half("nl"), &half("en")) else {
                continue;
            };
            if side.get("choice").and_then(Value::as_bool) == Some(true) {
                sides.push(serde_json::json!({ "ingredients": [id] }));
            } else if !fixed.contains(&Value::String(id.clone())) {
                fixed.push(Value::String(id));
            }
        }
        obj.insert("ingredients".into(), Value::Array(fixed));
        obj.insert("sides".into(), Value::Array(sides));
    }
    for recipe in &mut data.recipes {
        let Some(lines) = recipe.get_mut("ingredients").and_then(Value::as_array_mut) else {
            continue;
        };
        for line in lines.iter_mut() {
            let Some(obj) = line.as_object_mut() else {
                continue;
            };
            let name = obj
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            if let Some(id) = ingredient_id(&mut list, &other, "", &name) {
                obj.remove("name");
                obj.insert("ingredient".into(), Value::String(id));
            }
        }
    }
    data.ingredients = list;
    data.format = 3;
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
pub(super) fn to_4(data: &mut Data) {
    let recipes = std::mem::take(&mut data.recipes);
    let mut moved: Vec<(String, String)> = Vec::new();
    for r in recipes {
        let Some(rid) = r.get("id").and_then(Value::as_str).map(str::to_string) else {
            continue;
        };
        let name = r
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .trim()
            .to_string();
        let mut body = r.clone();
        if let Some(obj) = body.as_object_mut() {
            for k in ["name", "created", "updated"] {
                obj.remove(k);
            }
            obj.insert("label".into(), serde_json::json!({ "nl": "", "en": "" }));
        }
        let same = |d: &Value| {
            ["nl", "en"].iter().any(|l| {
                !name.is_empty()
                    && d["name"][l]
                        .as_str()
                        .is_some_and(|n| n.trim().eq_ignore_ascii_case(&name))
            })
        };
        let at = data
            .dishes
            .iter()
            .position(|d| d.get("recipe_id").and_then(Value::as_str) == Some(rid.as_str()))
            .or_else(|| data.dishes.iter().position(same));
        let at = match at {
            Some(i) => i,
            None => {
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
        };
        let dish = &mut data.dishes[at];
        if !dish.get("recipes").is_some_and(Value::is_array) {
            dish["recipes"] = Value::Array(Vec::new());
        }
        let list = dish["recipes"].as_array_mut().expect("just made an array");
        body["default"] = Value::Bool(list.is_empty());
        list.push(body);
        moved.push((rid, dish["id"].as_str().unwrap_or_default().to_string()));
    }
    for d in &mut data.dishes {
        if let Some(obj) = d.as_object_mut() {
            obj.remove("recipe_id");
            obj.entry("recipes").or_insert(Value::Array(Vec::new()));
        }
    }
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
    data.resting
        .retain(|r| r.get("dish_id").is_some_and(|d| !d.is_null()));
    data.format = 4;
}
