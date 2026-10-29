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

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, ToSocketAddrs};
use std::time::Duration;

use axum::body::Bytes;
use axum::http::{HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::post;
use axum::{Json, Router};
use reqwest::Url;
use serde::Deserialize;
use serde_json::json;

use crate::recipe_parse;

/// Redirects followed before giving up.
pub const MAX_REDIRECTS: usize = 3;
/// The whole fetch, DNS to last byte.
pub const TOTAL: Duration = Duration::from_secs(10);
/// A page may weigh this much.
pub const PAGE_CAP: usize = 2 * 1024 * 1024;
/// A picture may weigh this much (the photo cap, `photos::MAX_BYTES`).
pub const IMAGE_CAP: usize = 4 * 1024 * 1024;
const AGENT: &str = "Kitchen recipe import";

/// Why an import failed. The code is what the page maps to words.
#[derive(Debug, PartialEq)]
pub enum Fail {
    BadUrl,
    Blocked,
    Unreachable,
    TooManyRedirects,
    NotHtml,
    NotImage,
    TooLarge,
    Timeout,
    Status(u16),
    NoRecipe,
    Empty,
}

impl Fail {
    pub fn code(&self) -> &'static str {
        match self {
            Fail::BadUrl => "bad_url",
            Fail::Blocked => "blocked_address",
            Fail::Unreachable => "unreachable",
            Fail::TooManyRedirects => "too_many_redirects",
            Fail::NotHtml => "not_html",
            Fail::NotImage => "not_image",
            Fail::TooLarge => "too_large",
            Fail::Timeout => "timeout",
            Fail::Status(_) => "http_status",
            Fail::NoRecipe => "no_recipe",
            Fail::Empty => "empty",
        }
    }

    fn status(&self) -> StatusCode {
        match self {
            Fail::BadUrl | Fail::Blocked | Fail::Empty => StatusCode::BAD_REQUEST,
            Fail::NoRecipe | Fail::NotHtml | Fail::NotImage => StatusCode::UNPROCESSABLE_ENTITY,
            Fail::TooLarge => StatusCode::PAYLOAD_TOO_LARGE,
            Fail::Timeout => StatusCode::GATEWAY_TIMEOUT,
            Fail::Unreachable | Fail::TooManyRedirects | Fail::Status(_) => StatusCode::BAD_GATEWAY,
        }
    }
}

impl IntoResponse for Fail {
    fn into_response(self) -> Response {
        let mut body = json!({ "error": self.code() });
        if let Fail::Status(s) = self {
            body["status"] = json!(s);
        }
        (self.status(), Json(body)).into_response()
    }
}

// ---- which addresses may be fetched -------------------------------------------------------------------------------

fn allowed_v4(a: Ipv4Addr) -> bool {
    let o = a.octets();
    !(a.is_loopback()                         // 127/8
        || a.is_private()                     // 10/8, 172.16/12, 192.168/16
        || a.is_link_local()                  // 169.254/16
        || a.is_unspecified()                 // 0.0.0.0
        || a.is_multicast()                   // 224/4
        || a.is_broadcast()
        || a.is_documentation()
        || o[0] == 0                          // 0/8 "this network"
        || (o[0] == 100 && (o[1] & 0xC0) == 64) // 100.64/10 shared (CGNAT, Tailscale)
        || (o[0] == 192 && o[1] == 0 && o[2] == 0) // 192.0.0/24 protocol assignments
        || (o[0] == 198 && (o[1] & 0xFE) == 18) // 198.18/15 benchmarking
        || o[0] >= 240) // 240/4 reserved
}

