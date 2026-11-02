//! Tests of the JSON routes (src/routes.rs): the kit's 409, the item route, the idempotent freezer take, the checked
//! delete and settings patch (fix-offline-master-5).

use super::*;
use chassis::core::revision::Precondition;

#[tokio::test]
async fn a_stale_refusal_is_the_kits_409_with_code_rev_and_etag() {
    let stale = Precondition::Rev(3).check(4).unwrap_err();
    let res = answer(Err::<Value, _>(Refused::Stale(stale)));
    assert_eq!(res.status(), StatusCode::CONFLICT);
    assert_eq!(res.headers()["etag"], "\"4\"");
    let bytes = axum::body::to_bytes(res.into_body(), 4096).await.unwrap();
    let body: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(body["code"], "stale");
    assert_eq!(body["rev"], 4);
    assert!(body["error"].is_string() && body["remedy"].is_string());
}

/// A kitchen with one dish (rev 3) holding one recipe, for the item route.
fn one_dish() -> State<Arc<Store>> {
    let data: crate::store::Data = serde_json::from_value(json!({
        "format": 5,
        "dishes": [{ "id": "d1", "rev": 3, "name": { "nl": "Stoofvlees", "en": "Stew" },
                     "recipes": [{ "id": "r1", "default": true, "steps": [] }] }],
    }))
    .unwrap();
    State(Arc::new(Store::in_memory(data)))
}

#[tokio::test]
async fn an_item_answers_the_dish_with_its_recipes_and_its_rev_as_etag() {
    let res = item(one_dish(), Path(("dishes".into(), "d1".into()))).await;
    assert_eq!(res.status(), StatusCode::OK);
    assert_eq!(res.headers()["etag"], "\"3\"");
    let bytes = axum::body::to_bytes(res.into_body(), 4096).await.unwrap();
    let body: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(body["id"], "d1");
    assert_eq!(body["rev"], 3);
    assert_eq!(body["recipes"][0]["id"], "r1");
}

#[tokio::test]
async fn a_missing_item_or_list_is_404() {
    let gone = item(one_dish(), Path(("dishes".into(), "nope".into()))).await;
    assert_eq!(gone.status(), StatusCode::NOT_FOUND);
    let no_list = item(one_dish(), Path(("nolist".into(), "d1".into()))).await;
    assert_eq!(no_list.status(), StatusCode::NOT_FOUND);
}

/// The kit's `Idempotency-Key` extractor run on a request with `header` (None: no header).
async fn key_from(header: Option<&str>) -> Result<IdempotencyKey, Response> {
    use axum::extract::FromRequestParts;
    let mut req = axum::http::Request::builder();
    if let Some(h) = header {
        req = req.header("idempotency-key", h);
    }
    let (mut parts, ()) = req.body(()).unwrap().into_parts();
    IdempotencyKey::from_request_parts(&mut parts, &()).await
}

