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

/// The most a photo may weigh. The browser aims far below this (1600 px).
pub const MAX_BYTES: usize = 4 * 1024 * 1024;

/// The two kinds of picture kitchen keeps.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Jpeg,
    Webp,
}

impl Kind {
    pub fn mime(self) -> &'static str {
        match self {
            Kind::Jpeg => "image/jpeg",
            Kind::Webp => "image/webp",
        }
    }

    pub fn ext(self) -> &'static str {
        match self {
            Kind::Jpeg => "jpg",
            Kind::Webp => "webp",
        }
    }

    const ALL: [Kind; 2] = [Kind::Jpeg, Kind::Webp];
}

/// Why an upload was refused, in words a page shows as they are.
#[derive(Debug, PartialEq)]
pub enum Refusal {
    Empty,
    TooLarge,
    WrongType,
    NotWhatItSays,
}

impl Refusal {
    fn status(&self) -> StatusCode {
        match self {
            Refusal::Empty | Refusal::NotWhatItSays => StatusCode::BAD_REQUEST,
            Refusal::TooLarge => StatusCode::PAYLOAD_TOO_LARGE,
            Refusal::WrongType => StatusCode::UNSUPPORTED_MEDIA_TYPE,
        }
    }
}

impl std::fmt::Display for Refusal {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Refusal::Empty => write!(f, "the photo is empty"),
            Refusal::TooLarge => write!(f, "the photo is larger than 4 MiB"),
            Refusal::WrongType => write!(f, "send a JPEG or a WebP photo"),
            Refusal::NotWhatItSays => {
                write!(f, "the file is not the kind of picture it says it is")
            }
        }
    }
}

/// A photo id from an address: a plain lower-case hyphenated UUID, nothing else.
pub fn valid_id(id: &str) -> bool {
    match uuid::Uuid::parse_str(id) {
        Ok(u) => u.hyphenated().to_string() == id,
        Err(_) => false,
    }
}

/// The kind the first bytes show, if it is one kitchen keeps.
pub fn sniff(bytes: &[u8]) -> Option<Kind> {
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some(Kind::Jpeg)
    } else if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some(Kind::Webp)
    } else {
        None
    }
}

/// The declared kind of a `Content-Type` value (parameters ignored).
fn declared(content_type: &str) -> Option<Kind> {
    let essence = content_type
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    Kind::ALL.into_iter().find(|k| k.mime() == essence)
}

/// Everything that decides whether an upload is kept.
pub fn check_upload(content_type: &str, bytes: &[u8]) -> Result<Kind, Refusal> {
    let kind = declared(content_type).ok_or(Refusal::WrongType)?;
    if bytes.is_empty() {
        return Err(Refusal::Empty);
    }
    if bytes.len() > MAX_BYTES {
        return Err(Refusal::TooLarge);
    }
    if sniff(bytes) != Some(kind) {
        return Err(Refusal::NotWhatItSays);
    }
    Ok(kind)
}

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
    let gone = tokio::task::spawn_blocking(move || {
        Kind::ALL
            .into_iter()
            .filter(|k| std::fs::remove_file(dir.0.join(format!("{id}.{}", k.ext()))).is_ok())
            .count()
    })
    .await
    .unwrap_or(0);
    if gone == 0 {
        refuse(
            StatusCode::NOT_FOUND,
            "that photo does not exist (any more)",
        )
    } else {
        Json(json!({ "deleted": shown })).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const JPEG: &[u8] = &[0xFF, 0xD8, 0xFF, 0xE0, 0, 16];
    const WEBP: &[u8] = b"RIFF\x24\0\0\0WEBPVP8 ";

    #[test]
    fn ids_must_be_plain_uuids() {
        assert!(valid_id("0b9e6c1e-2f4a-4c1d-9a37-5d1f0a6f9b21"));
        for bad in [
            "",
            "..",
            "../kitchen",
            "0b9e6c1e-2f4a-4c1d-9a37-5d1f0a6f9b21.jpg",
            "0b9e6c1e2f4a4c1d9a375d1f0a6f9b21",
            "{0b9e6c1e-2f4a-4c1d-9a37-5d1f0a6f9b21}",
            "0B9E6C1E-2F4A-4C1D-9A37-5D1F0A6F9B21",
            "urn:uuid:0b9e6c1e-2f4a-4c1d-9a37-5d1f0a6f9b21",
            "0b9e6c1e-2f4a-4c1d-9a37-5d1f0a6f9b2/",
        ] {
            assert!(!valid_id(bad), "{bad:?} must be refused");
        }
    }

    #[test]
    fn only_jpeg_and_webp_that_really_are() {
        assert_eq!(check_upload("image/jpeg", JPEG), Ok(Kind::Jpeg));
        assert_eq!(check_upload("image/webp", WEBP), Ok(Kind::Webp));
        assert_eq!(check_upload("IMAGE/WEBP; q=1", WEBP), Ok(Kind::Webp));
        assert_eq!(check_upload("image/png", JPEG), Err(Refusal::WrongType));
        assert_eq!(check_upload("", JPEG), Err(Refusal::WrongType));
        assert_eq!(
            check_upload("image/jpeg", WEBP),
            Err(Refusal::NotWhatItSays)
        );
        assert_eq!(
            check_upload("image/webp", b"<svg onload=x>"),
            Err(Refusal::NotWhatItSays)
        );
        assert_eq!(check_upload("image/jpeg", b""), Err(Refusal::Empty));
    }

    #[test]
    fn the_size_cap_is_four_mib() {
        let mut ok = JPEG.to_vec();
        ok.resize(MAX_BYTES, 0);
        assert_eq!(check_upload("image/jpeg", &ok), Ok(Kind::Jpeg));
        ok.push(0);
        assert_eq!(check_upload("image/jpeg", &ok), Err(Refusal::TooLarge));
    }
}
