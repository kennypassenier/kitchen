//! The kitchen's JSON routes, behind the kit's login (`dashboard_routes`).
//!
//! `GET /data/kitchen` answers everything at once, because every screen
//! needs most of it and it is small. The rest is one route shape per list:
//!
//! | Route | Does |
//! |---|---|
//! | `GET /data/{list}` | the list |
//! | `POST /data/{list}` | add an item; the answer carries its new `id` |
//! | `PUT /data/{list}/{id}` | replace the item; `If-Match: <rev>` refuses it (409, `"code": "stale"`) when it was saved since |
//! | `DELETE /data/{list}/{id}` | remove the item; the answer is what was removed (Undo) |
//! | `POST /data/restore/{list}/{id}` | Undo of a delete: the removed item back at its place, within `UNDO_KEEP` |
//! | `POST /data/freezer/{id}/take` | `{"portions": n}` out of the freezer (negative puts back) |
//! | `GET`/`PATCH /data/settings` | the settings; PATCH merges, `null` removes a key |
//! | `POST /data/photos`, `GET`/`DELETE /data/photos/{id}` | recipe photos, see `photos.rs` |
//! | `POST /data/import`, `POST /data/import/image` | a recipe from a web page or pasted text, see `import.rs` |
//!
//! A refusal is HTTP 4xx (5xx for a failed save) with `{"error": "…"}` in
//! words a page shows as they are.

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::header::IF_MATCH;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post, put};
use axum::{Json, Router};
use serde_json::{Value, json};

use crate::store::{Refused, Store};

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
        Err(e) => {
            let code = match e {
                Refused::NotFound | Refused::UnknownCollection(_) => StatusCode::NOT_FOUND,
                Refused::NoPortionsLeft | Refused::Exists | Refused::Stale { .. } => {
                    StatusCode::CONFLICT
                }
                Refused::UndoClosed => StatusCode::GONE,
                Refused::Disk(_) => StatusCode::INTERNAL_SERVER_ERROR,
                Refused::NotAnObject
                | Refused::IdMismatch
                | Refused::NoKey
                | Refused::BadIfMatch
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
            if let Refused::Stale { have } = e {
                body["code"] = json!("stale");
                body["rev"] = json!(have);
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

async fn replace(
    State(s): Shared,
    Path((list, id)): Path<(String, String)>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match if_match(&headers) {
        Ok(rev) => answer(s.replace_if(&list, &id, body, rev).await),
        Err(e) => answer(Err::<Value, _>(e)),
    }
}

/// The revision a page loaded, from `If-Match` (`5` or `"5"`); absent is no check (the behaviour before fix-stale-save-1).
pub(crate) fn if_match(headers: &HeaderMap) -> Result<Option<u64>, Refused> {
    let Some(raw) = headers.get(IF_MATCH) else {
        return Ok(None);
    };
    let text = raw.to_str().map_err(|_| Refused::BadIfMatch)?.trim();
    let bare = text
        .strip_prefix('"')
        .and_then(|t| t.strip_suffix('"'))
        .unwrap_or(text);
    bare.parse().map(Some).map_err(|_| Refused::BadIfMatch)
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

    fn with(value: &str) -> HeaderMap {
        let mut h = HeaderMap::new();
        h.insert(IF_MATCH, value.parse().unwrap());
        h
    }

    #[test]
    fn if_match_reads_a_bare_or_quoted_revision_and_refuses_anything_else() {
        assert_eq!(if_match(&HeaderMap::new()), Ok(None));
        assert_eq!(if_match(&with("3")), Ok(Some(3)));
        assert_eq!(if_match(&with("\"7\"")), Ok(Some(7)));
        assert_eq!(if_match(&with("*")), Err(Refused::BadIfMatch));
        assert_eq!(if_match(&with("-1")), Err(Refused::BadIfMatch));
    }

    #[tokio::test]
    async fn a_stale_refusal_is_409_with_its_code() {
        let res = answer(Err::<Value, _>(Refused::Stale { have: 4 }));
        assert_eq!(res.status(), StatusCode::CONFLICT);
        let bytes = axum::body::to_bytes(res.into_body(), 4096).await.unwrap();
        let body: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(body["code"], "stale");
        assert_eq!(body["rev"], 4);
    }
}
