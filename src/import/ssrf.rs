//! The request-forgery guard (see the module comment of `import`): which addresses may be fetched, which redirects are
//! followed, and the host check that runs BEFORE anything connects.

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, ToSocketAddrs};

use reqwest::Url;

use super::MAX_REDIRECTS;
use super::fail::Fail;

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
pub(super) async fn vet(url: &Url) -> Result<SocketAddr, Fail> {
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
