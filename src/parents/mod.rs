//! The parents' wheel without an account (Kenny, 22/10/2026).
//!
//! Kenny's parents open the wheel on `eten.kp-soft.dev`, in Dutch, with no
//! login. These routes live on the kit's public router, so the login never
//! sees them, and they show nothing but what the wheel needs:
//!
//! | Route | Does |
//! |---|---|
//! | `GET /eten` | the Dutch page (`web/eten/index.html`) |
//! | `GET /eten/{file}` | its script and sheet, and the wheel module Kitchen's own English page shares |
//! | `GET /eten/data` | the dishes on the wheel, in Dutch: names, category, the sides |
//!
//! The English copy of the same list (`GET /data/wheel/en`) sits behind the
//! login with the rest of Kitchen. Both come from [`wheel`], so the rule
//! "a dish shows in each language it has a name for" lives in one place.
//!
//! The wheel answers only Kenny's home network (`KITCHEN_PARENTS_ALLOW`,
//! default `10.10.10.0/24`; Kenny, 22/10/2026 23:08): eten.kp-soft.dev has
//! no public record and no Cloudflare, and [`parents_guard`] refuses the page
//! and its data (`/eten`, `/eten/data`) to any other address as a second
//! lock; the wheel's script and sheet pass, since Kitchen's own `/parents`
//! loads them too. When `KITCHEN_PARENTS_HOST` names
//! a host, the guard also keeps that host to the wheel: its root answers the
//! page, `/eten…`, `/static/…` and `/healthz` pass, and every other path
//! sends the visitor back to the wheel, so the login page is never reachable
//! there.

use std::path::PathBuf;
use std::sync::{Arc, OnceLock};

use axum::Router;
use axum::extract::{Path, State};
use axum::http::{StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use serde_json::json;

use crate::store::Store;

mod guard;
mod wheel;

pub use guard::{Allow, parents_guard};
pub use wheel::{Lang, wheel};

/// Where the page's files come from: the binary's copy, or `web/` on disk
/// in development (`KITCHEN_WEB_DIR`).
#[derive(Clone)]
pub struct Files {
    pub dir: Option<PathBuf>,
}

impl Files {
    /// The bytes of `eten/<name>`, for a plain file name only.
    fn read(&self, name: &str) -> Option<Vec<u8>> {
        let plain = !name.is_empty()
            && name
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '.')
            && !name.starts_with('.');
        if !plain {
            return None;
        }
        let rel = format!("eten/{name}");
        match &self.dir {
            Some(dir) => std::fs::read(dir.join(&rel)).ok(),
            None => crate::FILES
                .iter()
                .find(|(p, _)| *p == rel)
                .map(|(_, b)| b.to_vec()),
        }
    }
}

/// The store, filled in once it has opened. The kit takes its public routes
/// when the app is built, before the state directory is known, so the
/// router holds this slot and answers 503 until the store is in it.
pub type Slot = Arc<OnceLock<Arc<Store>>>;

#[derive(Clone)]
struct Public {
    store: Slot,
    files: Files,
}

pub fn router(store: Slot, files: Files) -> Router {
    Router::new()
        .route("/eten", get(page))
        .route("/eten/data", get(dutch))
        .route("/eten/{file}", get(file))
        .with_state(Public { store, files })
}

/// The list in either language for Kitchen's own page, behind the login
/// (`/data/wheel/en`, `/data/wheel/nl`): Kitchen's /parents follows the
/// NL/EN toggle (Kenny, 24/10/2026 05:12), also away from home, where
/// `/eten/data` is refused.
pub fn english(store: Arc<Store>) -> Router {
    Router::new()
        .route(
            "/data/wheel/en",
            get(|State(s): State<Arc<Store>>| async move {
                axum::Json(wheel(&s.snapshot().await, Lang::En))
            }),
        )
        .route(
            "/data/wheel/nl",
            get(|State(s): State<Arc<Store>>| async move {
                axum::Json(wheel(&s.snapshot().await, Lang::Nl))
            }),
        )
        .with_state(store)
}

pub fn page_response(files: &Files) -> Response {
    serve(files, "index.html")
}

async fn page(State(p): State<Public>) -> Response {
    page_response(&p.files)
}

async fn file(State(p): State<Public>, Path(name): Path<String>) -> Response {
    serve(&p.files, &name)
}

async fn dutch(State(p): State<Public>) -> Response {
    let Some(store) = p.store.get() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            axum::Json(json!({ "error": "De keuken start nog op; probeer zo opnieuw." })),
        )
            .into_response();
    };
    axum::Json(wheel(&store.snapshot().await, Lang::Nl)).into_response()
}

fn serve(files: &Files, name: &str) -> Response {
    let Some(bytes) = files.read(name) else {
        return (StatusCode::NOT_FOUND, "Deze pagina bestaat niet.").into_response();
    };
    let kind = match name.rsplit('.').next() {
        Some("html") => "text/html; charset=utf-8",
        Some("js") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("webmanifest") => "application/manifest+json",
        _ => "application/octet-stream",
    };
    (
        [
            (header::CONTENT_TYPE, kind),
            (header::CACHE_CONTROL, "no-cache"),
        ],
        bytes,
    )
        .into_response()
}

#[cfg(test)]
mod tests;
