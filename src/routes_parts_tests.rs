//! Every part of `GET /data/kitchen` equals the body of its own endpoint (Kenny's API rule, 04/11/2026), so the
//! browser can rebuild the kitchen from the parts when the merged call fails (web/js/api/snapshot-parts.js).

use super::*;
use crate::store::{COLLECTIONS, Data, FORMAT};

async fn body(res: Response) -> Value {
    assert_eq!(res.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(res.into_body(), 1 << 20)
        .await
        .unwrap();
    serde_json::from_slice(&bytes).unwrap()
}

/// A kitchen with one item in every list, settings with a revision above 0, and a take key that must stay out.
async fn seeded() -> State<Arc<Store>> {
    let mut file = json!({ "format": FORMAT, "settings": { "pace": "slow" }, "settings_rev": 7 });
    for name in COLLECTIONS {
        file[name] = json!([{ "id": format!("{name}-1"), "rev": 2, "key": name }]);
    }
    let data: Data = serde_json::from_value(file).unwrap();
    State(Arc::new(Store::in_memory(data)))
}

#[tokio::test]
async fn every_list_of_the_kitchen_equals_its_own_endpoint() {
    let s = seeded().await;
    let all = body(kitchen(State(s.0.clone())).await).await;
    for name in COLLECTIONS {
        let own = body(list(State(s.0.clone()), Path(name.to_string())).await).await;
        assert_eq!(all[name], own, "{name}");
        assert_eq!(
            all[name].as_array().unwrap().len(),
            1,
            "{name} is not empty"
        );
    }
}

#[tokio::test]
async fn the_settings_and_their_revision_equal_their_endpoints() {
    let s = seeded().await;
    let all = body(kitchen(State(s.0.clone())).await).await;
    let plain = body(settings(State(s.0.clone())).await).await;
    assert_eq!(all["settings"], plain);
    let res = settings_item_route(State(s.0.clone()), Path("kitchen".into())).await;
    assert_eq!(res.headers()["etag"], "\"7\"");
    let mut item = body(res).await;
    assert_eq!(item["rev"], all["settings_rev"]);
    item.as_object_mut()
        .unwrap()
        .retain(|k, _| k != "id" && k != "rev");
    assert_eq!(all["settings"], item);
}

#[tokio::test]
async fn the_kitchen_holds_nothing_but_those_parts() {
    let s = seeded().await;
    let all = body(kitchen(State(s.0.clone())).await).await;
    let mut keys: Vec<&str> = all
        .as_object()
        .unwrap()
        .keys()
        .map(String::as_str)
        .collect();
    let mut want: Vec<&str> = COLLECTIONS.to_vec();
    want.extend(["format", "settings", "settings_rev"]);
    keys.sort_unstable();
    want.sort_unstable();
    assert_eq!(
        keys, want,
        "a new part needs its own endpoint and a line here"
    );
    assert_eq!(all["format"], FORMAT);
}

#[tokio::test]
async fn a_kitchen_without_recipe_sources_still_has_the_part() {
    let mut data = Data::empty();
    data.recipe_sources = None;
    let s = State(Arc::new(Store::in_memory(data)));
    let all = body(kitchen(State(s.0.clone())).await).await;
    let own = body(list(State(s.0.clone()), Path("recipe_sources".into())).await).await;
    assert_eq!(all["recipe_sources"], json!([]));
    assert_eq!(all["recipe_sources"], own);
}
