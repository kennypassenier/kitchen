//! Text clean-up shared by both readers: tags stripped, entities decoded, whitespace collapsed, length capped.

use super::MAX_LINE;

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
