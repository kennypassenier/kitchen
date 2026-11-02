//! The kitchen's JSON routes, behind the kit's login (`dashboard_routes`).
//!
//! `GET /data/kitchen` answers everything at once, because every screen
//! needs most of it and it is small. The rest is one route shape per list:
//!
//! | Route | Does |
//! |---|---|
//! | `GET /data/{list}` | the list |
//! | `POST /data/{list}` | add an item; the answer carries its new `id` |
//! | `PUT /data/{list}/{id}` | replace the item; `If-Match: <rev>` refuses it (409, `"code": "stale"`) when it was saved since; the answer carries `ETag: "<rev>"` |
//! | `DELETE /data/{list}/{id}` | remove the item; the answer is what was removed (Undo) |
//! | `POST /data/restore/{list}/{id}` | Undo of a delete: the removed item back at its place, within `UNDO_KEEP` |
//! | `POST /data/freezer/{id}/take` | `{"portions": n}` out of the freezer (negative puts back) |
//! | `GET`/`PATCH /data/settings` | the settings; PATCH merges, `null` removes a key |
//! | `POST /data/photos`, `GET`/`DELETE /data/photos/{id}` | recipe photos, see `photos.rs` |
//! | `POST /data/import`, `POST /data/import/image` | a recipe from a web page or pasted text, see `import.rs` |
//!
//! A refusal is HTTP 4xx (5xx for a failed save) with `{"error": "…"}` in
//! words a page shows as they are.
//!
//! Revisions are the kit's (refactor-rev-kit-1, chassis-rs `IfMatch` /
//! `Revisioned` / `Conflict`): the `If-Match` header is parsed by the kit's
//! extractor (`5`, `"5"`, `W/"5"`, `*`; anything else is the kit's 400), the
//! store compares with the kit's `check`, and a stale save is answered with
//! the kit's 409 `{error, remedy, code: "stale", rev}` plus `ETag`, which the
//! page's offline client (`window.chassisData`) and `web/js/api/save.js` read.

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post, put};
use axum::{Json, Router};
use chassis::{Conflict, IfMatch, Revisioned};
use serde_json::{Value, json};

use crate::store::{Refused, Store, rev_of};

type Shared = State<Arc<Store>>;

/// `state_dir` is where the photos directory lives, next to `kitchen.json`.
pub fn router(store: Arc<Store>, state_dir: &std::path::Path) -> Router {
    Router::new()
        .route("/data/kitchen", get(kitchen))
        .route("/data/settings", get(settings).patch(patch_settings))
        .route("/data/freezer/{id}/take", post(take))
        .route("/data/restore/{list}/{id}", post(restore))
        .route("/data/{list}", get(list).post(create))
        .route("/data/{list}/{id}", put(replace).delete(delete))
        .with_state(store)
        // Static segments win over `/data/{list}`, so the photo routes sit beside it.
        .merge(crate::photos::router(state_dir))
        // The recipe import (Kenny, 29/10/2026 14:27): `/data/import` is static too, so it wins over `/data/{list}`.
        .merge(crate::import::router())
}

fn answer(r: Result<impl serde::Serialize, Refused>) -> Response {
    match r {
        Ok(v) => Json(v).into_response(),
        // The kit's 409, the one shape every data route of every kit app answers a stale save with.
        Err(Refused::Stale(stale)) => Conflict::from(stale).into_response(),
        Err(e) => {
            let code = match e {
                Refused::NotFound | Refused::UnknownCollection(_) => StatusCode::NOT_FOUND,
                Refused::NoPortionsLeft | Refused::Exists | Refused::Stale(_) => {
                    StatusCode::CONFLICT
                }
                Refused::UndoClosed => StatusCode::GONE,
                Refused::Disk(_) => StatusCode::INTERNAL_SERVER_ERROR,
                Refused::NotAnObject
                | Refused::IdMismatch
                | Refused::NoKey
                | Refused::MissingName(_)
                | Refused::BadSource(_)
                | Refused::BadRecipeSource(_)
                | Refused::TooLong { .. }
                | Refused::TooMany { .. } => StatusCode::BAD_REQUEST,
            };
            let mut body = json!({ "error": e.to_string() });
            if let Some((reason, field, limit)) = e.limit() {
                body["reason"] = json!(reason);
                body["field"] = json!(field);
                body["limit"] = json!(limit);
            }
            (code, Json(body)).into_response()
        }
    }
}

async fn kitchen(State(s): Shared) -> Response {
    Json(s.snapshot().await).into_response()
}

async fn list(State(s): Shared, Path(list): Path<String>) -> Response {
    answer(s.list(&list).await)
}

async fn create(State(s): Shared, Path(list): Path<String>, Json(body): Json<Value>) -> Response {
    answer(s.create(&list, body).await)
}

/// A replace checked against the revision the page read (`If-Match`, parsed by the kit). The saved item answers with
/// its new revision as `ETag` as well as in its body, so the offline client reads it either way.
async fn replace(
    State(s): Shared,
    Path((list, id)): Path<(String, String)>,
    if_match: IfMatch,
    Json(body): Json<Value>,
) -> Response {
    match s
        .replace_if(&list, &id, body, if_match.precondition())
        .await
    {
        Ok(item) => Revisioned::new(rev_of(&item), item).into_response(),
        Err(e) => answer(Err::<Value, _>(e)),
    }
}

async fn delete(State(s): Shared, Path((list, id)): Path<(String, String)>) -> Response {
    answer(s.delete(&list, &id).await)
}

async fn restore(State(s): Shared, Path((list, id)): Path<(String, String)>) -> Response {
    answer(s.restore(&list, &id).await)
}

async fn take(State(s): Shared, Path(id): Path<String>, Json(body): Json<Value>) -> Response {
    let n = body.get("portions").and_then(Value::as_i64).unwrap_or(1);
    answer(s.take_portions(&id, n).await)
}

async fn settings(State(s): Shared) -> Response {
    Json(s.settings().await).into_response()
}

async fn patch_settings(State(s): Shared, Json(body): Json<Value>) -> Response {
    answer(s.merge_settings(body).await)
}

#[cfg(test)]
mod tests {
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

    #[tokio::test]
    async fn any_other_refusal_keeps_kitchens_own_shape() {
        let res = answer(Err::<Value, _>(Refused::NotFound));
        assert_eq!(res.status(), StatusCode::NOT_FOUND);
        let bytes = axum::body::to_bytes(res.into_body(), 4096).await.unwrap();
        let body: Value = serde_json::from_slice(&bytes).unwrap();
        assert!(body.get("code").is_none());
        assert!(body["error"].is_string());
    }
}
