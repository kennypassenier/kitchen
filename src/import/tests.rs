use std::net::IpAddr;

use axum::http::StatusCode;
use reqwest::Url;

use super::MAX_REDIRECTS;
use super::fail::Fail;
use super::fetch::sniff_image;
use super::ssrf::*;

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
