use super::*;

#[test]
fn stamps_sort_as_text_and_match_the_kit() {
    assert_eq!(rfc3339_at(0), "1970-01-01T00:00:00Z");
    assert_eq!(rfc3339_at(1_782_000_000), "2026-06-21T00:00:00Z");
    assert_eq!(rfc3339_at(1_803_652_757), "2027-02-26T14:39:17Z");
    assert_eq!(rfc3339_at(951_782_400), "2000-02-29T00:00:00Z");
}

#[tokio::test]
async fn drafts_older_than_a_week_go_and_take_their_own_photos() {
    let dir = tempfile::tempdir().unwrap();
    let photos = dir.path().join("photos");
    std::fs::create_dir_all(&photos).unwrap();
    let mine = "11111111-1111-4111-8111-111111111111";
    let shared = "22222222-2222-4222-8222-222222222222";
    for id in [mine, shared] {
        std::fs::write(photos.join(format!("{id}.jpg")), b"x").unwrap();
    }
    let mut data = empty();
    data.dishes.push(
        serde_json::json!({"id": "d", "recipes": [{"id": "r", "steps": [{"photos": [shared]}]}]}),
    );
    data.drafts.push(
        serde_json::json!({"id": "a", "key": "new:", "saved": "2026-10-01T00:00:00Z",
        "data": {"photo": mine, "steps": [{"photos": [shared]}]}}),
    );
    data.drafts.push(
        serde_json::json!({"id": "b", "key": "r", "saved": "2026-10-29T10:00:00Z", "data": {}}),
    );
    let mut s = Store::in_memory(data);
    s.photos = Some(photos.clone());
    // 2026-10-29T12:00:00Z
    let now = 1_793_275_200;
    assert_eq!(s.prune_drafts(now).await, 1);
    assert_eq!(s.list("drafts").await.unwrap().len(), 1);
    assert!(!photos.join(format!("{mine}.jpg")).exists());
    assert!(photos.join(format!("{shared}.jpg")).exists());
}

#[tokio::test]
async fn a_draft_is_one_per_key() {
    let s = Store::in_memory(empty());
    let first = s
        .create(
            "drafts",
            serde_json::json!({"key": "new:d1", "data": {"short": "a"}}),
        )
        .await
        .unwrap();
    let again = s
        .create(
            "drafts",
            serde_json::json!({"key": "new:d1", "data": {"short": "b"}}),
        )
        .await
        .unwrap();
    let other = s
        .create("drafts", serde_json::json!({"key": "r1", "data": {}}))
        .await
        .unwrap();
    // Saving the same key again replaces the draft; its id and creation stay, its data and time move.
    assert_eq!(first["id"], again["id"]);
    assert_eq!(first["created"], again["created"]);
    assert_ne!(first["id"], other["id"]);
    let all = s.list("drafts").await.unwrap();
    assert_eq!(all.len(), 2);
    assert_eq!(all[0]["data"]["short"], "b");
    assert!(all[0]["saved"].is_string());
    // A draft without a key is refused, and a delete by id removes it.
    assert_eq!(
        s.create("drafts", serde_json::json!({"data": {}})).await,
        Err(Refused::NoKey)
    );
    s.delete("drafts", first["id"].as_str().unwrap())
        .await
        .unwrap();
    assert_eq!(s.list("drafts").await.unwrap().len(), 1);
    // The collection is part of the file: an older file without it reads as none.
    let d: Data = serde_json::from_str(r#"{"format": 5}"#).unwrap();
    assert!(d.drafts.is_empty());
}

#[tokio::test]
async fn create_replace_delete_round_trip() {
    let s = Store::in_memory(empty());
    let made = s
        .create("log", serde_json::json!({"name": "Stoemp"}))
        .await
        .unwrap();
    let id = made["id"].as_str().unwrap().to_string();
    let changed = s
        .replace(
            "log",
            &id,
            serde_json::json!({"name": "Stoemp with sausage"}),
        )
        .await
        .unwrap();
    assert_eq!(changed["created"], made["created"]);
    assert_eq!(changed["name"], "Stoemp with sausage");
    s.delete("log", &id).await.unwrap();
    assert_eq!(s.delete("log", &id).await, Err(Refused::NotFound));
    assert!(matches!(
        s.list("cupboard").await,
        Err(Refused::UnknownCollection(_))
    ));
}

#[tokio::test]
async fn a_portion_cannot_go_below_zero_and_undo_puts_it_back() {
    let s = Store::in_memory(empty());
    let p = s
        .create(
            "freezer",
            serde_json::json!({"dish": {"nl": "Soep", "en": "Soup"}, "portions": 1}),
        )
        .await
        .unwrap();
    let id = p["id"].as_str().unwrap();
    assert_eq!(s.take_portions(id, 1).await.unwrap()["portions"], 0);
    assert_eq!(s.take_portions(id, 1).await, Err(Refused::NoPortionsLeft));
    assert_eq!(s.take_portions(id, -1).await.unwrap()["portions"], 1);
}

#[test]
fn the_seed_holds_only_the_categories() {
    let d = seed();
    assert!(d.recipes.is_empty() && d.freezer.is_empty() && d.shelf.is_empty() && d.log.is_empty());
    assert!(d.dishes.is_empty());
    assert_eq!(d.dish_categories.len(), 2);
    assert!(d.ingredients.is_empty());
    assert_eq!(d.ingredient_categories.len(), 1);
}

#[test]
fn a_new_kitchen_starts_with_the_verified_sites() {
    let sources = seed().recipe_sources.unwrap();
    assert_eq!(sources.len(), 6);
    assert!(sources.iter().all(
        |s| s["url"].as_str().is_some_and(|u| u.starts_with("https://"))
            && s["verified"] == "2026-10-29"
    ));
}
