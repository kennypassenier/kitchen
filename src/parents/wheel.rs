//! The wheel's JSON: the dishes and categories one language shows, built from the store's data.

use serde_json::{Value, json};

use crate::store::Data;

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Lang {
    Nl,
    En,
}

impl Lang {
    fn key(self) -> &'static str {
        match self {
            Lang::Nl => "nl",
            Lang::En => "en",
        }
    }
}

/// `{nl, en}` in the asked language, when that half is filled in. A name
/// with only its Dutch half shows on the Dutch wheel and not on the English
/// one, and the other way round (Kenny, 22/10/2026 23:08).
fn named(v: Option<&Value>, lang: Lang) -> Option<String> {
    let s = v?.get(lang.key())?.as_str()?.trim();
    (!s.is_empty()).then(|| s.to_string())
}

fn by_id<'a>(list: &'a [Value], id: Option<&Value>) -> Option<&'a Value> {
    let id = id?.as_str()?;
    list.iter()
        .find(|v| v.get("id").and_then(Value::as_str) == Some(id))
}

fn order(v: &Value) -> f64 {
    v.get("order").and_then(Value::as_f64).unwrap_or(f64::MAX)
}

/// "Frieten en mayonaise", "Fries, peas and mayonnaise": a side's ingredients as one entry on the small wheel, the
/// first as written and the others starting small.
pub(super) fn joined(names: &[String], lang: Lang) -> String {
    let and = if lang == Lang::Nl { "en" } else { "and" };
    let small = |s: &String| -> String {
        let mut c = s.chars();
        match c.next() {
            Some(f) => f.to_lowercase().chain(c).collect(),
            None => String::new(),
        }
    };

    match names {
        [] => String::new(),
        [one] => one.clone(),
        [first, rest @ .., last] => {
            let mut out = first.clone();
            for n in rest {
                out.push_str(", ");
                out.push_str(&small(n));
            }
            format!("{out} {and} {}", small(last))
        }
    }
}

/// The dishes on the parents' wheel in one language.
///
/// A dish shows when `parents` is true and it has a name in `lang`. Its
/// fixed `ingredients` always come with it; each of its `sides` is one
/// entry on the small wheel, named by its ingredients ("Frieten en
/// mayonaise"; Kenny, 24/10/2026 05:26) or by its own `label` (05:27). The
/// same ingredient may stand in several sides. An ingredient without a name
/// in `lang` is left out, and a side with none left goes.
/// Categories are the ones the shown dishes use, in their order, with how
/// many dishes each holds.
pub fn wheel(data: &Data, lang: Lang) -> Value {
    let mut dishes: Vec<Value> = Vec::new();
    for d in &data.dishes {
        if d.get("parents").and_then(Value::as_bool) != Some(true) {
            continue;
        }
        let Some(name) = named(d.get("name"), lang) else {
            continue;
        };
        // The names in `lang` of a list of ingredient ids, the ones without such a name left out.
        let names = |ids: Option<&Value>| -> Vec<String> {
            ids.and_then(Value::as_array)
                .into_iter()
                .flatten()
                .filter_map(|id| named(by_id(&data.ingredients, Some(id))?.get("name"), lang))
                .collect()
        };
        let fixed = names(d.get("ingredients"));
        let sides: Vec<Value> = d
            .get("sides")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter_map(|side| {
                let shown = names(side.get("ingredients"));
                if shown.is_empty() {
                    return None;
                }
                // The side's own label when it has one in `lang` ("Kroketten met mayonaise"; 05:27).
                let name = named(side.get("label"), lang).unwrap_or_else(|| joined(&shown, lang));
                Some(json!({ "name": name, "ingredients": side["ingredients"] }))
            })
            .collect();
        let category = by_id(&data.dish_categories, d.get("category"))
            .filter(|c| named(c.get("name"), lang).is_some())
            .map(|c| c["id"].clone())
            .unwrap_or(Value::Null);
        dishes.push(json!({
            "id": d["id"],
            "name": name,
            "category": category,
            "ingredients": fixed,
            "sides": sides,
        }));
    }
    dishes.sort_by(|a, b| {
        a["name"]
            .as_str()
            .unwrap_or("")
            .to_lowercase()
            .cmp(&b["name"].as_str().unwrap_or("").to_lowercase())
    });
    let mut cats: Vec<&Value> = data
        .dish_categories
        .iter()
        .filter(|c| named(c.get("name"), lang).is_some())
        .collect();
    cats.sort_by(|a, b| order(a).total_cmp(&order(b)));
    let categories: Vec<Value> = cats
        .into_iter()
        .filter_map(|c| {
            let n = dishes.iter().filter(|d| d["category"] == c["id"]).count();
            (n > 0)
                .then(|| json!({ "id": c["id"], "name": named(c.get("name"), lang), "count": n }))
        })
        .collect();
    json!({ "lang": lang.key(), "dishes": dishes, "categories": categories })
}
