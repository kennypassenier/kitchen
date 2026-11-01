use std::time::{Duration, Instant};

use super::super::undo::UNDO_KEEP;
use super::*;

fn named(nl: &str) -> serde_json::Value {
    serde_json::json!({"name": {"nl": nl, "en": nl}})
}

#[tokio::test]
async fn undo_puts_the_same_item_back_at_its_place() {
    let s = Store::in_memory(empty());
    let mut ids = vec![];
    for n in ["a", "b", "c"] {
        let made = s.create("dish_categories", named(n)).await.unwrap();
        ids.push(made["id"].as_str().unwrap().to_string());
    }
    let gone = s.delete("dish_categories", &ids[1]).await.unwrap();
    let back = s.restore("dish_categories", &ids[1]).await.unwrap();
    assert_eq!(back, gone, "the same bytes, id and created stamp included");
    let now: Vec<_> = s.list("dish_categories").await.unwrap();
    let order: Vec<_> = now.iter().map(|v| v["id"].as_str().unwrap()).collect();
    assert_eq!(order, ids.iter().map(String::as_str).collect::<Vec<_>>());
    // Once back, a second Undo has nothing to restore.
    assert_eq!(
        s.restore("dish_categories", &ids[1]).await,
        Err(Refused::UndoClosed)
    );
}

#[tokio::test]
async fn undo_keeps_an_old_half_named_item_as_it_was() {
    let mut data = empty();
    data.ingredients
        .push(serde_json::json!({"id": "old", "name": {"nl": "Prei", "en": ""}}));
    let s = Store::in_memory(data);
    s.delete("ingredients", "old").await.unwrap();
    let back = s.restore("ingredients", "old").await.unwrap();
    assert_eq!(back["name"]["nl"], "Prei");
}

#[tokio::test]
async fn undo_after_the_window_or_into_the_wrong_list_is_refused() {
    let mut data = empty();
    data.log
        .push(serde_json::json!({"id": "l1", "date": "2026-11-01"}));
    data.log
        .push(serde_json::json!({"id": "l2", "date": "2026-11-01"}));
    let s = Store::in_memory(data);
    s.delete("log", "l1").await.unwrap();
    s.delete("log", "l2").await.unwrap();
    assert_eq!(s.restore("freezer", "l1").await, Err(Refused::UndoClosed));
    // l2's window is open when asked in time; l1's is closed when asked too late.
    assert!(s.restore("log", "l2").await.is_ok());
    let late = Instant::now() + UNDO_KEEP + Duration::from_secs(1);
    assert_eq!(
        s.restore_at("log", "l1", late).await,
        Err(Refused::UndoClosed)
    );
    assert_eq!(s.list("log").await.unwrap().len(), 1);
}

#[tokio::test]
async fn a_draft_is_not_kept_for_undo() {
    let s = Store::in_memory(empty());
    let d = s
        .create("drafts", serde_json::json!({"key": "r", "data": {}}))
        .await
        .unwrap();
    let id = d["id"].as_str().unwrap();
    s.delete("drafts", id).await.unwrap();
    assert_eq!(s.restore("drafts", id).await, Err(Refused::UndoClosed));
}
