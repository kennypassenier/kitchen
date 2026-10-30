//! What the server checks before it stores a change: names in both languages, recipe sources, recipe addresses.

use serde_json::{Map, Value};

use super::Refused;

/// Every name in Kitchen has its Dutch and its English half (Kenny,
/// 24/10/2026 10:04): a dish, a dish category, an ingredient, an
/// ingredient category, a shelf food's title and a freezer item's name
/// need both, and a side's or a recipe's own label and a shelf food's text
/// and gear, when given, need both too. Items stored before that rule keep
/// what they have until they are saved again.
pub(super) fn both_names(coll: &str, obj: &Map<String, Value>) -> Result<(), Refused> {
    if coll == "shelf" {
        whole(obj.get("title"), "title")?;
        label(obj.get("text"), "text")?;
        return label(obj.get("gear"), "gear");
    }
    if coll == "freezer" {
        return whole(obj.get("dish"), "dish");
    }
    if coll == "recipe_sources" {
        return recipe_source(obj);
    }
    if !matches!(
        coll,
        "dishes" | "dish_categories" | "ingredients" | "ingredient_categories"
    ) {
        return Ok(());
    }
    whole(obj.get("name"), "name")?;
    if coll == "dishes" {
        dish_labels(obj)?;
    }
    Ok(())
}

/// Whether a `{nl, en}` half has words.
fn filled(v: Option<&Value>, lang: &str) -> bool {
    v.and_then(|n| n.get(lang))
        .and_then(Value::as_str)
        .is_some_and(|s| !s.trim().is_empty())
}

/// Both halves of a name must have words.
fn whole(v: Option<&Value>, at: &str) -> Result<(), Refused> {
    for lang in ["nl", "en"] {
        if !filled(v, lang) {
            return Err(Refused::MissingName(format!("{at}.{lang}")));
        }
    }
    Ok(())
}

/// A label is optional, but a label given in one language only is half a name.
fn label(v: Option<&Value>, at: &str) -> Result<(), Refused> {
    if filled(v, "nl") || filled(v, "en") {
        whole(v, at)?;
    }
    Ok(())
}

/// A dish's side labels and its recipes' labels and sources.
fn dish_labels(obj: &Map<String, Value>) -> Result<(), Refused> {
    let items = |k: &str| {
        obj.get(k)
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .enumerate()
    };
    for (i, s) in items("sides") {
        label(s.get("label"), &format!("sides[{i}].label"))?;
    }
    for (i, r) in items("recipes") {
        label(r.get("label"), &format!("recipes[{i}].label"))?;
        source(r.get("source"), &format!("recipes[{i}].source"))?;
    }
    Ok(())
}

/// A recipe source (Kenny, 29/10/2026 15:11): a name, an http(s) address, a language (`nl` or `en`) and, when given, a
/// note in both languages or in none.
fn recipe_source(obj: &Map<String, Value>) -> Result<(), Refused> {
    let bad = |why: &str| Refused::BadRecipeSource(why.into());
    let text = |k: &str| {
        obj.get(k)
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or("")
    };
    if text("name").is_empty() {
        return Err(bad("name is empty: a source needs a name"));
    }
    if text("url").is_empty() {
        return Err(bad("url is empty: a source needs a web address"));
    }
    source(obj.get("url"), "url")?;
    if !matches!(text("language"), "nl" | "en") {
        return Err(bad("language must be nl or en"));
    }
    let note = |lang: &str| {
        obj.get("note")
            .and_then(|n| n.get(lang))
            .and_then(Value::as_str)
            .is_some_and(|s| !s.trim().is_empty())
    };
    match (note("nl"), note("en")) {
        (true, false) => Err(Refused::MissingName("note.en".into())),
        (false, true) => Err(Refused::MissingName("note.nl".into())),
        _ => Ok(()),
    }
}

/// A recipe's `source` (Kenny, 29/10/2026: where an imported recipe came from): absent, null or empty, or an http(s)
/// address with a host, at most 2000 characters.
fn source(v: Option<&Value>, at: &str) -> Result<(), Refused> {
    let bad = || Refused::BadSource(at.into());
    match v {
        None | Some(Value::Null) => Ok(()),
        Some(Value::String(s)) if s.trim().is_empty() => Ok(()),
        Some(Value::String(s)) if s.len() <= 2000 => {
            let url = reqwest::Url::parse(s.trim()).map_err(|_| bad())?;
            if matches!(url.scheme(), "http" | "https") && url.host_str().is_some() {
                Ok(())
            } else {
                Err(bad())
            }
        }
        Some(_) => Err(bad()),
    }
}
