//! Format 2 to 3 (data-critical: the logic is the original, cut into named steps).

use serde_json::Value;

use super::super::Data;

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

/// The id of the category "Other" (any case), made when missing.
fn other_category(data: &mut Data) -> String {
    let is_other = |c: &Value| {
        c["name"]["en"]
            .as_str()
            .is_some_and(|n| n.trim().eq_ignore_ascii_case("other"))
    };
    match data.ingredient_categories.iter().find(|c| is_other(c)) {
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
    }
}

/// One dish: its sides become fixed `ingredients` (choice off) and sides of one ingredient (choice on).
fn dish_sides(list: &mut Vec<Value>, other: &str, obj: &mut serde_json::Map<String, Value>) {
    let old = obj
        .remove("sides")
        .and_then(|v| v.as_array().cloned())
        .unwrap_or_default();
    let mut fixed: Vec<Value> = Vec::new();
    let mut sides: Vec<Value> = Vec::new();
    for side in &old {
        let half = |lang: &str| side["name"][lang].as_str().unwrap_or_default().to_string();
        let Some(id) = ingredient_id(list, other, &half("nl"), &half("en")) else {
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

/// One recipe: every line gets `ingredient` instead of `name`.
fn recipe_lines(list: &mut Vec<Value>, other: &str, recipe: &mut Value) {
    let Some(lines) = recipe.get_mut("ingredients").and_then(Value::as_array_mut) else {
        return;
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
        if let Some(id) = ingredient_id(list, other, "", &name) {
            obj.remove("name");
            obj.insert("ingredient".into(), Value::String(id));
        }
    }
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
pub(in crate::store) fn to_3(data: &mut Data) {
    let other = other_category(data);
    let mut list = std::mem::take(&mut data.ingredients);
    for dish in &mut data.dishes {
        if let Some(obj) = dish.as_object_mut() {
            dish_sides(&mut list, &other, obj);
        }
    }
    for recipe in &mut data.recipes {
        recipe_lines(&mut list, &other, recipe);
    }
    data.ingredients = list;
    data.format = 3;
}