fn allowed_v6(a: Ipv6Addr) -> bool {
    let s = a.segments();
    // IPv4 hidden inside an IPv6 address is judged as the IPv4 address it is.
    if let Some(v4) = a.to_ipv4_mapped() {
        return allowed_v4(v4);
    }
    // ::a.b.c.d (deprecated IPv4-compatible) and 64:ff9b::/96 (NAT64).
    if s[..6] == [0, 0, 0, 0, 0, 0] || s[..6] == [0x64, 0xff9b, 0, 0, 0, 0] {
        let v4 = Ipv4Addr::new((s[6] >> 8) as u8, s[6] as u8, (s[7] >> 8) as u8, s[7] as u8);
        return allowed_v4(v4) && !a.is_unspecified() && !a.is_loopback();
    }
    // 2002::/16 (6to4) carries an IPv4 address in the next 32 bits.
    if s[0] == 0x2002 {
        return allowed_v4(Ipv4Addr::new(
            (s[1] >> 8) as u8,
            s[1] as u8,
            (s[2] >> 8) as u8,
            s[2] as u8,
        ));
    }
    !(a.is_loopback()
        || a.is_unspecified()
        || a.is_multicast()
        || (s[0] & 0xFFC0) == 0xFE80 // fe80::/10 link-local
        || (s[0] & 0xFFC0) == 0xFEC0 // fec0::/10 site-local (deprecated)
        || (s[0] & 0xFE00) == 0xFC00 // fc00::/7 unique-local
        || (s[0] == 0x2001 && s[1] == 0x0db8)) // documentation
}

/// Whether an address is a public one that may be connected to.
pub fn allowed_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(a) => allowed_v4(a),
        IpAddr::V6(a) => allowed_v6(a),
    }
}

/// The address text as a [`Url`], http(s) only, default port only, no credentials.
pub fn parse_url(text: &str) -> Result<Url, Fail> {
    let url = Url::parse(text.trim()).map_err(|_| Fail::BadUrl)?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
    {
        return Err(Fail::BadUrl);
    }
    Ok(url)
}

/// What to do with a response, as a pure decision (so the limits are tested without a network).
#[derive(Debug, PartialEq)]
pub enum Hop {
    /// A final answer: read the body.
    Read,
    /// Fetch this address next.
    Follow(Url),
}

/// A redirect response's next step. `hops` is how many redirects were already followed.
pub fn next_hop(base: &Url, status: u16, location: Option<&str>, hops: usize) -> Result<Hop, Fail> {
    if !matches!(status, 301 | 302 | 303 | 307 | 308) {
        return Ok(Hop::Read);
    }
    if hops >= MAX_REDIRECTS {
        return Err(Fail::TooManyRedirects);
    }
    let target = base
        .join(location.ok_or(Fail::Unreachable)?.trim())
        .map_err(|_| Fail::BadUrl)?;
    // The target is judged like a typed address (scheme, port, credentials) before its host is resolved.
    parse_url(target.as_str()).map(Hop::Follow)
}

/// Resolve the host of `url` and return the one address to connect to; every address it resolves to must be allowed.
async fn vet(url: &Url) -> Result<SocketAddr, Fail> {
    let port = url.port_or_known_default().ok_or(Fail::BadUrl)?;
    let host = url.host_str().ok_or(Fail::BadUrl)?;
    // The URL parser has already turned decimal, hex and short IPv4 spellings into dotted form; an IPv6 host is bracketed.
    let addrs: Vec<IpAddr> = match host.trim_matches(['[', ']']).parse::<IpAddr>() {
        Ok(literal) => vec![literal],
        Err(_) => {
            let name = host.to_string();
            tokio::task::spawn_blocking(move || {
                (name.as_str(), 0u16)
                    .to_socket_addrs()
                    .map(|i| i.map(|s| s.ip()).collect::<Vec<_>>())
            })
            .await
            .map_err(|_| Fail::Unreachable)?
            .map_err(|_| Fail::Unreachable)?
        }
    };
    if addrs.is_empty() {
        return Err(Fail::Unreachable);
    }
    if !addrs.iter().all(|a| allowed_ip(*a)) {
        return Err(Fail::Blocked);
    }
    Ok(SocketAddr::new(addrs[0], port))
}

/// What kind of body a fetch expects.
#[derive(Clone, Copy, PartialEq)]
pub enum Want {
    Html,
    Image,
}

struct Fetched {
    final_url: Url,
    body: Vec<u8>,
}

