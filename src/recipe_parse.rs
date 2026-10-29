//! Reading a recipe out of a web page or pasted text (Kenny, 29/10/2026 14:27).
//!
//! Pure functions, no network and no disk, so the fixtures in the tests below
//! cover them. Two sources end in the same [`Imported`] shape:
//!
//! * a page: every `<script type="application/ld+json">` block is parsed as
//!   JSON; the first `Recipe` node (top level, in an array, in `@graph` or in
//!   `mainEntity`) is read. No HTML parser: a small scanner finds the blocks;
//! * pasted text: split by headings (Ingredients / Method, Dutch or English)
//!   into ingredient lines and step lines, bullets and numbers stripped.
//!
//! Nothing here is trusted: every string is stripped of tags and entities,
//! whitespace is collapsed and lists are capped.

use reqwest::Url;
use serde_json::{Value, json};

/// The most ingredient lines or steps one import returns.
const MAX_LINES: usize = 200;
/// The longest a single line may be (characters).
const MAX_LINE: usize = 2000;

/// A recipe as the import page needs it.
#[derive(Debug, Default, PartialEq)]
pub struct Imported {
    pub name: String,
    pub portions: Option<u32>,
    pub ingredients: Vec<String>,
    pub steps: Vec<String>,
    pub prep: Option<u32>,
    pub cook: Option<u32>,
    pub total: Option<u32>,
    pub image_url: Option<String>,
    pub source_url: Option<String>,
}

impl Imported {
    pub fn to_json(&self) -> Value {
        json!({
            "name": self.name,
            "portions": self.portions,
            "ingredients": self.ingredients,
            "steps": self.steps,
            "minutes": { "prep": self.prep, "cook": self.cook, "total": self.total },
            "image_url": self.image_url,
            "source_url": self.source_url,
        })
    }

    /// Something worth opening an editor for.
    pub fn usable(&self) -> bool {
        !self.ingredients.is_empty() || !self.steps.is_empty()
    }
}

// ---- text clean-up ------------------------------------------------------------------------------------------------

/// Decode the entities pages put inside JSON strings. Unknown ones stay as written.
fn decode_entities(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut rest = s;
    while let Some(i) = rest.find('&') {
        out.push_str(&rest[..i]);
        let tail = &rest[i..];
        match tail.find(';').filter(|&e| e <= 10) {
            Some(e) => {
                let name = &tail[1..e];
                let ch = match name {
                    "amp" => Some('&'),
                    "lt" => Some('<'),
                    "gt" => Some('>'),
                    "quot" => Some('"'),
                    "apos" => Some('\''),
                    "nbsp" => Some(' '),
                    _ => name
                        .strip_prefix('#')
                        .and_then(|n| {
                            n.strip_prefix(['x', 'X'])
                                .map(|h| u32::from_str_radix(h, 16).ok())
                                .unwrap_or_else(|| n.parse().ok())
                        })
                        .and_then(char::from_u32),
                };
                match ch {
                    Some(c) => {
                        out.push(c);
                        rest = &tail[e + 1..];
                    }
                    None => {
                        out.push('&');
                        rest = &tail[1..];
                    }
                }
            }
            None => {
                out.push('&');
                rest = &tail[1..];
            }
        }
    }
    out.push_str(rest);
    out
}

/// Tags removed, entities decoded, whitespace collapsed, length capped. `<br>` and block ends become a space.
pub fn clean(s: &str) -> String {
    let mut text = String::with_capacity(s.len());
    let mut in_tag = false;
    for c in s.chars() {
        match c {
            '<' => in_tag = true,
            '>' if in_tag => {
                in_tag = false;
                text.push(' ');
            }
            _ if !in_tag => text.push(c),
            _ => {}
        }
    }
    // A lone '<' that never closed leaves the rest as text, not as nothing.
    if in_tag && !s.contains('>') {
        return clean(&s.replace('<', " "));
    }
    let decoded = decode_entities(&text);
    let one: String = decoded.split_whitespace().collect::<Vec<_>>().join(" ");
    one.chars().take(MAX_LINE).collect()
}

