//! The single fields of a recipe node: durations, yield, instructions, image, and the DOM-step fallback.

use reqwest::Url;
use serde_json::Value;

use super::MAX_LINES;
use super::pasted::strip_marker;
use super::text::clean;

/// Minutes in the date part of a duration (weeks and days); years and months have no fixed length, so they are no cooking time.
fn date_minutes(date: &str) -> Option<f64> {
    let mut total = 0f64;
    let mut num = String::new();
    for c in date.chars() {
        match c {
            '0'..='9' | '.' | ',' => num.push(if c == ',' { '.' } else { c }),
            'W' => total += num.parse::<f64>().ok()? * 7.0 * 1440.0,
            'D' => total += num.parse::<f64>().ok()? * 1440.0,
            _ => return None,
        }
        if matches!(c, 'W' | 'D') {
            num.clear();
        }
    }
    num.is_empty().then_some(total)
}

/// Minutes in the time part of a duration (hours, minutes, seconds).
fn time_minutes(time: &str) -> Option<f64> {
    let mut total = 0f64;
    let mut num = String::new();
    for c in time.chars() {
        match c {
            '0'..='9' | '.' | ',' => num.push(if c == ',' { '.' } else { c }),
            'H' | 'M' | 'S' => {
                let unit = match c {
                    'H' => 60.0,
                    'M' => 1.0,
                    _ => 1.0 / 60.0,
                };
                total += num.parse::<f64>().ok()? * unit;
                num.clear();
            }
            _ => return None,
        }
    }
    num.is_empty().then_some(total)
}

/// Minutes of an ISO 8601 duration (`PT1H15M`, `PT45M`, `P0DT20M`, `P1DT2H`); none for zero or nonsense.
pub fn iso_minutes(s: &str) -> Option<u32> {
    let s = s.trim().to_ascii_uppercase();
    let rest = s.strip_prefix('P')?;
    let (date, time) = rest.split_once('T').unwrap_or((rest, ""));
    let total = date_minutes(date)? + time_minutes(time)?;
    if !(0.0..=100_000.0).contains(&total) {
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
pub(super) fn steps_of(v: &Value, out: &mut Vec<String>, depth: usize) {
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

pub(super) fn minutes_field(r: &Value, key: &str) -> Option<u32> {
    r.get(key).and_then(Value::as_str).and_then(iso_minutes)
}

/// The instructions a page shows in its HTML when its JSON-LD gives fewer (Kenny, 29/10/2026: Dagelijkse Kost lists only
/// the first two steps in the recipe block and the rest in `data-testid="recipe-instruction"` blocks): the first
/// paragraph after each marker.
pub(super) fn dom_steps(html: &str) -> Vec<String> {
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