async fn fetch_inner(start: Url, want: Want, cap: usize) -> Result<Fetched, Fail> {
    let mut url = start;
    let mut hops = 0;
    loop {
        let addr = vet(&url).await?;
        let mut builder = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .no_proxy()
            .user_agent(AGENT)
            .timeout(TOTAL)
            .referer(false);
        if let Some(domain) = url.domain() {
            builder = builder.resolve(domain, addr);
        }
        let client = builder.build().map_err(|_| Fail::Unreachable)?;
        let accept = if want == Want::Html {
            "text/html,application/xhtml+xml"
        } else {
            "image/jpeg,image/png,image/webp"
        };
        let mut res = client
            .get(url.clone())
            .header(header::ACCEPT, accept)
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    Fail::Timeout
                } else {
                    Fail::Unreachable
                }
            })?;
        let status = res.status().as_u16();
        let location = res
            .headers()
            .get(header::LOCATION)
            .and_then(|v| v.to_str().ok());
        match next_hop(&url, status, location, hops)? {
            Hop::Follow(next) => {
                url = next;
                hops += 1;
                continue;
            }
            Hop::Read => {}
        }
        if !res.status().is_success() {
            return Err(Fail::Status(status));
        }
        if want == Want::Html {
            let essence = res
                .headers()
                .get(header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
                .split(';')
                .next()
                .unwrap_or("")
                .trim()
                .to_ascii_lowercase();
            if essence != "text/html" && essence != "application/xhtml+xml" {
                return Err(Fail::NotHtml);
            }
        }
        if res.content_length().is_some_and(|n| n > cap as u64) {
            return Err(Fail::TooLarge);
        }
        let mut body = Vec::new();
        while let Some(chunk) = res.chunk().await.map_err(|e| {
            if e.is_timeout() {
                Fail::Timeout
            } else {
                Fail::Unreachable
            }
        })? {
            if body.len() + chunk.len() > cap {
                return Err(Fail::TooLarge);
            }
            body.extend_from_slice(&chunk);
        }
        return Ok(Fetched {
            final_url: url,
            body,
        });
    }
}

/// The safe fetch, under the one total deadline.
async fn fetch(url: &str, want: Want, cap: usize) -> Result<Fetched, Fail> {
    let start = parse_url(url)?;
    tokio::time::timeout(TOTAL, fetch_inner(start, want, cap))
        .await
        .map_err(|_| Fail::Timeout)?
}

/// The picture kinds the import passes on, by their first bytes.
pub fn sniff_image(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("image/jpeg")
    } else if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]) {
        Some("image/png")
    } else if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some("image/webp")
    } else {
        None
    }
}

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
mod tests {
    use super::*;

    fn ip(s: &str) -> IpAddr {
        s.parse().unwrap()
    }

    #[test]
    fn every_blocked_range_is_refused() {
        for bad in [
            "127.0.0.1",
            "127.255.255.254",
            "10.0.0.1",
            "10.10.10.1",
            "172.16.0.1",
            "172.31.255.255",
            "192.168.1.1",
            "169.254.169.254",
            "0.0.0.0",
            "0.1.2.3",
            "224.0.0.1",
            "239.255.255.255",
            "255.255.255.255",
            "100.64.0.1",
            "100.127.255.255",
            "192.0.0.8",
            "198.18.0.1",
            "240.0.0.1",
            "192.0.2.1",
            "::1",
            "::",
            "fe80::1",
            "febf::1",
            "fc00::1",
            "fd12:3456::1",
            "ff02::1",
            "fec0::1",
            "::ffff:10.0.0.1",
            "::ffff:127.0.0.1",
            "::ffff:192.168.0.5",
            "::ffff:169.254.1.1",
            "::ffff:0.0.0.0",
            "::10.0.0.1",
            "64:ff9b::a00:1",
            "2002:0a00:0001::1",
            "2002:7f00:1::1",
            "2001:db8::1",
        ] {
            assert!(!allowed_ip(ip(bad)), "{bad} must be refused");
        }
    }

    #[test]
    fn public_addresses_pass() {
        for good in [
            "93.184.216.34",
            "8.8.8.8",
            "172.15.0.1",
            "172.32.0.1",
            "100.63.255.255",
            "100.128.0.1",
            "1.1.1.1",
            "2606:4700:4700::1111",
            "::ffff:8.8.8.8",
            "2002:0808:0808::1",
            "64:ff9b::808:808",
        ] {
            assert!(allowed_ip(ip(good)), "{good} must pass");
        }
    }

    #[test]
    fn odd_ip_spellings_are_the_same_addresses() {
        // The URL parser turns decimal, hex and short forms into the plain IPv4 address.
        for spelled in [
            "http://2130706433/",
            "http://0x7f.1/",
            "http://0177.0.0.1/",
            "http://127.1/",
            "http://[::ffff:127.0.0.1]/",
        ] {
            let url = parse_url(spelled).unwrap();
            let literal: IpAddr = url
                .host_str()
                .unwrap()
                .trim_matches(['[', ']'])
                .parse()
                .unwrap();
            assert!(!allowed_ip(literal), "{spelled}");
        }
    }

