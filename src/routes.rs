//! The kitchen's JSON routes, behind the kit's login (`dashboard_routes`).
//!
//! `GET /data/kitchen` answers everything at once, because every screen
//! needs most of it and it is small. The rest is one route shape per list:
//!
//! | Route | Does |
//! |---|---|
//! | `GET /data/{list}` | the list |
//! | `POST /data/{list}` | add an item; the answer carries its new `id` |
//! | `PUT /data/{list}/{id}` | replace the item |
//! | `DELETE /data/{list}/{id}` | remove the item; the answer is what was removed (Undo) |
//! | `POST /data/freezer/{id}/take` | `{"portions": n}` out of the freezer (negative puts back) |
//! | `GET`/`PATCH /data/settings` | the settings; PATCH merges, `null` removes a key |
//! | `POST /data/photos`, `GET`/`DELETE /data/photos/{id}` | recipe photos, see `photos.rs` |
//! | `POST /data/import`, `POST /data/import/image` | a recipe from a web page or pasted text, see `import.rs` |
//!
//! A refusal is HTTP 4xx (5xx for a failed save) with `{"error": "…"}` in
//! words a page shows as they are.

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::StatusCode;
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
                Refused::NoPortionsLeft => StatusCode::CONFLICT,
                Refused::Disk(_) => StatusCode::INTERNAL_SERVER_ERROR,
                Refused::NotAnObject
                | Refused::IdMismatch
                | Refused::NoKey
                | Refused::MissingName(_)
                | Refused::BadSource(_)
                | Refused::BadRecipeSource(_) => StatusCode::BAD_REQUEST,
            };
            (code, Json(json!({ "error": e.to_string() }))).into_response()
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
    Json(body): Json<Value>,
) -> Response {
    answer(s.replace(&list, &id, body).await)
}

async fn delete(State(s): Shared, Path((list, id)): Path<(String, String)>) -> Response {
    answer(s.delete(&list, &id).await)
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
