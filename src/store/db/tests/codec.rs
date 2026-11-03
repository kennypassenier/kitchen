//! The codec keeps every value as it was: a value that does not fit its column, a key no column knows, an empty list
//! next to an absent one, numbers as integers or floats.

use serde_json::json;

use super::super::import::verify;
use super::{Data, empty_db, round_trip};

#[test]
fn odd_values_round_trip_through_k_extra_unchanged() {
    let db = empty_db();
    let mut d = Data::empty();
    d.dishes.push(serde_json::json!({
        "id": "d1", "name": {"nl": "A"}, "category": null, "parents": "yes", "rev": 3, "page_field": [1, {"x": 2.0}],
        "ingredients": [], "sides": [{"ingredients": ["i1", 7]}],
        "recipes": [{"id": "r", "minutes": 2.0, "portions": 4, "amount_huge": 18446744073709551615u64,
                     "steps": [{"id": "s", "timer": null, "text": "plain", "note": {"nl": "n", "en": "e", "x": 1}}],
                     "tools": [], "meals": ["dinner"]}]
    }));
    let got = round_trip(&db, &d);
    verify::same(&got, &d).unwrap();
}

#[test]
fn an_empty_list_and_an_absent_key_stay_apart() {
    let db = empty_db();
    let mut d = Data::empty();
    d.dishes.push(json!({"id": "a", "recipes": []}));
    d.dishes.push(json!({"id": "b"}));
    let got = round_trip(&db, &d);
    assert_eq!(got.dishes[0]["recipes"], json!([]));
    assert!(got.dishes[1].get("recipes").is_none());
}

#[test]
fn settings_with_an_unknown_key_and_their_revision_round_trip() {
    let db = empty_db();
    let mut d = Data::empty();
    d.settings = json!({"dinner_time": "18:30", "spare": 7.5, "future": {"a": 1}})
        .as_object()
        .unwrap()
        .clone();
    d.settings_rev = 4;
    let got = round_trip(&db, &d);
    assert_eq!((got.settings, got.settings_rev), (d.settings, 4));
}

#[test]
fn a_difference_names_its_place() {
    let a = json!({"recipes": [{"steps": [{"text": "x"}]}]});
    let b = json!({"recipes": [{"steps": [{"text": "y"}]}]});
    let diff = verify::first_difference(&a, &b, "dishes[0]").unwrap();
    assert!(
        diff.starts_with("dishes[0].recipes[0].steps[0].text:"),
        "{diff}"
    );
    assert_eq!(verify::first_difference(&a, &a, "x"), None);
}
