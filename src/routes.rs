//! The kitchen's JSON routes, behind the kit's login (`dashboard_routes`).
//!
//! `GET /data/kitchen` answers everything at once, because every screen
//! needs most of it and it is small. The rest is one route shape per list:
//!
//! | Route | Does |
//! |---|---|
//! | `GET /data/{list}` | the list |
//! | `POST /data/{list}` | add an item; the answer carries its new `id` |
//! | `GET /data/{list}/{id}` | one item, with its revision as `ETag` (feat-offline-recipe: the offline copy keeps a single dish); 404 when the list does not hold it |
//! | `PUT /data/{list}/{id}` | replace the item; `If-Match: <rev>` refuses it (409, `"code": "stale"`) when it was saved since; the answer carries `ETag: "<rev>"` |
//! | `DELETE /data/{list}/{id}` | remove the item; the answer is what was removed (Undo); `If-Match: <rev>` refuses it (409, `"code": "stale"`, the stored item as `current`) when it was saved since |
//! | `POST /data/restore/{list}/{id}` | Undo of a delete: the removed item back at its place, within `UNDO_KEEP` |
//! | `POST /data/freezer/{id}/take` | `{"portions": n}` out of the freezer (negative puts back); an `Idempotency-Key` (UUID) applies it once, a repeated key answers the first result (`store/idempotent.rs`) |
//! | `GET`/`PATCH /data/settings` | the settings with their revision as `ETag`; PATCH merges, `null` removes a key, raises `settings_rev` and honours `If-Match` like `PUT` |
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
use axum::routing::{get, post};
use axum::{Json, Router};
use chassis::{Conflict, IdempotencyKey, IfMatch, Revisioned};
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
        .route("/data/{list}/{id}", get(item).put(replace).delete(delete))
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

/// Everything at once; the answered take keys are the server's own bookkeeping and stay out of it.
async fn kitchen(State(s): Shared) -> Response {
    let mut data = s.snapshot().await;
    data.answered.clear();
    Json(data).into_response()
}

async fn list(State(s): Shared, Path(list): Path<String>) -> Response {
    answer(s.list(&list).await)
}

/// One item with its revision (`ETag` and the body's `rev`), the shape the offline client keeps per path. Read-only:
/// the same login and guards as every other data route (`dashboard_routes`).
async fn item(State(s): Shared, Path((list, id)): Path<(String, String)>) -> Response {
    match s.item(&list, &id).await {
        Ok(found) => Revisioned::new(rev_of(&found), found).into_response(),
        Err(e) => answer(Err::<Value, _>(e)),
    }
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

/// A delete checked against the revision the page read (`If-Match`, fix-offline-master-5): a delete queued offline and
/// replayed after someone saved the item is refused with the kit's 409, which carries the stored item as `current`, so
/// the page's offline client puts its copy back to the server's version. Without the header the delete is unchecked.
async fn delete(
    State(s): Shared,
    Path((list, id)): Path<(String, String)>,
    if_match: IfMatch,
) -> Response {
    match s.delete_if(&list, &id, if_match.precondition()).await {
        Err(Refused::Stale(stale)) => {
            let conflict = Conflict::from(stale);
            match s.item(&list, &id).await {
                Ok(current) => conflict.with_item(current).into_response(),
                Err(_) => conflict.into_response(),
            }
        }
        other => answer(other),
    }
}

async fn restore(State(s): Shared, Path((list, id)): Path<(String, String)>) -> Response {
    answer(s.restore(&list, &id).await)
}

/// A take queued offline is replayed by the page's offline client with the same `Idempotency-Key` (parsed by the kit:
/// a UUID, else the kit's 400), so a replay whose first answer was lost takes nothing twice.
async fn take(
    State(s): Shared,
    Path(id): Path<String>,
    key: IdempotencyKey,
    Json(body): Json<Value>,
) -> Response {
    let n = body.get("portions").and_then(Value::as_i64).unwrap_or(1);
    let key = key.get().map(|k| k.to_string());
    answer(s.take_portions_once(&id, n, key.as_deref()).await)
}

/// The settings, with their revision as `ETag` (fix-offline-master-5; the body stays the plain object of keys).
async fn settings(State(s): Shared) -> Response {
    let (settings, rev) = s.settings().await;
    Revisioned::new(rev, settings).into_response()
}

/// A merge checked against the settings' revision the page read (`If-Match`, fix-offline-master-5): stale, it is the
/// kit's 409 with the stored settings as `current`; merged, the settings answer with their new revision as `ETag`.
async fn patch_settings(State(s): Shared, if_match: IfMatch, Json(body): Json<Value>) -> Response {
    match s.merge_settings_if(body, if_match.precondition()).await {
        Ok((settings, rev)) => Revisioned::new(rev, settings).into_response(),
        Err(Refused::Stale(stale)) => {
            let (current, _) = s.settings().await;
            Conflict::from(stale).with_item(current).into_response()
        }
        Err(e) => answer(Err::<Value, _>(e)),
    }
}

#[cfg(test)]
#[path = "routes_tests.rs"]
mod tests;
