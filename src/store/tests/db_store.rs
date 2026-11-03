//! The store's behaviour on `kitchen.db` (feat-db-store-1): the same refusals and answers as on the file, and every
//! change in the database afterwards. Written 03/11/2026, not run (Kenny's test rule); listed in docs/OPEN.md release
//! check 16.

use chassis::core::revision::Precondition;
use serde_json::{Value, json};

use super::*;

fn dish(name: &str) -> Value {
    json!({"name": {"nl": name, "en": name}, "recipes": [{"id": "r1", "default": true, "steps": [
        {"id": "s1", "text": {"nl": "Snij", "en": "Cut"}, "mins": 2.5, "timer": {"seconds": 60, "name": "Ui"},
         "uses": [{"amount": "1", "name": "ui"}], "photos": []}
    ]}]})
}

/// The kitchen as the database holds it now, read fresh (not the store's memory).
fn stored(db: &chassis::storage::AppDb) -> Data {
    db.read_blocking(db::rows::load_data).unwrap()
}

#[tokio::test]
async fn a_stale_put_is_refused_and_changes_nothing_in_the_database() {
    let (s, db) = db_store(empty()).await;
    let id = s.create("dishes", dish("A")).await.unwrap()["id"]
        .as_str()
        .unwrap()
        .to_owned();
    s.replace_if("dishes", &id, dish("B"), Some(Precondition::Rev(0)))
        .await
        .unwrap();
    let stale = s
        .replace_if("dishes", &id, dish("C"), Some(Precondition::Rev(0)))
        .await;
    assert!(matches!(stale, Err(Refused::Stale(_))), "{stale:?}");
    let d = stored(&db);
    assert_eq!(d.dishes[0]["name"]["nl"], "B");
    assert_eq!(d.dishes[0]["rev"], 1);
    assert_eq!(
        d.dishes[0]["recipes"][0]["steps"][0]["mins"], 2.5,
        "a float stays a float"
    );
}

#[tokio::test]
async fn a_stale_delete_is_refused_and_the_item_stays_in_the_database() {
    let (s, db) = db_store(empty()).await;
    let id = s.create("dishes", dish("A")).await.unwrap()["id"]
        .as_str()
        .unwrap()
        .to_owned();
    s.replace("dishes", &id, dish("B")).await.unwrap();
    let stale = s.delete_if("dishes", &id, Some(Precondition::Rev(0))).await;
    assert!(matches!(stale, Err(Refused::Stale(_))), "{stale:?}");
    assert_eq!(stored(&db).dishes.len(), 1);
    s.delete_if("dishes", &id, Some(Precondition::Rev(1)))
        .await
        .unwrap();
    assert!(stored(&db).dishes.is_empty());
}

#[tokio::test]
async fn a_stale_settings_patch_is_refused_and_the_settings_stay() {
    let (s, db) = db_store(empty()).await;
    s.merge_settings_if(json!({"pace": "slow"}), Some(Precondition::Rev(0)))
        .await
        .unwrap();
    let stale = s
        .merge_settings_if(json!({"pace": "fast"}), Some(Precondition::Rev(0)))
        .await;
    assert!(matches!(stale, Err(Refused::Stale(_))), "{stale:?}");
    let d = stored(&db);
    assert_eq!(
        (d.settings["pace"].as_str(), d.settings_rev),
        (Some("slow"), 1)
    );
}

#[tokio::test]
async fn a_take_is_applied_once_per_key_and_the_key_is_stored_with_it() {
    let (s, db) = db_store(empty()).await;
    let item = json!({"dish": {"nl": "Soep", "en": "Soup"}, "portions": 3});
    let id = s.create("freezer", item).await.unwrap()["id"]
        .as_str()
        .unwrap()
        .to_owned();
    let first = s.take_portions_once(&id, 1, Some("k-1")).await.unwrap();
    let again = s.take_portions_once(&id, 1, Some("k-1")).await.unwrap();
    assert_eq!(first, again);
    let d = stored(&db);
    assert_eq!(d.freezer[0]["portions"], 2, "one portion left the freezer");
    assert_eq!(d.answered.len(), 1);
    assert_eq!(
        (d.answered[0].key.as_str(), &d.answered[0].answer),
        ("k-1", &first)
    );
}

#[tokio::test]
async fn undo_puts_the_item_back_at_its_place_in_the_database() {
    let (s, db) = db_store(empty()).await;
    let mut ids = Vec::new();
    for name in ["A", "B", "C"] {
        ids.push(
            s.create("dishes", dish(name)).await.unwrap()["id"]
                .as_str()
                .unwrap()
                .to_owned(),
        );
    }
    let gone = s.delete("dishes", &ids[1]).await.unwrap();
    assert_eq!(stored(&db).dishes.len(), 2);
    let back = s.restore("dishes", &ids[1]).await.unwrap();
    assert_eq!(back, gone, "exactly what was removed");
    let names: Vec<Value> = stored(&db)
        .dishes
        .iter()
        .map(|d| d["name"]["nl"].clone())
        .collect();
    assert_eq!(names, [json!("A"), json!("B"), json!("C")]);
}

#[tokio::test]
async fn memory_and_database_agree_after_a_run_of_changes() {
    let (s, db) = db_store(empty()).await;
    let a = s
        .create(
            "log",
            json!({"dish_id": "d", "date": "2026-11-03", "feeling": null}),
        )
        .await
        .unwrap();
    s.create(
        "drafts",
        json!({"key": "new:d", "data": {"steps": [{"id": "x"}]}}),
    )
    .await
    .unwrap();
    s.create(
        "shelf",
        json!({"title": {"nl": "Brood", "en": "Bread"}, "energy": "open", "extra": [1, 2]}),
    )
    .await
    .unwrap();
    s.delete("log", a["id"].as_str().unwrap()).await.unwrap();
    s.merge_settings(json!({"lang": "nl", "spare": 10, "new_key": true}))
        .await
        .unwrap();
    let memory = s.snapshot().await;
    let disk = stored(&db);
    assert_eq!(
        serde_json::to_value(&memory).unwrap(),
        serde_json::to_value(&disk).unwrap()
    );
}
