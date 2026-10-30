//! Reading pasted text: split by its headings into ingredient lines and step lines.

use super::text::clean;
use super::{Imported, MAX_LINES};

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
