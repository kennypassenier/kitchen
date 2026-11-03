//! Every store write records its change in the kit's change log in the same transaction, and the feed serves it
//! (feat-db-sync-1). Written 03/11/2026, not run (Kenny's test rule); listed in docs/OPEN.md release check 16.

use std::sync::Arc;

use chassis::core::revision::Precondition;
use chassis::storage::AppDb;
use chassis::storage::sync::{Feed, SqliteChangeLog, SyncSource};
use serde_json::{Value, json};

use super::*;
use crate::store::db::sync::{KitchenLoad, SETTINGS_KEY};

/// The change-log row of one item: `(rev, deleted)`, or `None` when the change log has none.
fn logged(db: &AppDb, collection: &str, key: &str) -> Option<(i64, bool)> {
    let (c, k) = (collection.to_owned(), key.to_owned());
    db.read_blocking(move |conn| {
        let row = conn.query_row(
            "SELECT rev, deleted FROM chassis_sync WHERE collection = ?1 AND key = ?2",
            [&c, &k],
            |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)? == 1)),
        );
        Ok(row.ok())
    })
    .unwrap()
}

/// How many changes the log holds in all.
fn changes(db: &AppDb) -> i64 {
    db.read_blocking(|conn| {
        Ok(conn.query_row("SELECT COUNT(*) FROM chassis_sync", [], |r| r.get(0))?)
    })
    .unwrap()
}

fn named(name: &str) -> Value {
    json!({"name": {"nl": name, "en": name}})
}

#[tokio::test]
async fn create_replace_delete_restore_take_and_settings_each_record_their_change() {
    let (s, db) = db_store(empty()).await;
    let id = s.create("ingredients", named("Ui")).await.unwrap()["id"]
        .as_str()
        .unwrap()
        .to_owned();
    assert_eq!(logged(&db, "ingredients", &id), Some((0, false)), "create");
    s.replace("ingredients", &id, named("Sjalot"))
        .await
        .unwrap();
    assert_eq!(
        logged(&db, "ingredients", &id),
        Some((1, false)),
        "replace: the new rev"
    );
    s.delete("ingredients", &id).await.unwrap();
    assert_eq!(
        logged(&db, "ingredients", &id),
        Some((2, true)),
        "delete: a tombstone past the last rev"
    );
    s.restore("ingredients", &id).await.unwrap();
    assert_eq!(
        logged(&db, "ingredients", &id),
        Some((1, false)),
        "restore: live again at its rev"
    );
    let soup = json!({"dish": {"nl": "Soep", "en": "Soup"}, "portions": 2});
    let fid = s.create("freezer", soup).await.unwrap()["id"]
        .as_str()
        .unwrap()
        .to_owned();
    s.take_portions_once(&fid, 1, Some("k")).await.unwrap();
    assert_eq!(
        logged(&db, "freezer", &fid),
        Some((0, false)),
        "a take is an upsert of the item"
    );
    s.merge_settings(json!({"pace": "slow"})).await.unwrap();
    assert_eq!(
        logged(&db, "settings", SETTINGS_KEY),
        Some((1, false)),
        "settings at settings_rev"
    );
}

#[tokio::test]
async fn a_refused_or_empty_change_records_nothing() {
    let (s, db) = db_store(empty()).await;
    let id = s.create("ingredients", named("Ui")).await.unwrap()["id"]
        .as_str()
        .unwrap()
        .to_owned();
    let before = changes(&db);
    let stale = s
        .replace_if("ingredients", &id, named("X"), Some(Precondition::Rev(9)))
        .await;
    assert!(stale.is_err());
    assert!(s.take_portions_once("nope", 1, Some("k")).await.is_err());
    assert_eq!(changes(&db), before, "nothing changed, nothing logged");
}

#[tokio::test]
async fn a_failed_write_leaves_neither_the_item_nor_its_change() {
    let (s, db) = db_store(empty()).await;
    // The table the item would go to is gone; the change-log entry of the same transaction must roll back with it.
    db.write_blocking(|tx| Ok(tx.execute_batch("DROP TABLE resting")?))
        .unwrap();
    let before = changes(&db);
    let out = s
        .create("resting", json!({"dish_id": "d", "until": "2026-11-10"}))
        .await;
    assert!(matches!(out, Err(Refused::Disk(_))), "{out:?}");
    assert_eq!(changes(&db), before);
    assert!(
        s.list("resting").await.unwrap().is_empty(),
        "memory put back"
    );
}

#[tokio::test]
async fn the_feed_serves_the_changed_item_as_the_item_route_answers_it() {
    let (s, db) = db_store(empty()).await;
    let feed = SqliteChangeLog::new(db.clone(), Arc::new(KitchenLoad));
    let id = s.create("dishes", named("Stoofvlees")).await.unwrap()["id"]
        .as_str()
        .unwrap()
        .to_owned();
    let saved = s.replace("dishes", &id, named("Stew")).await.unwrap();
    let Feed::Page(page) = feed
        .changes_since("dishes", chassis::storage::ADMIN_SCOPE, None, 100)
        .await
        .unwrap()
    else {
        panic!("a first read is a page");
    };
    assert_eq!(page.upserts.len(), 1);
    assert_eq!(page.upserts[0].key, id);
    assert_eq!(page.upserts[0].rev, 1);
    assert_eq!(page.upserts[0].data, saved);
    let cursor = page.cursor;
    s.delete("dishes", &id).await.unwrap();
    let Feed::Page(next) = feed
        .changes_since("dishes", chassis::storage::ADMIN_SCOPE, Some(cursor), 100)
        .await
        .unwrap()
    else {
        panic!("a cursor of this feed is served");
    };
    assert_eq!((next.deletes.len(), next.deletes[0].rev), (1, 2));
}

#[tokio::test]
async fn the_feed_serves_the_settings_as_one_item() {
    let (s, db) = db_store(empty()).await;
    s.merge_settings(json!({"lang": "nl"})).await.unwrap();
    let feed = SqliteChangeLog::new(db.clone(), Arc::new(KitchenLoad));
    let Feed::Page(page) = feed
        .changes_since("settings", chassis::storage::ADMIN_SCOPE, None, 10)
        .await
        .unwrap()
    else {
        panic!("a first read is a page");
    };
    assert_eq!(
        page.upserts[0].data,
        json!({"id": SETTINGS_KEY, "rev": 1, "lang": "nl"})
    );
}
