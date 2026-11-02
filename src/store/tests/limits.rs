//! The size limits (fix-field-limits-1): at the limit is stored, one over is refused with the field and the limit.

use super::super::limits::{MAX_NAME_CHARS, MAX_STEPS, MAX_TEXT_CHARS};
use super::*;

/// A dish with one recipe whose steps are `steps`.
fn dish_with(steps: Vec<serde_json::Value>) -> serde_json::Value {
    serde_json::json!({"name": {"nl": "Soep", "en": "Soup"}, "recipes": [{"steps": steps}]})
}

#[tokio::test]
async fn a_name_half_is_at_most_the_name_limit() {
    let s = Store::in_memory(empty());
    let at = "a".repeat(MAX_NAME_CHARS);
    let ok = serde_json::json!({"name": {"nl": at, "en": "Fries"}});
    assert!(s.create("ingredients", ok).await.is_ok());
    let over = serde_json::json!({"name": {"nl": "Frieten", "en": "b".repeat(MAX_NAME_CHARS + 1)}});
    assert_eq!(
        s.create("ingredients", over).await,
        Err(Refused::TooLong {
            field: "name.en".into(),
            limit: MAX_NAME_CHARS
        })
    );
}

#[tokio::test]
async fn a_text_is_at_most_the_text_limit_counted_in_characters() {
    let s = Store::in_memory(empty());
    // "é" is two bytes: the limit counts characters, so the full limit of them is still fine.
    let at = "é".repeat(MAX_TEXT_CHARS);
    assert!(
        s.create(
            "dishes",
            dish_with(vec![serde_json::json!({"text": {"nl": at, "en": "x"}})])
        )
        .await
        .is_ok()
    );
    let over = "x".repeat(MAX_TEXT_CHARS + 1);
    assert_eq!(
        s.create(
            "dishes",
            dish_with(vec![
                serde_json::json!({"text": "a"}),
                serde_json::json!({"text": {"nl": over, "en": "x"}})
            ])
        )
        .await,
        Err(Refused::TooLong {
            field: "recipes[0].steps[1].text.nl".into(),
            limit: MAX_TEXT_CHARS
        })
    );
    let note = serde_json::json!({"dish_id": "d", "date": "2026-11-02", "note": "n".repeat(MAX_TEXT_CHARS + 1)});
    assert_eq!(
        s.create("log", note).await,
        Err(Refused::TooLong {
            field: "note".into(),
            limit: MAX_TEXT_CHARS
        })
    );
}

#[tokio::test]
async fn a_recipe_has_at_most_the_step_limit() {
    let s = Store::in_memory(empty());
    let step = || serde_json::json!({"text": "Stir"});
    assert!(
        s.create(
            "dishes",
            dish_with((0..MAX_STEPS).map(|_| step()).collect())
        )
        .await
        .is_ok()
    );
    assert_eq!(
        s.create(
            "dishes",
            dish_with((0..=MAX_STEPS).map(|_| step()).collect())
        )
        .await,
        Err(Refused::TooMany {
            field: "recipes[0].steps".into(),
            limit: MAX_STEPS
        })
    );
}

#[test]
fn a_size_refusal_carries_its_reason_field_and_limit() {
    let e = Refused::TooLong {
        field: "name.nl".into(),
        limit: MAX_NAME_CHARS,
    };
    assert_eq!(e.limit(), Some(("too_long", "name.nl", MAX_NAME_CHARS)));
    assert_eq!(Refused::NotFound.limit(), None);
}
