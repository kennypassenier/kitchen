use super::super::fields::*;
use super::super::text::*;
use super::page::page;

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
