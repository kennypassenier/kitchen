//! The settings' routes: the plain object at `/data/settings` (the pages' shape since fix-offline-master-5) and the
//! same settings as the one item of the `settings` collection at `/data/settings/{id}` (feat-db-sync-1, Kenny
//! 03/11/2026 06:12 "Behouden"), which is the item route the kit's local database writes through.
//!
//! | Route | Does |
//! |---|---|
//! | `GET /data/settings` | the object of keys, `settings_rev` as `ETag` |
//! | `PATCH /data/settings` | merge (`null` removes a key), `If-Match` checked against `settings_rev`; answers the object |
//! | `GET /data/settings/kitchen` | `{id: "kitchen", rev, ..keys}`, `rev` as `ETag` |
//! | `PATCH /data/settings/kitchen` | the same merge; `id` and `rev` in the body are the item's own fields, not keys, and are ignored; answers the item |
//!
//! Both PATCH routes share one store method and one revision, so a change through either is stale for the other. A
//! stale merge is the kit's 409 with the stored settings (in the route's own shape) as `current`. Any other id is 404.

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::response::{IntoResponse, Response};
use chassis::{Conflict, IfMatch, Revisioned};
use serde_json::Value;

use super::answer;
use crate::store::db::sync::{SETTINGS_KEY, settings_item};
use crate::store::{Refused, Store};

type Shared = State<Arc<Store>>;

/// The settings, with their revision as `ETag` (fix-offline-master-5; the body stays the plain object of keys).
pub async fn settings(State(s): Shared) -> Response {
    let (settings, rev) = s.settings().await;
    Revisioned::new(rev, settings).into_response()
}

/// A merge checked against the settings' revision the page read (`If-Match`, fix-offline-master-5): stale, it is the
/// kit's 409 with the stored settings as `current`; merged, the settings answer with their new revision as `ETag`.
pub async fn patch_settings(
    State(s): Shared,
    if_match: IfMatch,
    axum::Json(body): axum::Json<Value>,
) -> Response {
    match s.merge_settings_if(body, if_match.precondition()).await {
        Ok((settings, rev)) => Revisioned::new(rev, settings).into_response(),
        Err(Refused::Stale(stale)) => {
            let (current, _) = s.settings().await;
            Conflict::from(stale).with_item(current).into_response()
        }
        Err(e) => answer(Err::<Value, _>(e)),
    }
}

/// The settings as the one item of their collection.
pub async fn settings_item_route(State(s): Shared, Path(id): Path<String>) -> Response {
    if id != SETTINGS_KEY {
        return answer(Err::<Value, _>(Refused::NotFound));
    }
    let (settings, rev) = s.settings().await;
    Revisioned::new(rev, settings_item(&settings, rev)).into_response()
}

/// The collection's merge: as `PATCH /data/settings`, answering the item. The kit's client may send the record's own
/// `id` and `rev` along; they are bookkeeping, never settings keys, so they are taken out before the merge.
pub async fn patch_settings_item(
    State(s): Shared,
    Path(id): Path<String>,
    if_match: IfMatch,
    axum::Json(mut body): axum::Json<Value>,
) -> Response {
    if id != SETTINGS_KEY {
        return answer(Err::<Value, _>(Refused::NotFound));
    }
    if let Some(obj) = body.as_object_mut() {
        obj.remove("id");
        obj.remove("rev");
    }
    match s.merge_settings_if(body, if_match.precondition()).await {
        Ok((settings, rev)) => Revisioned::new(rev, settings_item(&settings, rev)).into_response(),
        Err(Refused::Stale(stale)) => {
            let (current, rev) = s.settings().await;
            Conflict::from(stale)
                .with_item(settings_item(&current, rev))
                .into_response()
        }
        Err(e) => answer(Err::<Value, _>(e)),
    }
}
