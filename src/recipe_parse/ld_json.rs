//! Reading a page: the JSON-LD recipe node, with the DOM-step fallback for pages whose JSON-LD is short.

use reqwest::Url;
use serde_json::Value;

use super::fields::{dom_steps, image_of, minutes_field, portions_of, steps_of};
use super::text::clean;
use super::{Imported, MAX_LINES};

/// The contents of every `<script type="application/ld+json">` block of a page.
pub fn ld_json_blocks(html: &str) -> Vec<&str> {
    let lower = html.to_ascii_lowercase();
    let mut blocks = Vec::new();
    let mut at = 0;
    while let Some(i) = lower[at..].find("<script") {
        let start = at + i;
        let Some(gt) = lower[start..].find('>') else {
            break;
        };
        let tag = &lower[start..start + gt];
        let body_from = start + gt + 1;
        let end = lower[body_from..]
            .find("</script")
            .map_or(html.len(), |e| body_from + e);
        if tag.contains("application/ld+json") {
            blocks.push(&html[body_from..end]);
        }
        at = end.max(body_from);
    }
    blocks
}

/// Whether a node's `@type` names a recipe (a string, or an array holding one; `schema:Recipe` counts).
fn is_recipe(node: &Value) -> bool {
    let names = |v: &Value| {
        v.as_str()
            .map(|s| {
                s.rsplit([':', '/'])
                    .next()
                    .unwrap_or(s)
                    .eq_ignore_ascii_case("recipe")
            })
            .unwrap_or(false)
    };
    match node.get("@type") {
        Some(Value::Array(a)) => a.iter().any(names),
        Some(v) => names(v),
        None => false,
    }
}

/// The first recipe node in a parsed block.
fn find_recipe(v: &Value, depth: usize) -> Option<&Value> {
    if depth > 6 {
        return None;
    }
    match v {
        Value::Array(a) => a.iter().find_map(|x| find_recipe(x, depth + 1)),
        Value::Object(o) => {
            if is_recipe(v) {
                return Some(v);
            }
            for key in ["@graph", "mainEntity", "mainEntityOfPage"] {
                if let Some(found) = o.get(key).and_then(|x| find_recipe(x, depth + 1)) {
                    return Some(found);
                }
            }
            None
        }
        _ => None,
    }
}

/// The JSON inside a script block, without the comment and CDATA wrappers some pages put around it.
fn json_of(block: &str) -> Option<Value> {
    let trimmed = block.trim().trim_start_matches('\u{feff}');
    let trimmed = trimmed
        .trim_start_matches("<!--")
        .trim_end_matches("-->")
        .trim_start_matches("//<![CDATA[")
        .trim_end_matches("//]]>")
        .trim();
    serde_json::from_str::<Value>(trimmed).ok()
}

/// The instructions of a recipe node; the page's own steps when they are more.
fn steps_for(r: &Value, html: &str) -> Vec<String> {
    let mut steps = Vec::new();
    if let Some(i) = r.get("recipeInstructions") {
        steps_of(i, &mut steps, 0);
    }
    let shown = dom_steps(html);
    if shown.len() > steps.len() {
        steps = shown;
    }
    steps
}

/// The ingredient lines of a recipe node: an array of strings, or one string with line breaks.
fn ingredients_of(r: &Value) -> Vec<String> {
    match r.get("recipeIngredient").or_else(|| r.get("ingredients")) {
        Some(Value::Array(a)) => a
            .iter()
            .filter_map(Value::as_str)
            .map(clean)
            .filter(|l| !l.is_empty())
            .take(MAX_LINES)
            .collect(),
        Some(Value::String(s)) => s
            .split('\n')
            .map(clean)
            .filter(|l| !l.is_empty())
            .take(MAX_LINES)
            .collect(),
        _ => Vec::new(),
    }
}

/// The recipe a page describes, or none when it has no readable recipe block.
pub fn from_page(html: &str, page: Option<&Url>) -> Option<Imported> {
    for block in ld_json_blocks(html) {
        let Some(json) = json_of(block) else {
            continue;
        };
        let Some(r) = find_recipe(&json, 0) else {
            continue;
        };
        let found = Imported {
            name: r
                .get("name")
                .and_then(Value::as_str)
                .map(clean)
                .unwrap_or_default(),
            portions: r.get("recipeYield").and_then(portions_of),
            ingredients: ingredients_of(r),
            steps: steps_for(r, html),
            prep: minutes_field(r, "prepTime"),
            cook: minutes_field(r, "cookTime"),
            total: minutes_field(r, "totalTime"),
            image_url: r.get("image").and_then(|i| image_of(i, page)),
            source_url: page.map(Url::to_string),
        };
        if found.usable() {
            return Some(found);
        }
    }
    None
}
