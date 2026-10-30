//! The parents' wheel's lock: the home-network allow-list and the request guard built on it.

use std::net::IpAddr;

use axum::http::{StatusCode, header};
use axum::response::{IntoResponse, Redirect, Response};

use super::{Files, page_response};

/// The addresses the parents' wheel answers (`KITCHEN_PARENTS_ALLOW`,
/// default `10.10.10.0/24`, Kenny's trusted home network): a list of
/// addresses and `address/prefix` ranges, IPv4 or IPv6.
#[derive(Clone, Debug)]
pub struct Allow(Vec<(IpAddr, u8)>);

impl Allow {
    pub const DEFAULT: &'static str = "10.10.10.0/24";

    pub fn parse(list: &str) -> Result<Self, String> {
        let mut nets = Vec::new();
        for item in list.split(',').map(str::trim).filter(|s| !s.is_empty()) {
            let (addr, bits) = match item.split_once('/') {
                Some((a, b)) => (a, Some(b)),
                None => (item, None),
            };
            let addr: IpAddr = addr
                .parse()
                .map_err(|_| format!("KITCHEN_PARENTS_ALLOW: {item:?} is not an address"))?;
            let max = if addr.is_ipv4() { 32 } else { 128 };
            let bits = match bits {
                Some(b) => b.parse::<u8>().ok().filter(|b| *b <= max).ok_or_else(|| {
                    format!("KITCHEN_PARENTS_ALLOW: {item:?} has no valid prefix")
                })?,
                None => max,
            };
            nets.push((addr, bits));
        }
        Ok(Self(nets))
    }

    pub fn allows(&self, ip: IpAddr) -> bool {
        let ip = ip.to_canonical();
        self.0.iter().any(|(net, bits)| match (net, ip) {
            (IpAddr::V4(n), IpAddr::V4(a)) => {
                let mask = u32::MAX.checked_shl(32 - u32::from(*bits)).unwrap_or(0);
                u32::from(*n) & mask == u32::from(a) & mask
            }
            (IpAddr::V6(n), IpAddr::V6(a)) => {
                let mask = u128::MAX.checked_shl(128 - u32::from(*bits)).unwrap_or(0);
                u128::from(*n) & mask == u128::from(a) & mask
            }
            _ => false,
        })
    }
}

fn not_home() -> Response {
    (
        StatusCode::FORBIDDEN,
        [(header::CONTENT_TYPE, "text/plain; charset=utf-8")],
        "Het wiel werkt alleen thuis, op het wifi-netwerk van het huis.",
    )
        .into_response()
}

/// The paths only the home network may open: the Dutch page and its dishes.
/// The wheel's script and sheet under `/eten/` hold no data and pass from
/// anywhere, because Kitchen's own English page (`/parents`, behind the
/// login) loads them too: refused, the wheel broke for Kenny away from home
/// (found 24/10/2026, in Kitchen 1.0.0).
pub(super) fn home_only(path: &str) -> bool {
    path == "/eten" || path == "/eten/data" || app_file(path)
}

/// The parents' page as a home-screen web app (Kenny, 24/10/2026 11:00):
/// its manifest and icons belong to that page only and, like the page,
/// answer only the home network.
fn app_file(path: &str) -> bool {
    path == "/eten/manifest.webmanifest"
        || path.starts_with("/eten/icon-") && path.ends_with(".png")
}

/// The parents' wheel's own gate (see the module comment): `/eten…` answers
/// only `allow`, on every host, and `host` (when set) is kept to the wheel.
/// The client address is the kit's: behind Traefik that is the address
/// Traefik forwards, which the kit only believes when Traefik is listed in
/// `KITCHEN_TRUSTED_PROXIES`. Paths are compared without the query string;
/// the host without its port.
pub fn parents_guard(
    host: Option<String>,
    allow: Allow,
    files: Files,
) -> impl Fn(chassis::shell::request_guard::GuardRequest) -> std::future::Ready<Result<(), Response>>
+ Send
+ Sync
+ 'static {
    move |req| {
        let path = req.path.as_str();
        let wheel = path == "/eten" || path.starts_with("/eten/");
        let private = home_only(path);
        let asked = req
            .headers
            .get(header::HOST)
            .and_then(|h| h.to_str().ok())
            .map(|h| h.split(':').next().unwrap_or("").to_ascii_lowercase())
            .unwrap_or_default();
        let ours = host.as_deref() == Some(asked.as_str());
        let verdict = if (private || (ours && path == "/")) && !allow.allows(req.client_ip) {
            Err(not_home())
        } else if !ours || wheel || path.starts_with("/static/") || path == "/healthz" {
            Ok(())
        } else if path == "/" {
            Err(page_response(&files))
        } else {
            Err(Redirect::to("/").into_response())
        };
        std::future::ready(verdict)
    }
}
