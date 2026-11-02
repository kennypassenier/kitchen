//! fix-undo-photos-1: photos that drop out of a dish (a recipe deleted through the dish's PUT, or the dish deleted) are
//! deleted only after Undo's window closed and only when nothing else refers to them. Time is passed in (`*_at`).

use std::time::{Duration, Instant};

use serde_json::{Value, json};

use super::super::undo::UNDO_KEEP;
use super::*;

const P: &str = "11111111-1111-4111-8111-111111111111";
const Q: &str = "22222222-2222-4222-8222-222222222222";

fn later() -> Instant {
    Instant::now() + UNDO_KEEP + Duration::from_secs(1)
}

fn dish(id: &str, recipes: Value) -> Value {
    json!({"id": id, "name": {"nl": id, "en": id}, "recipes": recipes})
}

/// A store whose photo directory holds P and Q.
fn with_photos(data: Data) -> (tempfile::TempDir, Store) {
    let dir = tempfile::tempdir().unwrap();
    let photos = dir.path().join("photos");
    std::fs::create_dir_all(&photos).unwrap();
    for id in [P, Q] {
        std::fs::write(photos.join(format!("{id}.jpg")), b"x").unwrap();
    }
    let mut s = Store::in_memory(data);
    s.photos = Some(photos);
    (dir, s)
}

fn exists(dir: &tempfile::TempDir, id: &str) -> bool {
    dir.path().join("photos").join(format!("{id}.jpg")).exists()
}

fn recipe() -> Value {
    json!([{"id": "r", "photo": P, "steps": [{"id": "s", "photos": [Q]}]}])
}

#[tokio::test]
async fn undo_of_a_recipe_delete_keeps_its_photos() {
    let mut data = empty();
    data.dishes.push(dish("d", recipe()));
    let (dir, s) = with_photos(data);
    // The page deletes the recipe by saving the dish without it, then Undo saves it back.
    s.replace("dishes", "d", dish("d", json!([])))
        .await
        .unwrap();
    s.replace("dishes", "d", dish("d", recipe())).await.unwrap();
    s.sweep_photos_at(later()).await;
    assert!(exists(&dir, P) && exists(&dir, Q));
}

#[tokio::test]
async fn photos_go_only_once_the_window_closed() {
    let mut data = empty();
    data.dishes.push(dish("d", recipe()));
    let (dir, s) = with_photos(data);
    s.replace("dishes", "d", dish("d", json!([])))
        .await
        .unwrap();
    s.sweep_photos_at(Instant::now() + Duration::from_secs(10))
        .await;
    assert!(
        exists(&dir, P),
        "the page reloaded, but Undo is still possible"
    );
    s.sweep_photos_at(later()).await;
    assert!(!exists(&dir, P) && !exists(&dir, Q));
}

#[tokio::test]
async fn a_photo_still_referred_to_elsewhere_stays() {
    let mut data = empty();
    data.dishes.push(dish("d", recipe()));
    // A copy shares P; a draft refers to Q.
    data.dishes
        .push(dish("copy", json!([{"id": "c", "photo": P, "steps": []}])));
    data.drafts
        .push(json!({"id": "x", "key": "r", "data": {"steps": [{"photos": [Q]}]}}));
    let (dir, s) = with_photos(data);
    s.replace("dishes", "d", dish("d", json!([])))
        .await
        .unwrap();
    s.sweep_photos_at(later()).await;
    assert!(exists(&dir, P) && exists(&dir, Q));
}

#[tokio::test]
async fn a_deleted_dish_keeps_its_photos_while_it_can_come_back() {
    let mut data = empty();
    data.dishes.push(dish("d", recipe()));
    let (dir, s) = with_photos(data);
    s.delete("dishes", "d").await.unwrap();
    // P dropped out of another dish long ago: its window closed, but d (which has P) can still be put back.
    let long_ago = Instant::now()
        .checked_sub(UNDO_KEEP + Duration::from_secs(1))
        .unwrap();
    s.dropped.note([P.to_string()].into(), long_ago);
    s.sweep_photos_at(Instant::now()).await;
    assert!(exists(&dir, P));
    s.restore("dishes", "d").await.unwrap();
    s.sweep_photos_at(later()).await;
    assert!(exists(&dir, P) && exists(&dir, Q), "restored: both stay");
    s.delete("dishes", "d").await.unwrap();
    s.sweep_photos_at(later()).await;
    assert!(
        !exists(&dir, P) && !exists(&dir, Q),
        "not restored: both go"
    );
}
