//! Reading a page: the JSON-LD recipe node, with the DOM-step fallback for pages whose JSON-LD is short.

use reqwest::Url;
use serde_json::Value;

use super::pasted::strip_marker;
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

/// Minutes of an ISO 8601 duration (`PT1H15M`, `PT45M`, `P0DT20M`, `P1DT2H`); none for zero or nonsense.
pub fn iso_minutes(s: &str) -> Option<u32> {
    let s = s.trim().to_ascii_uppercase();
    let rest = s.strip_prefix('P')?;
    let (date, time) = match rest.split_once('T') {
        Some((d, t)) => (d, t),
        None => (rest, ""),
    };
    let mut total = 0f64;
    let mut num = String::new();
    for c in date.chars() {
        match c {
            '0'..='9' | '.' | ',' => num.push(if c == ',' { '.' } else { c }),
            'W' => total += num.parse::<f64>().ok()? * 7.0 * 1440.0,
            'D' => total += num.parse::<f64>().ok()? * 1440.0,
            // Years and months have no fixed length: not a cooking time.
            _ => return None,
        }
        if matches!(c, 'W' | 'D') {
            num.clear();
        }
    }
    if !num.is_empty() {
        return None;
    }
    for c in time.chars() {
        match c {
            '0'..='9' | '.' | ',' => num.push(if c == ',' { '.' } else { c }),
            'H' => {
                total += num.parse::<f64>().ok()? * 60.0;
                num.clear();
            }
            'M' => {
                total += num.parse::<f64>().ok()?;
                num.clear();
            }
            'S' => {
                total += num.parse::<f64>().ok()? / 60.0;
                num.clear();
            }
            _ => return None,
        }
    }
    if !num.is_empty() || !(0.0..=100_000.0).contains(&total) {
        return None;
    }
    let minutes = total.round() as u32;
    (minutes > 0).then_some(minutes)
}

/// The first whole number in a yield ("4 servings", 4, ["4", "4 servings"], "4-6 people").
pub(super) fn portions_of(v: &Value) -> Option<u32> {
    let n = match v {
        Value::Number(n) => n.as_u64().map(|x| x as u32),
        Value::String(s) => {
            let digits: String = s
                .chars()
                .skip_while(|c| !c.is_ascii_digit())
                .take_while(char::is_ascii_digit)
                .collect();
            digits.parse().ok()
        }
        Value::Array(a) => a.iter().find_map(portions_of),
        _ => None,
    };
    n.filter(|&x| (1..=1000).contains(&x))
}

/// Instruction text from every shape schema.org allows: a string (split by lines), an array, `HowToStep { text }`,
/// `HowToSection { itemListElement }`.
fn steps_of(v: &Value, out: &mut Vec<String>, depth: usize) {
    if depth > 6 || out.len() >= MAX_LINES {
        return;
    }
    match v {
        Value::String(s) => {
            // A single string may hold the whole method with its own line breaks or <li> tags.
            let broken = s
                .replace("<br>", "\n")
                .replace("<br/>", "\n")
                .replace("<br />", "\n")
                .replace("</li>", "\n")
                .replace("</p>", "\n");
            for line in broken.split('\n') {
                let line = strip_marker(&clean(line));
                if !line.is_empty() {
                    out.push(line);
                }
            }
        }
        Value::Array(a) => a.iter().for_each(|x| steps_of(x, out, depth + 1)),
        Value::Object(o) => {
            if let Some(items) = o.get("itemListElement") {
                steps_of(items, out, depth + 1);
            } else if let Some(text) = o.get("text").or_else(|| o.get("name")) {
                steps_of(text, out, depth + 1);
            }
        }
        _ => {}
    }
}

/// An image address from a string, an array, or an `ImageObject { url }`, resolved against the page.
pub(super) fn image_of(v: &Value, base: Option<&Url>) -> Option<String> {
    let raw = match v {
        Value::String(s) => Some(s.trim().to_string()),
        Value::Array(a) => a.iter().find_map(|x| image_of(x, base)),
        Value::Object(o) => o
            .get("url")
            .or_else(|| o.get("contentUrl"))
            .and_then(|u| image_of(u, base)),
        _ => None,
    }?;
    let url = match base {
        Some(b) => b.join(&raw).ok()?,
        None => Url::parse(&raw).ok()?,
    };
    matches!(url.scheme(), "http" | "https").then(|| url.to_string())
}

fn minutes_field(r: &Value, key: &str) -> Option<u32> {
    r.get(key).and_then(Value::as_str).and_then(iso_minutes)
}

/// The instructions a page shows in its HTML when its JSON-LD gives fewer (Kenny, 29/10/2026: Dagelijkse Kost lists only
/// the first two steps in the recipe block and the rest in `data-testid="recipe-instruction"` blocks): the first
/// paragraph after each marker.
fn dom_steps(html: &str) -> Vec<String> {
    const MARK: &str = "data-testid=\"recipe-instruction\"";
    let mut out = Vec::new();
    let mut at = 0;
    while let Some(i) = html[at..].find(MARK) {
        let from = at + i + MARK.len();
        let next = html[from..].find(MARK).map_or(html.len(), |n| from + n);
        let block = &html[from..next];
        if let Some(p) = block.find("<p") {
            let after = &block[p..];
            if let (Some(open), Some(close)) = (after.find('>'), after.find("</p>"))
                && open < close
            {
                let text = clean(&after[open + 1..close]);
                // The page repeats its list further down (a preview of the first steps): the first step again ends it.
                if out.first() == Some(&text) {
                    break;
                }
                if !text.is_empty() {
                    out.push(text);
                }
            }
        }
        at = next;
        if out.len() >= MAX_LINES {
            break;
        }
    }
    out
}

/// The recipe a page describes, or none when it has no readable recipe block.
pub fn from_page(html: &str, page: Option<&Url>) -> Option<Imported> {
    for block in ld_json_blocks(html) {
        let trimmed = block.trim().trim_start_matches('\u{feff}');
        let trimmed = trimmed
            .trim_start_matches("<!--")
            .trim_end_matches("-->")
            .trim_start_matches("//<![CDATA[")
            .trim_end_matches("//]]>")
            .trim();
        let Ok(json) = serde_json::from_str::<Value>(trimmed) else {
            continue;
        };
        let Some(r) = find_recipe(&json, 0) else {
            continue;
        };
        let mut steps = Vec::new();
        if let Some(i) = r.get("recipeInstructions") {
            steps_of(i, &mut steps, 0);
        }
        let shown = dom_steps(html);
        if shown.len() > steps.len() {
            steps = shown;
        }
        let ingredients: Vec<String> =
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
            };
        let found = Imported {
            name: r
                .get("name")
                .and_then(Value::as_str)
                .map(clean)
                .unwrap_or_default(),
            portions: r.get("recipeYield").and_then(portions_of),
            ingredients,
            steps,
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

// ---- pasted text --------------------------------------------------------------------------------------------------
