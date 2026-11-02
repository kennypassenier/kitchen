//! fix-offline-master-5 (Kenny 02/11/2026 19:43, "de server is altijd de master"): a delete and a settings merge are
//! checked against `If-Match` like a replace, so a stale one queued offline can never silently beat a newer change.

use super::*;
use chassis::core::revision::Precondition;
use serde_json::json;

fn dish(nl: &str) -> serde_json::Value {
    json!({"name": {"nl": nl, "en": nl}, "recipes": []})
}

/// A store with one dish saved once (rev 1); answers the store and the dish's id.
async fn saved_once() -> (Store, String) {
    let s = Store::in_memory(empty());
    let id = s.create("dishes", dish("a")).await.unwrap()["id"]
        .as_str()
        .unwrap()
        .to_string();
    s.replace("dishes", &id, dish("b")).await.unwrap();
    (s, id)
}

#[tokio::test]
async fn a_stale_delete_is_refused_and_keeps_the_newer_item() {
    let (s, id) = saved_once().await;
    // Device A read the dish at rev 0 and deleted it offline; B saved it since (rev 1).
    let refused = s.delete_if("dishes", &id, Some(Precondition::Rev(0))).await;
    assert!(
        matches!(refused, Err(Refused::Stale(stale)) if stale.current == 1),
        "{refused:?}"
    );
    let now = s.list("dishes").await.unwrap();
    assert_eq!(now.len(), 1, "nothing was removed");
    assert_eq!(now[0]["name"]["nl"], "b");
}

#[tokio::test]
async fn a_delete_at_the_stored_revision_goes_and_undo_still_restores_it() {
    let (s, id) = saved_once().await;
    let gone = s
        .delete_if("dishes", &id, Some(Precondition::Rev(1)))
        .await
        .unwrap();
    assert_eq!(gone["rev"], 1);
    assert!(s.list("dishes").await.unwrap().is_empty());
    let back = s.restore("dishes", &id).await.unwrap();
    assert_eq!(back["rev"], 1, "the undo window keeps the item as it was");
    assert_eq!(s.list("dishes").await.unwrap().len(), 1);
}

#[tokio::test]
async fn a_delete_without_if_match_behaves_as_before() {
    let (s, id) = saved_once().await;
    s.delete_if("dishes", &id, None).await.unwrap();
    assert!(s.list("dishes").await.unwrap().is_empty());
}

#[tokio::test]
async fn every_settings_merge_bumps_the_settings_revision() {
    let s = Store::in_memory(empty());
    assert_eq!(s.settings().await.1, 0, "no merge yet: 0");
    let (one, rev) = s.merge_settings(json!({"pace": "calm"})).await.unwrap();
    assert_eq!((one["pace"].as_str(), rev), (Some("calm"), 1));
    let (_, rev) = s
        .merge_settings_if(json!({"pace": "normal"}), Some(Precondition::Rev(1)))
        .await
        .unwrap();
    assert_eq!(rev, 2);
}

#[tokio::test]
async fn a_stale_settings_merge_is_refused_and_changes_nothing() {
    let s = Store::in_memory(empty());
    s.merge_settings(json!({"pace": "calm"})).await.unwrap();
    // A read the settings at 0 and changed them offline; B's merge (rev 1) came first.
    let refused = s
        .merge_settings_if(json!({"pace": "fast"}), Some(Precondition::Rev(0)))
        .await;
    assert!(
        matches!(refused, Err(Refused::Stale(stale)) if stale.current == 1),
        "{refused:?}"
    );
    let (now, rev) = s.settings().await;
    assert_eq!((now["pace"].as_str(), rev), (Some("calm"), 1));
}

#[tokio::test]
async fn a_settings_merge_without_if_match_behaves_as_before() {
    let s = Store::in_memory(empty());
    s.merge_settings(json!({"pace": "calm"})).await.unwrap();
    let (now, rev) = s
        .merge_settings_if(json!({"pace": "fast", "odds": null}), None)
        .await
        .unwrap();
    assert_eq!((now["pace"].as_str(), rev), (Some("fast"), 2));
}

#[tokio::test]
async fn an_old_file_without_a_settings_revision_opens_at_format_5_and_counts_from_0() {
    let dir = tempfile::tempdir().unwrap();
    let old = json!({"format": 5, "settings": {"pace": "calm"}, "recipe_sources": []});
    std::fs::write(
        dir.path().join("kitchen.json"),
        serde_json::to_vec(&old).unwrap(),
    )
    .unwrap();
    let s = Store::open(dir.path()).unwrap();
    assert_eq!(s.snapshot().await.format, 5);
    assert_eq!(s.settings().await.1, 0);
    s.merge_settings_if(json!({"pace": "fast"}), Some(Precondition::Rev(0)))
        .await
        .unwrap();
    let back: serde_json::Value =
        serde_json::from_slice(&std::fs::read(dir.path().join("kitchen.json")).unwrap()).unwrap();
    assert_eq!(back["format"], 5);
    assert_eq!(back["settings_rev"], 1);
    assert_eq!(back["settings"]["pace"], "fast");
}
