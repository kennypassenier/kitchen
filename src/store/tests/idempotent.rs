//! A freezer take once per `Idempotency-Key` (feat-offline-take-1). Written 02/11/2026, not run (Kenny's test rule).

use serde_json::json;

use super::*;
use crate::store::idempotent::ANSWERS_KEEP;

async fn soup(s: &Store, portions: i64) -> String {
    let p = s
        .create(
            "freezer",
            json!({"dish": {"nl": "Soep", "en": "Soup"}, "portions": portions}),
        )
        .await
        .unwrap();
    p["id"].as_str().unwrap().to_owned()
}

#[tokio::test]
async fn a_repeated_key_answers_the_first_take_and_takes_nothing_more() {
    let s = Store::in_memory(empty());
    let id = soup(&s, 3).await;
    let first = s.take_portions_once(&id, 1, Some("k-1")).await.unwrap();
    assert_eq!(first["portions"], 2);
    let again = s.take_portions_once(&id, 1, Some("k-1")).await.unwrap();
    assert_eq!(again, first, "the repeat gets the first answer");
    assert_eq!(
        s.list("freezer").await.unwrap()[0]["portions"],
        2,
        "only one portion left the freezer"
    );
}

#[tokio::test]
async fn another_key_or_no_key_takes_again() {
    let s = Store::in_memory(empty());
    let id = soup(&s, 3).await;
    s.take_portions_once(&id, 1, Some("k-1")).await.unwrap();
    assert_eq!(
        s.take_portions_once(&id, 1, Some("k-2")).await.unwrap()["portions"],
        1
    );
    assert_eq!(
        s.take_portions_once(&id, 1, None).await.unwrap()["portions"],
        0
    );
}

#[tokio::test]
async fn a_refused_take_records_no_key() {
    let s = Store::in_memory(empty());
    let id = soup(&s, 0).await;
    assert_eq!(
        s.take_portions_once(&id, 1, Some("k-1")).await,
        Err(Refused::NoPortionsLeft)
    );
    assert!(s.snapshot().await.answered.is_empty());
    // Put one back without a key (Undo), then the same key takes it: it was never answered.
    s.take_portions(&id, -1).await.unwrap();
    assert_eq!(
        s.take_portions_once(&id, 1, Some("k-1")).await.unwrap()["portions"],
        0
    );
}

#[tokio::test]
async fn only_the_last_keys_are_kept() {
    let s = Store::in_memory(empty());
    let id = soup(&s, 0).await;
    for i in 0..(ANSWERS_KEEP + 5) {
        // Alternate put-back and take so every call succeeds and records its key.
        let n = if i % 2 == 0 { -1 } else { 1 };
        s.take_portions_once(&id, n, Some(&format!("k-{i}")))
            .await
            .unwrap();
    }
    let answered = s.snapshot().await.answered;
    assert_eq!(answered.len(), ANSWERS_KEEP);
    assert_eq!(answered[0].key, "k-5", "the oldest went first");
}

#[tokio::test]
async fn the_keys_survive_a_reopen_of_the_file() {
    let dir = tempfile::tempdir().unwrap();
    let id = {
        let s = Store::open(dir.path()).unwrap();
        let id = soup(&s, 2).await;
        s.take_portions_once(&id, 1, Some("k-1")).await.unwrap();
        id
    };
    let s = Store::open(dir.path()).unwrap();
    assert_eq!(
        s.take_portions_once(&id, 1, Some("k-1")).await.unwrap()["portions"],
        1
    );
    assert_eq!(s.list("freezer").await.unwrap()[0]["portions"], 1);
}