// ---- JSON-LD in a page --------------------------------------------------------------------------------------------

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
fn portions_of(v: &Value) -> Option<u32> {
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
fn image_of(v: &Value, base: Option<&Url>) -> Option<String> {
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

#[derive(PartialEq, Clone, Copy)]
enum Part {
    Head,
    Ingredients,
    Steps,
}

/// Which part a heading line opens, if it is one.
fn heading(line: &str) -> Option<Part> {
    let l = line
        .trim()
        .trim_start_matches(['#', '*', '_', '-', ' '])
        .trim_end_matches([':', '*', '_', ' '])
        .to_lowercase();
    match l.as_str() {
        "ingrediënten" | "ingredienten" | "ingredients" | "ingrediënten:" => {
            Some(Part::Ingredients)
        }
        "bereiding" | "bereidingswijze" | "werkwijze" | "instructions" | "instructies"
        | "method" | "steps" | "directions" | "stappen" | "preparation" => Some(Part::Steps),
        _ => None,
    }
}

/// A bullet or a number ("- ", "• ", "1. ", "2) ", "Step 3: ", "Stap 3.") taken off the front of a line.
pub fn strip_marker(line: &str) -> String {
    let mut s = line.trim();
    loop {
        let before = s;
        s = s
            .trim_start_matches(['-', '*', '•', '–', '—', '·', '▪', '☐', '□', '✓'])
            .trim_start();
        for word in ["step", "stap"] {
            if s.len() > word.len()
                && s.is_char_boundary(word.len())
                && s[..word.len()].eq_ignore_ascii_case(word)
            {
                let rest = s[word.len()..].trim_start();
                let digits = rest.chars().take_while(char::is_ascii_digit).count();
                if digits > 0 {
                    s = rest[digits..].trim_start_matches([':', '.', ')', '-', ' ']);
                }
            }
        }
        let digits = s.chars().take_while(char::is_ascii_digit).count();
        if digits > 0 && digits <= 3 {
            let tail = &s[digits..];
            if let Some(rest) = tail.strip_prefix(['.', ')']).filter(|r| r.starts_with(' ')) {
                s = rest.trim_start();
            }
        }
        if s == before {
            break;
        }
    }
    s.to_string()
}

/// Does a line start like an ingredient (a digit, a vulgar fraction)?
fn starts_with_amount(line: &str) -> bool {
    line.chars()
        .next()
        .is_some_and(|c| c.is_ascii_digit() || "½¼¾⅓⅔⅛".contains(c))
}

/// Pasted text, split by its headings. Without headings, lines that start with an amount are ingredients and the
/// rest are steps. The first line before the first heading is the name when it is not itself a list line.
pub fn from_text(text: &str) -> Imported {
    let mut out = Imported::default();
    let mut part = Part::Head;
    let mut seen_heading = false;
    let mut head: Vec<String> = Vec::new();
    let mut loose: Vec<String> = Vec::new();
    for raw in text.lines() {
        let line = raw.trim();
        if line.is_empty() {
            continue;
        }
        if let Some(p) = heading(line) {
            part = p;
            seen_heading = true;
            continue;
        }
        let item = strip_marker(&clean(line));
        if item.is_empty() {
            continue;
        }
        match part {
            Part::Head => {
                head.push(item.clone());
                loose.push(item);
            }
            Part::Ingredients => {
                // "For the sauce:" is a sub-heading, not an ingredient.
                if !item.ends_with(':') && out.ingredients.len() < MAX_LINES {
                    out.ingredients.push(item);
                }
            }
            Part::Steps => {
                if out.steps.len() < MAX_LINES {
                    out.steps.push(item);
                }
            }
        }
    }
    if seen_heading {
        if let Some(first) = head.first().filter(|l| !starts_with_amount(l)) {
            out.name = first.clone();
        }
    } else {
        for line in loose {
            if starts_with_amount(&line) {
                if out.ingredients.len() < MAX_LINES {
                    out.ingredients.push(line);
                }
            } else if out.steps.len() < MAX_LINES {
                out.steps.push(line);
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const GRAPH: &str = r#"<html><head><title>x</title>
<script type="text/javascript">var a = 1;</script>
<SCRIPT TYPE="application/ld+json">
{"@context":"https://schema.org","@graph":[
 {"@type":"WebSite","name":"Site"},
 {"@type":["Recipe","NewsArticle"],"name":"Pancakes &amp; syrup",
  "recipeYield":["4","4 servings"],
  "prepTime":"PT10M","cookTime":"PT1H15M","totalTime":"PT1H25M",
  "image":{"@type":"ImageObject","url":"/img/pancakes.jpg"},
  "recipeIngredient":["200 g flour","2 eggs","<b>1 tbsp</b> sugar"],
  "recipeInstructions":[
    {"@type":"HowToSection","name":"Batter","itemListElement":[
      {"@type":"HowToStep","text":"Mix the flour and eggs."},
      {"@type":"HowToStep","text":"Rest 10 minutes."}]},
    {"@type":"HowToStep","text":"Fry in a pan."}]}
]}
</script></head><body></body></html>"#;

    fn page() -> Url {
        Url::parse("https://example.com/recipes/pancakes").unwrap()
    }

    #[test]
    fn a_recipe_in_a_graph_with_sections_and_a_relative_image() {
        let r = from_page(GRAPH, Some(&page())).unwrap();
        assert_eq!(r.name, "Pancakes & syrup");
        assert_eq!(r.portions, Some(4));
        assert_eq!(r.ingredients, ["200 g flour", "2 eggs", "1 tbsp sugar"]);
        assert_eq!(
            r.steps,
            [
                "Mix the flour and eggs.",
                "Rest 10 minutes.",
                "Fry in a pan."
            ]
        );
        assert_eq!((r.prep, r.cook, r.total), (Some(10), Some(75), Some(85)));
        assert_eq!(
            r.image_url.as_deref(),
            Some("https://example.com/img/pancakes.jpg")
        );
        assert_eq!(
            r.source_url.as_deref(),
            Some("https://example.com/recipes/pancakes")
        );
    }

    /// A real Dagelijkse Kost page (fetched 29/10/2026, cut down to its recipe block and instruction list): the
    /// JSON-LD names two steps, the page shows all of them.
    #[test]
    fn dagelijkse_kost_steps_come_from_the_page_when_the_block_has_only_two() {
        let html = include_str!("../tests/fixtures/dagelijkse-kost-daube.html");
        let url = Url::parse(
            "https://dagelijksekost.vrt.be/gerechten/daube-varkenswangen-geglaceerde-wortel",
        )
        .unwrap();
        let r = from_page(html, Some(&url)).unwrap();
        assert_eq!(r.portions, Some(4));
        assert_eq!(r.ingredients.len(), 30);
        assert_eq!(r.steps.len(), 20);
        assert_eq!(r.steps[0], "Kruid de varkenswangen met peper en zout.");
        assert!(r.steps[2].starts_with("Doe de wangen in een kom"));
    }

    /// The sites on the "Recipe sources" list (Kenny, 29/10/2026 15:11): the recipe block of one real page each, fetched
    /// through the import on that day and cut down to the block. A site is on the list only while its fixture reads.
    #[test]
    fn the_verified_recipe_sources_read_whole() {
        // (page, name, portions, ingredients, steps, prep, cook)
        let cases = [
            (
                include_str!("../tests/fixtures/bbc-good-food-pancakes.html"),
                "Easy pancakes",
                12,
                6,
                5,
                Some(10),
                Some(20),
            ),
            (
                include_str!("../tests/fixtures/simply-recipes-guacamole.html"),
                "How to Make the Best Guacamole",
                4,
                10,
                5,
                Some(10),
                None,
            ),
            (
                include_str!("../tests/fixtures/recipetin-eats-fried-rice.html"),
                "Chicken Fried Rice",
                4,
                16,
                9,
                Some(10),
                Some(10),
            ),
            (
                include_str!("../tests/fixtures/24kitchen-carbonara.html"),
                "Originele spaghetti carbonara",
                4,
                6,
                7,
                Some(15),
                None,
            ),
            (
                include_str!("../tests/fixtures/leukerecepten-carbonara.html"),
                "Pasta carbonara: romige klassieker",
                4,
                6,
                8,
                Some(10),
                Some(15),
            ),
        ];
        for (html, name, portions, ingredients, steps, prep, cook) in cases {
            let r = from_page(html, None).unwrap_or_else(|| panic!("{name} did not read"));
            assert_eq!(r.name, name);
            assert_eq!(r.portions, Some(portions), "{name} portions");
            assert_eq!(r.ingredients.len(), ingredients, "{name} ingredients");
            assert_eq!(r.steps.len(), steps, "{name} steps");
            assert_eq!(r.prep, prep, "{name} prep");
            assert_eq!(r.cook, cook, "{name} cook");
            assert!(r.image_url.is_some(), "{name} photo");
        }
    }

    #[test]
    fn a_page_without_a_recipe_block_is_none() {
        assert!(from_page("<html><script type=\"application/ld+json\">{\"@type\":\"Article\"}</script></html>", None).is_none());
        assert!(from_page("<html>no scripts</html>", None).is_none());
        assert!(from_page("<script type=\"application/ld+json\">{broken", None).is_none());
    }

    #[test]
    fn a_recipe_on_the_top_level_with_a_string_method() {
        let html = r#"<script type="application/ld+json">{"@type":"Recipe","name":"Soup",
          "recipeYield":6,"recipeIngredient":["1 onion"],
          "recipeInstructions":"1. Chop the onion.\n2. Boil it.<br>Serve."}</script>"#;
        let r = from_page(html, None).unwrap();
        assert_eq!(r.portions, Some(6));
        assert_eq!(r.steps, ["Chop the onion.", "Boil it.", "Serve."]);
        assert_eq!(r.image_url, None);
    }

    #[test]
    fn the_second_block_is_read_when_the_first_has_no_recipe() {
        let html = r#"<script type="application/ld+json">{"@type":"Organization"}</script>
        <script type="application/ld+json">[{"@type":"Recipe","name":"B","recipeIngredient":["x"]}]</script>"#;
        assert_eq!(from_page(html, None).unwrap().name, "B");
    }

    #[test]
    fn iso_durations_become_minutes() {
        assert_eq!(iso_minutes("PT1H15M"), Some(75));
        assert_eq!(iso_minutes("PT45M"), Some(45));
        assert_eq!(iso_minutes("P0DT20M"), Some(20));
        assert_eq!(iso_minutes("P1DT2H"), Some(1560));
        assert_eq!(iso_minutes("PT90S"), Some(2));
        assert_eq!(iso_minutes("pt30m"), Some(30));
        assert_eq!(iso_minutes("PT0M"), None);
        assert_eq!(iso_minutes("P1Y"), None);
        assert_eq!(iso_minutes("45 minutes"), None);
        assert_eq!(iso_minutes(""), None);
    }

    #[test]
    fn image_forms() {
        let base = page();
        let one = |s: &str| image_of(&serde_json::from_str(s).unwrap(), Some(&base));
        assert_eq!(
            one(r#""https://cdn.example.org/a.jpg""#).as_deref(),
            Some("https://cdn.example.org/a.jpg")
        );
        assert_eq!(
            one(r#"["https://cdn.example.org/a.jpg","b.jpg"]"#).as_deref(),
            Some("https://cdn.example.org/a.jpg")
        );
        assert_eq!(
            one(r#"{"@type":"ImageObject","url":"https://cdn.example.org/o.png"}"#).as_deref(),
            Some("https://cdn.example.org/o.png")
        );
        assert_eq!(
            one(r#"[{"url":"x.webp"}]"#).as_deref(),
            Some("https://example.com/recipes/x.webp")
        );
        assert_eq!(one(r#""javascript:alert(1)""#), None);
        assert_eq!(one(r#""data:image/png;base64,AAAA""#), None);
        assert_eq!(one("42"), None);
    }

    #[test]
    fn the_yield_takes_the_first_number() {
        let p = |s: &str| portions_of(&serde_json::from_str(s).unwrap());
        assert_eq!(p(r#""4-6 people""#), Some(4));
        assert_eq!(p(r#"["Serves 8"]"#), Some(8));
        assert_eq!(p(r#""many""#), None);
        assert_eq!(p("0"), None);
    }

    #[test]
    fn entities_and_tags_are_cleaned() {
        assert_eq!(
            clean("  Tom &amp; Jerry&#39;s <i>big</i>\n pie&nbsp;&#x41; "),
            "Tom & Jerry's big pie A"
        );
        assert_eq!(clean("a &unknown; b"), "a &unknown; b");
        assert_eq!(clean("1 < 2 without close"), "1 2 without close");
    }

    #[test]
    fn dutch_text_is_split_by_its_headings() {
        let text = "Pannenkoeken\n\nIngrediënten\n- 250 g bloem\n• 2 eieren\nVoor de saus:\n1/2 l melk\n\nBereiding:\n1. Meng alles.\n2) Bak 3 minuten per kant.\nStap 3: Serveer.";
        let r = from_text(text);
        assert_eq!(r.name, "Pannenkoeken");
        assert_eq!(r.ingredients, ["250 g bloem", "2 eieren", "1/2 l melk"]);
        assert_eq!(
            r.steps,
            ["Meng alles.", "Bak 3 minuten per kant.", "Serveer."]
        );
        assert_eq!(r.source_url, None);
    }

    #[test]
    fn english_text_with_markdown_headings() {
        let text = "## Ingredients\n* 1 cup rice\n* 2 cloves garlic\n\n## Method\n1. Rinse the rice.\n2. Cook it for 10 minutes.";
        let r = from_text(text);
        assert_eq!(r.name, "");
        assert_eq!(r.ingredients, ["1 cup rice", "2 cloves garlic"]);
        assert_eq!(r.steps, ["Rinse the rice.", "Cook it for 10 minutes."]);
        for h in ["Directions", "INSTRUCTIONS:", "Steps", "Werkwijze"] {
            assert_eq!(from_text(&format!("{h}\nDo it.")).steps, ["Do it."], "{h}");
        }
    }

    #[test]
    fn text_without_headings_splits_on_amounts() {
        let r = from_text("200 g flour\n2 eggs\nMix them well.\nBake.");
        assert_eq!(r.ingredients, ["200 g flour", "2 eggs"]);
        assert_eq!(r.steps, ["Mix them well.", "Bake."]);
        assert!(!from_text("   \n \n").usable());
    }

    #[test]
    fn markers_come_off_but_amounts_stay() {
        assert_eq!(strip_marker("1.5 kg potatoes"), "1.5 kg potatoes");
        assert_eq!(strip_marker("12. Serve"), "Serve");
        assert_eq!(strip_marker("- 3 eggs"), "3 eggs");
        assert_eq!(strip_marker("1 2 eggs"), "1 2 eggs");
    }
}
