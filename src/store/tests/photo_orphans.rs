//! fix-photo-orphans-1: the start-up sweep deletes a photo file nothing refers to once it is older than
//! `ORPHAN_MIN_AGE`; a referenced file and a fresh one (an upload whose draft is not written yet) stay. Time is passed in.

use std::time::{Duration, SystemTime};

use serde_json::json;

use super::super::photo_orphans::{ORPHAN_MIN_AGE, OrphanSweep};
use super::*;

const IN_DISH: &str = "11111111-1111-4111-8111-111111111111";
const IN_DRAFT: &str = "22222222-2222-4222-8222-222222222222";
const ORPHAN: &str = "33333333-3333-4333-8333-333333333333";
const ORPHAN_WEBP: &str = "44444444-4444-4444-8444-444444444444";

/// A store whose photo directory holds the four ids above and a file that is no photo; the dish refers to `IN_DISH` (a
/// step's photo), a draft to `IN_DRAFT`.
fn kitchen() -> (tempfile::TempDir, Store) {
    let dir = tempfile::tempdir().unwrap();
    let photos = dir.path().join("photos");
    std::fs::create_dir_all(&photos).unwrap();
    for name in [
        format!("{IN_DISH}.jpg"),
        format!("{IN_DRAFT}.webp"),
        format!("{ORPHAN}.jpg"),
        format!("{ORPHAN_WEBP}.webp"),
        "notes.txt".to_string(),
    ] {
        std::fs::write(photos.join(name), b"x").unwrap();
    }
    let mut data = empty();
    data.dishes
        .push(json!({"id": "d", "name": {"nl": "d", "en": "d"},
        "recipes": [{"id": "r", "steps": [{"id": "s", "photos": [IN_DISH]}]}]}));
    data.drafts
        .push(json!({"id": "x", "key": "r", "data": {"photo": IN_DRAFT}}));
    let mut s = Store::in_memory(data);
    s.photos = Some(photos);
    (dir, s)
}

fn exists(dir: &tempfile::TempDir, name: &str) -> bool {
    dir.path().join("photos").join(name).exists()
}

/// A moment at which every file just written is older than the minimum age.
fn later() -> SystemTime {
    SystemTime::now() + ORPHAN_MIN_AGE + Duration::from_secs(1)
}

#[tokio::test]
async fn an_old_unreferenced_file_is_removed_at_start() {
    let (dir, s) = kitchen();
    let done = s.sweep_orphans_at(later()).await.unwrap();
    assert_eq!(
        done,
        OrphanSweep {
            removed: 2,
            failed: 0
        }
    );
    assert!(!exists(&dir, &format!("{ORPHAN}.jpg")));
    assert!(!exists(&dir, &format!("{ORPHAN_WEBP}.webp")));
}

#[tokio::test]
async fn a_referenced_file_stays() {
    let (dir, s) = kitchen();
    s.sweep_orphans_at(later()).await.unwrap();
    assert!(
        exists(&dir, &format!("{IN_DISH}.jpg")),
        "a dish's step refers to it"
    );
    assert!(
        exists(&dir, &format!("{IN_DRAFT}.webp")),
        "a draft refers to it"
    );
    assert!(exists(&dir, "notes.txt"), "not a photo file: never touched");
}

#[tokio::test]
async fn a_fresh_unreferenced_file_stays() {
    let (dir, s) = kitchen();
    let done = s.sweep_orphans_at(SystemTime::now()).await.unwrap();
    assert_eq!(done, OrphanSweep::default());
    assert!(
        exists(&dir, &format!("{ORPHAN}.jpg")),
        "an upload whose draft is not written yet"
    );
}

#[tokio::test]
async fn a_kitchen_without_a_photos_folder_sweeps_nothing() {
    let (dir, s) = kitchen();
    std::fs::remove_dir_all(dir.path().join("photos")).unwrap();
    assert_eq!(
        s.sweep_orphans_at(later()).await.unwrap(),
        OrphanSweep::default()
    );
}