    #[test]
    fn only_plain_web_addresses_are_accepted() {
        assert!(parse_url("https://example.com/a?b=1").is_ok());
        assert!(parse_url("  http://example.com  ").is_ok());
        for bad in [
            "ftp://example.com/",
            "file:///etc/passwd",
            "javascript:alert(1)",
            "gopher://example.com",
            "example.com",
            "https://user:pw@example.com/",
            "https://user@example.com/",
            "http://example.com:8080/",
            "https://example.com:22/",
            "",
            "http://",
            "data:text/html,hi",
        ] {
            assert_eq!(parse_url(bad).err(), Some(Fail::BadUrl), "{bad:?}");
        }
    }

    #[test]
    fn redirects_stop_after_three_and_are_judged_again() {
        let base = Url::parse("https://example.com/a/b").unwrap();
        for n in 0..MAX_REDIRECTS {
            assert_eq!(
                next_hop(&base, 302, Some("/next"), n),
                Ok(Hop::Follow(Url::parse("https://example.com/next").unwrap()))
            );
        }
        assert_eq!(
            next_hop(&base, 301, Some("/next"), MAX_REDIRECTS),
            Err(Fail::TooManyRedirects)
        );
        assert_eq!(next_hop(&base, 200, None, 0), Ok(Hop::Read));
        assert_eq!(next_hop(&base, 404, None, 9), Ok(Hop::Read));
        // A relative target is joined to the current address.
        assert_eq!(
            next_hop(&base, 307, Some("c"), 0),
            Ok(Hop::Follow(Url::parse("https://example.com/a/c").unwrap()))
        );
        // A redirect may not lead to another scheme, a credential or a port; no Location is a dead end.
        assert_eq!(
            next_hop(&base, 302, Some("ftp://example.com/"), 0),
            Err(Fail::BadUrl)
        );
        assert_eq!(
            next_hop(&base, 302, Some("http://a:b@example.com/"), 0),
            Err(Fail::BadUrl)
        );
        assert_eq!(
            next_hop(&base, 302, Some("http://example.com:81/"), 0),
            Err(Fail::BadUrl)
        );
        assert_eq!(next_hop(&base, 302, None, 0), Err(Fail::Unreachable));
        // A redirect to a private address is a normal Follow here; `vet` refuses it before connecting.
        assert!(matches!(
            next_hop(&base, 302, Some("http://10.0.0.1/"), 0),
            Ok(Hop::Follow(_))
        ));
    }

    #[tokio::test]
    async fn vet_refuses_literal_private_hosts_without_any_network() {
        for bad in [
            "http://10.10.10.1/",
            "http://127.0.0.1/",
            "http://[::1]/",
            "http://[::ffff:10.0.0.1]/",
            "http://0.0.0.0/",
            "http://169.254.169.254/latest",
        ] {
            assert_eq!(
                vet(&parse_url(bad).unwrap()).await,
                Err(Fail::Blocked),
                "{bad}"
            );
        }
        assert!(vet(&parse_url("http://8.8.8.8/").unwrap()).await.is_ok());
    }

    #[test]
    fn pictures_are_known_by_their_first_bytes() {
        assert_eq!(sniff_image(&[0xFF, 0xD8, 0xFF, 0xE0]), Some("image/jpeg"));
        assert_eq!(sniff_image(b"\x89PNG\r\n\x1a\n\0\0"), Some("image/png"));
        assert_eq!(sniff_image(b"RIFF\x24\0\0\0WEBPVP8 "), Some("image/webp"));
        assert_eq!(sniff_image(b"<svg onload=x>"), None);
        assert_eq!(sniff_image(b"GIF89a"), None);
        assert_eq!(sniff_image(b""), None);
    }

    #[test]
    fn failures_carry_their_codes() {
        assert_eq!(Fail::Blocked.code(), "blocked_address");
        assert_eq!(Fail::Status(404).code(), "http_status");
        assert_eq!(Fail::Timeout.status(), StatusCode::GATEWAY_TIMEOUT);
        assert_eq!(Fail::TooLarge.code(), "too_large");
    }
}