#[tokio::test]
async fn a_take_replayed_with_the_same_key_takes_one_portion() {
    let data: crate::store::Data = serde_json::from_value(json!({
        "format": 5, "freezer": [{ "id": "f1", "dish": { "nl": "Soep", "en": "Soup" }, "portions": 2 }],
    }))
    .unwrap();
    let store = Arc::new(Store::in_memory(data));
    let uuid = "3f2b8c1e-5a4d-4e0a-9b1c-2d7e6f8a9b0c";
    for _ in 0..2 {
        let key = key_from(Some(uuid)).await.unwrap();
        let res = take(
            State(store.clone()),
            Path("f1".into()),
            key,
            Json(json!({"portions": 1})),
        )
        .await;
        assert_eq!(res.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(res.into_body(), 4096).await.unwrap();
        let body: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(body["portions"], 1, "both answers are the first take's");
    }
    assert_eq!(store.list("freezer").await.unwrap()[0]["portions"], 1);
    let kitchen_answer = kitchen(State(store)).await;
    let bytes = axum::body::to_bytes(kitchen_answer.into_body(), 65536)
        .await
        .unwrap();
    let body: Value = serde_json::from_slice(&bytes).unwrap();
    assert!(
        body.get("answered").is_none(),
        "the keys stay out of GET /data/kitchen"
    );
}

#[tokio::test]
async fn a_key_that_is_not_a_uuid_is_the_kits_400_and_none_is_fine() {
    let bad = key_from(Some("take-1")).await.unwrap_err();
    assert_eq!(bad.status(), StatusCode::BAD_REQUEST);
    assert_eq!(key_from(None).await.unwrap().get(), None);
}

#[tokio::test]
async fn any_other_refusal_keeps_kitchens_own_shape() {
    let res = answer(Err::<Value, _>(Refused::NotFound));
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
    let bytes = axum::body::to_bytes(res.into_body(), 4096).await.unwrap();
    let body: Value = serde_json::from_slice(&bytes).unwrap();
    assert!(body.get("code").is_none());
    assert!(body["error"].is_string());
}

/// The kit's `If-Match` extractor run on a request with `header` (None: no header).
async fn if_match_from(header: Option<&str>) -> IfMatch {
    use axum::extract::FromRequestParts;
    let mut req = axum::http::Request::builder();
    if let Some(h) = header {
        req = req.header("if-match", h);
    }
    let (mut parts, ()) = req.body(()).unwrap().into_parts();
    IfMatch::from_request_parts(&mut parts, &()).await.unwrap()
}

/// The JSON body of an answer.
async fn body_of(res: Response) -> Value {
    let bytes = axum::body::to_bytes(res.into_body(), 65536).await.unwrap();
    serde_json::from_slice(&bytes).unwrap()
}

#[tokio::test]
async fn a_stale_delete_is_the_kits_409_with_the_stored_dish_as_current() {
    // fix-offline-master-5: the dish is at rev 3, the page read it at 2.
    let state = one_dish();
    let store = state.0.clone();
    let res = delete(
        state,
        Path(("dishes".into(), "d1".into())),
        if_match_from(Some("\"2\"")).await,
    )
    .await;
    assert_eq!(res.status(), StatusCode::CONFLICT);
    assert_eq!(res.headers()["etag"], "\"3\"");
    let body = body_of(res).await;
    assert_eq!(body["code"], "stale");
    assert_eq!(body["current"]["id"], "d1");
    assert_eq!(store.list("dishes").await.unwrap().len(), 1);
}

#[tokio::test]
async fn a_delete_without_if_match_or_at_the_stored_rev_goes() {
    let res = delete(
        one_dish(),
        Path(("dishes".into(), "d1".into())),
        if_match_from(None).await,
    )
    .await;
    assert_eq!(res.status(), StatusCode::OK);
    let res = delete(
        one_dish(),
        Path(("dishes".into(), "d1".into())),
        if_match_from(Some("3")).await,
    )
    .await;
    assert_eq!(res.status(), StatusCode::OK);
    assert_eq!(body_of(res).await["id"], "d1");
}

#[tokio::test]
async fn the_settings_answer_with_their_rev_and_a_stale_patch_is_refused() {
    let store = Arc::new(Store::in_memory(
        serde_json::from_value(json!({"format": 5})).unwrap(),
    ));
    let res = patch_settings(
        State(store.clone()),
        if_match_from(Some("0")).await,
        Json(json!({"pace": "calm"})),
    )
    .await;
    assert_eq!(res.status(), StatusCode::OK);
    assert_eq!(res.headers()["etag"], "\"1\"");
    assert_eq!(body_of(res).await["pace"], "calm");
    let stale = patch_settings(
        State(store.clone()),
        if_match_from(Some("0")).await,
        Json(json!({"pace": "fast"})),
    )
    .await;
    assert_eq!(stale.status(), StatusCode::CONFLICT);
    let body = body_of(stale).await;
    assert_eq!(
        (body["code"].as_str(), body["rev"].as_u64()),
        (Some("stale"), Some(1))
    );
    assert_eq!(body["current"]["pace"], "calm");
    let read = settings(State(store.clone())).await;
    assert_eq!(read.headers()["etag"], "\"1\"");
    let unchecked = patch_settings(
        State(store),
        if_match_from(None).await,
        Json(json!({"pace": "fast"})),
    )
    .await;
    assert_eq!(unchecked.status(), StatusCode::OK, "no header: as before");
}
