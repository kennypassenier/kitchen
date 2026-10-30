//! Import a recipe from a website or from pasted text (Kenny, 29/10/2026 14:27).
//!
//! | Route | Does |
//! |---|---|
//! | `POST /data/import` | `{"url": …}` or `{"text": …}`; the answer is the normalised recipe (`recipe_parse::Imported`) |
//! | `POST /data/import/image` | `{"url": …}`; the answer is the picture's bytes (JPEG, PNG or WebP), fetched with the same safe fetch |
//!
//! Both routes sit behind the login (the dashboard router) and never on the
//! parents' host: `parents_guard` sends every path but `/`, `/eten…`,
//! `/static/…` and `/healthz` back to the wheel there.
//!
//! The server fetches an address a person typed, so the fetch is the careful
//! part (a request forgery would otherwise let a page reach the home network):
//!
//! * `http` and `https` only, the default port of each only, no user name or
//!   password in the address;
//! * the host is resolved here and every address it resolves to must be a
//!   public one ([`allowed_ip`]: not loopback, private, link-local,
//!   unique-local, unspecified, multicast, shared/CGNAT, reserved, nor any
//!   IPv4-mapped, NAT64 or 6to4 form of those) BEFORE anything connects;
//! * the connection goes to the checked address (`ClientBuilder::resolve`
//!   pins it, so a second DNS answer cannot replace it; TLS still verifies
//!   the host name), and the system proxy is switched off so nothing can
//!   route around the pin;
//! * redirects are followed by hand, at most [`MAX_REDIRECTS`], each target
//!   checked the same way;
//! * one total deadline of [`TOTAL`], a body cap (stops reading past it), no
//!   cookies, no credentials, no `Authorization` and no `Referer`, and one
//!   plain `User-Agent`.
//!
//! A failure is `{"error": "<code>"}`; the page turns the code into words.

use std::time::Duration;

use axum::body::Bytes;
use axum::http::{HeaderValue, header};
use axum::response::{IntoResponse, Response};
use axum::routing::post;
use axum::{Json, Router};
use serde::Deserialize;

use crate::recipe_parse;

mod fail;
mod fetch;
mod ssrf;

pub use fail::Fail;
use fetch::{Want, fetch, sniff_image};

/// Redirects followed before giving up.
pub const MAX_REDIRECTS: usize = 3;
/// The whole fetch, DNS to last byte.
pub const TOTAL: Duration = Duration::from_secs(10);
/// A page may weigh this much.
pub const PAGE_CAP: usize = 2 * 1024 * 1024;
/// A picture may weigh this much (the photo cap, `photos::MAX_BYTES`).
pub const IMAGE_CAP: usize = 4 * 1024 * 1024;
const AGENT: &str = "Kitchen recipe import";

#[derive(Deserialize)]
struct Ask {
    url: Option<String>,
    text: Option<String>,
}

async fn import(Json(ask): Json<Ask>) -> Result<Json<serde_json::Value>, Fail> {
    if let Some(text) = ask.text.as_deref().filter(|t| !t.trim().is_empty()) {
        let found = recipe_parse::from_text(text);
        return if found.usable() {
            Ok(Json(found.to_json()))
        } else {
            Err(Fail::NoRecipe)
        };
    }
    let url = ask
        .url
        .as_deref()
        .filter(|u| !u.trim().is_empty())
        .ok_or(Fail::Empty)?;
    let page = fetch(url, Want::Html, PAGE_CAP).await?;
    let html = String::from_utf8_lossy(&page.body);
    recipe_parse::from_page(&html, Some(&page.final_url))
        .map(|r| Json(r.to_json()))
        .ok_or(Fail::NoRecipe)
}

async fn image(Json(ask): Json<Ask>) -> Result<Response, Fail> {
    let url = ask
        .url
        .as_deref()
        .filter(|u| !u.trim().is_empty())
        .ok_or(Fail::Empty)?;
    let got = fetch(url, Want::Image, IMAGE_CAP).await?;
    let kind = sniff_image(&got.body).ok_or(Fail::NotImage)?;
    let mut res = Bytes::from(got.body).into_response();
    let h = res.headers_mut();
    h.insert(header::CONTENT_TYPE, HeaderValue::from_static(kind));
    h.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    h.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    Ok(res)
}

/// The import routes (behind the login: they are added to the dashboard router).
pub fn router() -> Router {
    Router::new()
        .route("/data/import", post(import))
        .route("/data/import/image", post(image))
}

#[cfg(test)]
mod tests;
