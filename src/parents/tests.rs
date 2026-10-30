use serde_json::{Value, json};

use super::guard::home_only;
use super::wheel::joined;
use super::*;
use crate::store::Data;

fn data() -> Data {
    let mut d = crate::store::seed();
    d.dish_categories = vec![
        json!({"id": "c-day", "name": {"nl": "Dagelijkse kost", "en": "Everyday"}, "order": 1}),
        json!({"id": "c-special", "name": {"nl": "Speciaal", "en": "Special"}, "order": 2}),
    ];
    d.ingredients = vec![
        json!({"id": "i-stew", "name": {"nl": "Stoofvlees", "en": "Beef stew"}}),
        json!({"id": "i-fries", "name": {"nl": "Frieten", "en": "Fries"}}),
        json!({"id": "i-croq", "name": {"nl": "Kroketten", "en": "Croquettes"}}),
        json!({"id": "i-mayo", "name": {"nl": "Mayonaise", "en": "Mayonnaise"}}),
        json!({"id": "i-salad", "name": {"nl": "Sla", "en": ""}}),
    ];
    d.dishes = vec![
        json!({"id": "d1", "name": {"nl": "Stoofvlees", "en": "Beef stew"}, "parents": true, "category": "c-day",
        "ingredients": ["i-stew", "i-salad", "i-gone"],
        "sides": [
            {"ingredients": ["i-fries", "i-mayo"]},
            {"ingredients": ["i-croq", "i-mayo"], "label": {"nl": "Kroketten met mayonaise", "en": ""}},
            {"ingredients": ["i-salad"]},
            {"ingredients": ["i-gone"]}
        ]}),
        json!({"id": "d2", "name": {"nl": "Konijn", "en": ""}, "parents": true, "category": "c-special", "sides": []}),
        json!({"id": "d3", "name": {"nl": "", "en": "Shakshuka"}, "parents": true}),
        json!({"id": "d4", "name": {"nl": "Pasta", "en": "Pasta"}, "parents": false, "sides": []}),
    ];
    d
}

fn ids(w: &Value) -> Vec<&str> {
    w["dishes"]
        .as_array()
        .unwrap()
        .iter()
        .map(|d| d["id"].as_str().unwrap())
        .collect()
}

#[test]
fn a_dish_shows_in_each_language_it_has_a_name_for() {
    assert_eq!(ids(&wheel(&data(), Lang::Nl)), ["d2", "d1"]);
    assert_eq!(ids(&wheel(&data(), Lang::En)), ["d1", "d3"]);
}

#[test]
fn a_side_is_one_wheel_entry_named_by_its_label_or_its_ingredients() {
    let nl = wheel(&data(), Lang::Nl);
    let d1 = &nl["dishes"][1];
    assert_eq!(d1["ingredients"], json!(["Stoofvlees", "Sla"]));
    assert_eq!(
        d1["sides"],
        json!([
            {"name": "Frieten en mayonaise", "ingredients": ["i-fries", "i-mayo"]},
            {"name": "Kroketten met mayonaise", "ingredients": ["i-croq", "i-mayo"]},
            {"name": "Sla", "ingredients": ["i-salad"]}
        ])
    );
    // English: no English label, so the ingredients; "Sla" has no English name, so its side goes.
    let en = wheel(&data(), Lang::En);
    assert_eq!(en["dishes"][0]["ingredients"], json!(["Beef stew"]));
    assert_eq!(
        en["dishes"][0]["sides"],
        json!([
            {"name": "Fries and mayonnaise", "ingredients": ["i-fries", "i-mayo"]},
            {"name": "Croquettes and mayonnaise", "ingredients": ["i-croq", "i-mayo"]}
        ])
    );
    assert_eq!(en["dishes"][1]["sides"], json!([]));
}

#[test]
fn two_sides_may_share_an_ingredient() {
    let w = wheel(&data(), Lang::Nl);
    let sides = w["dishes"][1]["sides"].as_array().unwrap();
    let with_mayo = sides
        .iter()
        .filter(|s| {
            s["ingredients"]
                .as_array()
                .unwrap()
                .contains(&json!("i-mayo"))
        })
        .count();
    assert_eq!(with_mayo, 2);
    assert_eq!(
        joined(&["A".into(), "B".into(), "C".into()], Lang::En),
        "A, b and c"
    );
}

#[test]
fn only_the_categories_in_use_are_listed_with_their_count() {
    let w = wheel(&data(), Lang::Nl);
    assert_eq!(
        w["categories"],
        json!([
            {"id": "c-day", "name": "Dagelijkse kost", "count": 1},
            {"id": "c-special", "name": "Speciaal", "count": 1}
        ])
    );
}

#[test]
fn the_seed_leaves_the_wheel_empty() {
    let w = wheel(&crate::store::seed(), Lang::Nl);
    assert_eq!(w["dishes"], json!([]));
    assert_eq!(w["categories"], json!([]));
}

#[test]
fn only_the_home_network_is_allowed() {
    let a = Allow::parse(Allow::DEFAULT).unwrap();
    for ok in ["10.10.10.1", "10.10.10.254", "::ffff:10.10.10.20"] {
        assert!(a.allows(ok.parse().unwrap()), "{ok}");
    }
    for no in ["10.10.30.151", "192.168.1.5", "8.8.8.8", "::1"] {
        assert!(!a.allows(no.parse().unwrap()), "{no}");
    }
    let two = Allow::parse("10.10.10.0/24, 127.0.0.1").unwrap();
    assert!(two.allows("127.0.0.1".parse().unwrap()));
    assert!(Allow::parse("10.10.10.0/33").is_err());
    assert!(Allow::parse("home").is_err());
}

#[test]
fn only_the_page_and_its_data_are_kept_home() {
    assert!(home_only("/eten") && home_only("/eten/data"));
    assert!(home_only("/eten/manifest.webmanifest") && home_only("/eten/icon-180.png"));
    for open in [
        "/eten/wheel.js",
        "/eten/wheel.css",
        "/eten/eten.js",
        "/parents",
    ] {
        assert!(!home_only(open), "{open}");
    }
}

#[test]
fn the_parents_page_is_a_web_app_and_kitchen_is_not() {
    let f = Files { dir: None };
    let manifest: Value = serde_json::from_slice(&f.read("manifest.webmanifest").unwrap()).unwrap();
    assert_eq!(manifest["display"], "standalone");
    assert_eq!(manifest["start_url"], "/");
    for size in ["180", "192", "512"] {
        assert!(f.read(&format!("icon-{size}.png")).is_some(), "{size}");
    }
    let page = String::from_utf8(f.read("index.html").unwrap()).unwrap();
    assert!(page.contains("rel=\"manifest\"") && page.contains("apple-mobile-web-app-capable"));
    let kitchen = crate::FILES
        .iter()
        .find(|(p, _)| *p == "index.html")
        .map(|(_, b)| String::from_utf8_lossy(b).to_string());
    assert!(kitchen.is_some_and(|k| !k.contains("rel=\"manifest\"")));
}

#[test]
fn only_plain_file_names_are_served() {
    let f = Files { dir: None };
    assert!(f.read("index.html").is_some());
    for bad in ["../main.rs", "", ".hidden", "a/b.js", "INDEX.html"] {
        assert!(f.read(bad).is_none(), "{bad}");
    }
}
