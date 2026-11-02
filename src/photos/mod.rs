//! Recipe photos: image files in the state directory, behind the login.
//!
//! Kenny, 24/10/2026 05:23: a step (and the recipe itself) can carry photos
//! that make it clearer. The bytes live as `<state>/photos/<uuid>.<ext>`, so
//! the homelab backup of the state directory takes them with `kitchen.json`;
//! a recipe only refers to them by id (`DATA.md`). The browser has already
//! made the picture smaller; this module still trusts nothing it is given:
//!
//! * the declared type must be `image/jpeg` or `image/webp`, and the first
//!   bytes must say the same (a renamed file of another kind is refused);
//! * at most [`MAX_BYTES`] (4 MiB);
//! * the id is issued here, never taken from the client; a path id must be a
//!   plain lower-case hyphenated UUID, so there is no way to name another
//!   file (no `..`, no slash, no extension);
//! * the file name is never used, and the extension comes from the sniffed
//!   type;
//! * the write is the kit's `write_atomic` (temp + fsync + rename), as the
//!   kitchen file's is.
//!
//! | Route | Does |
//! |---|---|
//! | `POST /data/photos` | body = the image bytes; the answer is `{"id": …}` |
//! | `GET /data/photos/{id}` | the image, with its type and a long private cache |
//! | `DELETE /data/photos/{id}` | removes the file; 404 when it is not there |
//!
//! No tests here touch the disk: the id, type and size checks are plain
//! functions with unit tests below.

use std::path::{Path as FsPath, PathBuf};
use std::sync::Arc;

use axum::body::Bytes;
use axum::extract::{DefaultBodyLimit, Path, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::json;

mod check;
pub use check::*;

#[derive(Clone)]
struct Dir(Arc<PathBuf>);

/// The photo routes for the photos directory under `state_dir`.
pub fn router(state_dir: &FsPath) -> Router {
    let dir = Dir(Arc::new(state_dir.join("photos")));
    Router::new()
        .route(
            "/data/photos",
            post(upload)
                // One byte over the cap, so the handler can say it in words.
                .layer(DefaultBodyLimit::max(MAX_BYTES + 1)),
        )
        .route("/data/photos/{id}", get(show).delete(remove))
        .with_state(dir)
}

fn refuse(code: StatusCode, message: &str) -> Response {
    (code, Json(json!({ "error": message }))).into_response()
}

fn disk(e: impl std::fmt::Display) -> Response {
    refuse(
        StatusCode::INTERNAL_SERVER_ERROR,
        &format!("could not save: {e}"),
    )
}

async fn upload(State(dir): State<Dir>, headers: HeaderMap, body: Bytes) -> Response {
    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let kind = match check_upload(content_type, &body) {
        Ok(k) => k,
        Err(e) => return refuse(e.status(), &e.to_string()),
    };
    let id = uuid::Uuid::new_v4().to_string();
    let path = dir.0.join(format!("{id}.{}", kind.ext()));
    let folder = dir.0.clone();
    let written = tokio::task::spawn_blocking(move || {
        std::fs::create_dir_all(folder.as_path()).map_err(|e| e.to_string())?;
        chassis::shell::store::write_atomic(&path, &body, "a recipe photo")
            .map_err(|e| e.to_string())
    })
    .await;
    match written {
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!({ "id": id }))).into_response(),
        Ok(Err(e)) => disk(e),
        Err(e) => disk(e),
    }
}

async fn show(State(dir): State<Dir>, Path(id): Path<String>) -> Response {
    if !valid_id(&id) {
        return refuse(
            StatusCode::NOT_FOUND,
            "that photo does not exist (any more)",
        );
    }
    let found = tokio::task::spawn_blocking(move || {
        Kind::ALL.into_iter().find_map(|k| {
            std::fs::read(dir.0.join(format!("{id}.{}", k.ext())))
                .ok()
                .map(|bytes| (k, bytes))
        })
    })
    .await
    .ok()
    .flatten();
    match found {
        Some((kind, bytes)) => {
            let mut res = bytes.into_response();
            let h = res.headers_mut();
            h.insert(header::CONTENT_TYPE, HeaderValue::from_static(kind.mime()));
            // The id never changes what it points at, so it may be kept for a year.
            h.insert(
                header::CACHE_CONTROL,
                HeaderValue::from_static("private, max-age=31536000, immutable"),
            );
            h.insert(
                header::X_CONTENT_TYPE_OPTIONS,
                HeaderValue::from_static("nosniff"),
            );
            res
        }
        None => refuse(
            StatusCode::NOT_FOUND,
            "that photo does not exist (any more)",
        ),
    }
}

async fn remove(State(dir): State<Dir>, Path(id): Path<String>) -> Response {
    if !valid_id(&id) {
        return refuse(
            StatusCode::NOT_FOUND,
            "that photo does not exist (any more)",
        );
    }
    let shown = id.clone();
    let gone = tokio::task::spawn_blocking(move || remove_files(&dir.0, &id)).await;
    match gone {
        Ok(Ok(0)) => refuse(
            StatusCode::NOT_FOUND,
            "that photo does not exist (any more)",
        ),
        Ok(Ok(_)) => Json(json!({ "deleted": shown })).into_response(),
        Ok(Err(e)) => refuse(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("could not delete the photo: {e}"),
        ),
        Err(e) => refuse(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("could not delete the photo: {e}"),
        ),
    }
}

/// Delete every file of photo `id` in `dir`; answers how many there were. A kind that is not there is fine; any other
/// failure is an error, so a file that could not go never reads as one that was never there.
pub(crate) fn remove_files(dir: &FsPath, id: &str) -> std::io::Result<usize> {
    let mut gone = 0;
    for k in Kind::ALL {
        match std::fs::remove_file(dir.join(format!("{id}.{}", k.ext()))) {
            Ok(()) => gone += 1,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e),
        }
    }
    Ok(gone)
}

#[cfg(test)]
mod tests;
