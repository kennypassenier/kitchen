//! The safe fetch: one connection per hop to the checked address, redirects by hand, one total deadline.

use axum::http::header;
use reqwest::Url;

use super::fail::Fail;
use super::ssrf::{Hop, next_hop, parse_url, vet};
use super::{AGENT, TOTAL};

/// What kind of body a fetch expects.
#[derive(Clone, Copy, PartialEq)]
pub enum Want {
    Html,
    Image,
}

pub(super) struct Fetched {
    pub(super) final_url: Url,
    pub(super) body: Vec<u8>,
}

fn net_fail(e: reqwest::Error) -> Fail {
    if e.is_timeout() {
        Fail::Timeout
    } else {
        Fail::Unreachable
    }
}

/// A client that talks to the vetted address only, follows no redirect itself and sends no referer.
fn client_for(url: &Url, addr: std::net::SocketAddr) -> Result<reqwest::Client, Fail> {
    let mut builder = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .no_proxy()
        .user_agent(AGENT)
        .timeout(TOTAL)
        .referer(false);
    if let Some(domain) = url.domain() {
        builder = builder.resolve(domain, addr);
    }
    builder.build().map_err(|_| Fail::Unreachable)
}

/// A page must say it is HTML.
fn require_html(res: &reqwest::Response) -> Result<(), Fail> {
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
    Ok(())
}

/// The body, refused as soon as it passes the cap.
async fn read_body(mut res: reqwest::Response, cap: usize) -> Result<Vec<u8>, Fail> {
    if res.content_length().is_some_and(|n| n > cap as u64) {
        return Err(Fail::TooLarge);
    }
    let mut body = Vec::new();
    while let Some(chunk) = res.chunk().await.map_err(net_fail)? {
        if body.len() + chunk.len() > cap {
            return Err(Fail::TooLarge);
        }
        body.extend_from_slice(&chunk);
    }
    Ok(body)
}

async fn fetch_inner(start: Url, want: Want, cap: usize) -> Result<Fetched, Fail> {
    let mut url = start;
    let mut hops = 0;
    loop {
        let addr = vet(&url).await?;
        let client = client_for(&url, addr)?;
        let accept = if want == Want::Html {
            "text/html,application/xhtml+xml"
        } else {
            "image/jpeg,image/png,image/webp"
        };
        let res = client
            .get(url.clone())
            .header(header::ACCEPT, accept)
            .send()
            .await
            .map_err(net_fail)?;
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
            require_html(&res)?;
        }
        let body = read_body(res, cap).await?;
        return Ok(Fetched {
            final_url: url,
            body,
        });
    }
}

/// The safe fetch, under the one total deadline.
pub(super) async fn fetch(url: &str, want: Want, cap: usize) -> Result<Fetched, Fail> {
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
