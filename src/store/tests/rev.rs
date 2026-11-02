//! fix-stale-save-1: an item's `rev`, bumped on every replace, and the `If-Match` check that refuses a stale save.
//! Since refactor-rev-kit-1 the precondition and the refusal are the kit's (`chassis::core::revision`).

use super::*;
use chassis::core::revision::Precondition;

fn dish(nl: &str) -> serde_json::Value {
    serde_json::json!({"name": {"nl": nl, "en": nl}, "recipes": []})
}

#[tokio::test]
async fn every_replace_bumps_the_revision_and_ignores_a_sent_one() {
    let s = Store::in_memory(empty());
    let made = s.create("dishes", dish("a")).await.unwrap();
    let id = made["id"].as_str().unwrap();
    assert_eq!(
        made.get("rev"),
        None,
        "a new item has no rev: it counts as 0"
    );
    let mut body = dish("b");
    body["rev"] = serde_json::json!(41);
    let one = s.replace("dishes", id, body).await.unwrap();
    assert_eq!(one["rev"], 1, "the server's count, not the page's");
    let two = s
        .replace_if("dishes", id, dish("c"), Some(Precondition::Rev(1)))
        .await
        .unwrap();
    assert_eq!(two["rev"], 2);
}

#[tokio::test]
async fn a_stale_revision_is_refused_and_changes_nothing() {
    let s = Store::in_memory(empty());
    let id = s.create("dishes", dish("a")).await.unwrap()["id"]
        .as_str()
        .unwrap()
        .to_string();
    // Tab A and tab B both opened it at rev 0; A saves first.
    s.replace_if("dishes", &id, dish("from A"), Some(Precondition::Rev(0)))
        .await
        .unwrap();
    let b = s
        .replace_if("dishes", &id, dish("from B"), Some(Precondition::Rev(0)))
        .await;
    assert!(
        matches!(b, Err(Refused::Stale(stale)) if stale.current == 1),
        "{b:?}"
    );
    let now = s.list("dishes").await.unwrap();
    assert_eq!(now[0]["name"]["nl"], "from A");
    assert_eq!(now[0]["rev"], 1);
}

#[tokio::test]
async fn without_if_match_the_last_save_wins_as_before() {
    let s = Store::in_memory(empty());
    let id = s.create("dishes", dish("a")).await.unwrap()["id"]
        .as_str()
        .unwrap()
        .to_string();
    s.replace_if("dishes", &id, dish("A"), None).await.unwrap();
    let b = s.replace_if("dishes", &id, dish("B"), None).await.unwrap();
    assert_eq!(b["name"]["nl"], "B");
    assert_eq!(b["rev"], 2);
}

#[tokio::test]
async fn an_old_file_without_revisions_opens_at_format_5_and_counts_from_0() {
    let dir = tempfile::tempdir().unwrap();
    let old = serde_json::json!({"format": 5, "dishes": [
        {"id": "d1", "name": {"nl": "Stoofvlees", "en": "Beef stew"}, "recipes": [{"id": "r1", "steps": []}]}
    ], "recipe_sources": []});
    std::fs::write(
        dir.path().join("kitchen.json"),
        serde_json::to_vec(&old).unwrap(),
    )
    .unwrap();
    assert_eq!(FORMAT, 5, "rev is optional: no format bump");
    let s = Store::open(dir.path()).unwrap();
    assert_eq!(s.snapshot().await.format, 5);
    let body = serde_json::json!({"name": {"nl": "Stoofvlees", "en": "Beef stew"}, "recipes": []});
    let saved = s
        .replace_if("dishes", "d1", body, Some(Precondition::Rev(0)))
        .await
        .unwrap();
    assert_eq!(saved["rev"], 1);
    let back: serde_json::Value =
        serde_json::from_slice(&std::fs::read(dir.path().join("kitchen.json")).unwrap()).unwrap();
    assert_eq!(back["format"], 5);
    assert_eq!(back["dishes"][0]["rev"], 1);
}

#[tokio::test]
async fn if_match_star_saves_over_any_revision() {
    let s = Store::in_memory(empty());
    let id = s.create("dishes", dish("a")).await.unwrap()["id"]
        .as_str()
        .unwrap()
        .to_string();
    s.replace("dishes", &id, dish("b")).await.unwrap();
    let c = s
        .replace_if("dishes", &id, dish("c"), Some(Precondition::Any))
        .await
        .unwrap();
    assert_eq!(c["rev"], 2, "`*` (the kit's Any) passes and still bumps");
}
