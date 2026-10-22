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
//! | `GET /eten/data` | the dishes on the wheel, in Dutch: names, category, the parts |
//!
//! The English copy of the same list (`GET /data/wheel/en`) sits behind the
//! login with the rest of Kitchen. Both come from [`wheel`], so the rule
//! "a dish shows in each language it has a name for" lives in one place.
//!
//! The wheel answers only Kenny's home network (`KITCHEN_PARENTS_ALLOW`,
//! default `10.10.10.0/24`; Kenny, 22/10/2026 23:08): eten.kp-soft.dev has
//! no public record and no Cloudflare, and [`parents_guard`] refuses `/eten…`
//! to any other address as a second lock. When `KITCHEN_PARENTS_HOST` names
//! a host, the guard also keeps that host to the wheel: its root answers the
//! page, `/eten…`, `/static/…` and `/healthz` pass, and every other path
//! sends the visitor back to the wheel, so the login page is never reachable
//! there.

use std::net::IpAddr;
use std::path::PathBuf;
use std::sync::{Arc, OnceLock};

use axum::Router;
use axum::extract::{Path, State};
use axum::http::{StatusCode, header};
use axum::response::{IntoResponse, Redirect, Response};
use axum::routing::get;
use serde_json::{Value, json};

use crate::store::{Data, Store};

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

/// The English list for Kitchen's own page, behind the login.
pub fn english(store: Arc<Store>) -> Router {
    Router::new()
        .route(
            "/data/wheel/en",
            get(|State(s): State<Arc<Store>>| async move {
                axum::Json(wheel(&s.snapshot().await, Lang::En))
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

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Lang {
    Nl,
    En,
}

impl Lang {
    fn key(self) -> &'static str {
        match self {
            Lang::Nl => "nl",
            Lang::En => "en",
        }
    }
}

/// `{nl, en}` in the asked language, when that half is filled in. A name
/// with only its Dutch half shows on the Dutch wheel and not on the English
/// one, and the other way round (Kenny, 22/10/2026 23:08).
fn named(v: Option<&Value>, lang: Lang) -> Option<String> {
    let s = v?.get(lang.key())?.as_str()?.trim();
    (!s.is_empty()).then(|| s.to_string())
}

fn by_id<'a>(list: &'a [Value], id: Option<&Value>) -> Option<&'a Value> {
    let id = id?.as_str()?;
    list.iter()
        .find(|v| v.get("id").and_then(Value::as_str) == Some(id))
}

fn order(v: &Value) -> f64 {
    v.get("order").and_then(Value::as_f64).unwrap_or(f64::MAX)
}

/// The dishes on the parents' wheel in one language.
///
/// A dish shows when `parents` is true and it has a name in `lang`. A part
/// shows when its kind has a name in `lang` and at least one choice does;
/// parts come in the kinds' order, each with its kind's `wheel` mark (only a
/// marked kind, such as potatoes and co., is picked by the small wheel).
/// Categories are the ones the shown dishes use, in their order, with how
/// many dishes each holds.
pub fn wheel(data: &Data, lang: Lang) -> Value {
    let mut dishes: Vec<Value> = Vec::new();
    for d in &data.dishes {
        if d.get("parents").and_then(Value::as_bool) != Some(true) {
            continue;
        }
        let Some(name) = named(d.get("name"), lang) else {
            continue;
        };
        let mut parts: Vec<(f64, Value)> = Vec::new();
        for p in d
            .get("parts")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            let Some(kind) = by_id(&data.dish_parts, p.get("part")) else {
                continue;
            };
            let Some(kind_name) = named(kind.get("name"), lang) else {
                continue;
            };
            let choices: Vec<String> = p
                .get("choices")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .filter_map(|c| named(Some(c), lang))
                .collect();
            if choices.is_empty() {
                continue;
            }
            parts.push((
                order(kind),
                json!({
                    "id": kind["id"],
                    "name": kind_name,
                    "wheel": kind.get("wheel").and_then(Value::as_bool) == Some(true),
                    "choices": choices,
                }),
            ));
        }
        parts.sort_by(|a, b| a.0.total_cmp(&b.0));
        let category = by_id(&data.dish_categories, d.get("category"))
            .filter(|c| named(c.get("name"), lang).is_some())
            .map(|c| c["id"].clone())
            .unwrap_or(Value::Null);
        dishes.push(json!({
            "id": d["id"],
            "name": name,
            "category": category,
            "parts": parts.into_iter().map(|(_, v)| v).collect::<Vec<_>>(),
        }));
    }
    dishes.sort_by(|a, b| {
        a["name"]
            .as_str()
            .unwrap_or("")
            .to_lowercase()
            .cmp(&b["name"].as_str().unwrap_or("").to_lowercase())
    });
    let mut cats: Vec<&Value> = data
        .dish_categories
        .iter()
        .filter(|c| named(c.get("name"), lang).is_some())
        .collect();
    cats.sort_by(|a, b| order(a).total_cmp(&order(b)));
    let categories: Vec<Value> = cats
        .into_iter()
        .filter_map(|c| {
            let n = dishes.iter().filter(|d| d["category"] == c["id"]).count();
            (n > 0)
                .then(|| json!({ "id": c["id"], "name": named(c.get("name"), lang), "count": n }))
        })
        .collect();
    json!({ "lang": lang.key(), "dishes": dishes, "categories": categories })
}

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
        let asked = req
            .headers
            .get(header::HOST)
            .and_then(|h| h.to_str().ok())
            .map(|h| h.split(':').next().unwrap_or("").to_ascii_lowercase())
            .unwrap_or_default();
        let ours = host.as_deref() == Some(asked.as_str());
        let verdict = if (wheel || (ours && path == "/")) && !allow.allows(req.client_ip) {
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

#[cfg(test)]
mod tests {
    use super::*;

    fn data() -> Data {
        let mut d = crate::store::seed();
        d.dishes.clear();
        d.dish_parts = vec![
            json!({"id": "p-starch", "name": {"nl": "Aardappelen en co.", "en": "Potatoes and co."}, "order": 1, "wheel": true}),
            json!({"id": "p-sauce", "name": {"nl": "Saus", "en": "Sauce"}, "order": 2}),
            json!({"id": "p-half", "name": {"nl": "Groenten", "en": ""}, "order": 3}),
        ];
        d.dish_categories = vec![
            json!({"id": "c-day", "name": {"nl": "Dagelijkse kost", "en": "Everyday"}, "order": 1}),
            json!({"id": "c-special", "name": {"nl": "Speciaal", "en": "Special"}, "order": 2}),
        ];
        d.dishes = vec![
            json!({"id": "d1", "name": {"nl": "Stoofvlees", "en": "Beef stew"}, "parents": true, "category": "c-day",
            "parts": [
                {"part": "p-sauce", "choices": [{"nl": "Mayonaise", "en": "Mayonnaise"}]},
                {"part": "p-starch", "choices": [{"nl": "Frieten", "en": "Fries"}, {"nl": "Puree", "en": ""}]},
                {"part": "p-half", "choices": [{"nl": "Wortelen", "en": "Carrots"}]}
            ]}),
            json!({"id": "d2", "name": {"nl": "Konijn", "en": ""}, "parents": true, "category": "c-special", "parts": []}),
            json!({"id": "d3", "name": {"nl": "", "en": "Shakshuka"}, "parents": true, "parts": []}),
            json!({"id": "d4", "name": {"nl": "Pasta", "en": "Pasta"}, "parents": false, "parts": []}),
        ];
        d
    }

    fn ids(w: &Value) -> Vec<&str> {
        w["dishes"]
            .as_array()
            .unwrap()
            .iter()
            .map(|d| d["id"].as_str().unwrap())
            .collect()
    }

    #[test]
    fn a_dish_shows_in_each_language_it_has_a_name_for() {
        assert_eq!(ids(&wheel(&data(), Lang::Nl)), ["d2", "d1"]);
        assert_eq!(ids(&wheel(&data(), Lang::En)), ["d1", "d3"]);
    }

    #[test]
    fn parts_and_choices_follow_the_language_in_the_kinds_order() {
        let nl = wheel(&data(), Lang::Nl);
        let parts = &nl["dishes"][1]["parts"];
        assert_eq!(parts.as_array().unwrap().len(), 3);
        assert_eq!(parts[0]["name"], "Aardappelen en co.");
        assert_eq!(parts[0]["wheel"], true);
        assert_eq!(parts[0]["choices"], json!(["Frieten", "Puree"]));
        assert_eq!(parts[1]["wheel"], false);
        let en = wheel(&data(), Lang::En);
        let parts = &en["dishes"][0]["parts"];
        assert_eq!(parts.as_array().unwrap().len(), 2);
        assert_eq!(parts[0]["choices"], json!(["Fries"]));
    }

    #[test]
    fn only_the_categories_in_use_are_listed_with_their_count() {
        let w = wheel(&data(), Lang::Nl);
        assert_eq!(
            w["categories"],
            json!([
                {"id": "c-day", "name": "Dagelijkse kost", "count": 1},
                {"id": "c-special", "name": "Speciaal", "count": 1}
            ])
        );
    }

    #[test]
    fn the_seed_puts_eight_dinners_on_the_wheel() {
        let w = wheel(&crate::store::seed(), Lang::Nl);
        assert_eq!(w["dishes"].as_array().unwrap().len(), 8);
        assert_eq!(w["categories"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn only_the_home_network_is_allowed() {
        let a = Allow::parse(Allow::DEFAULT).unwrap();
        for ok in ["10.10.10.1", "10.10.10.254", "::ffff:10.10.10.20"] {
            assert!(a.allows(ok.parse().unwrap()), "{ok}");
        }
        for no in ["10.10.30.151", "192.168.1.5", "8.8.8.8", "::1"] {
            assert!(!a.allows(no.parse().unwrap()), "{no}");
        }
        let two = Allow::parse("10.10.10.0/24, 127.0.0.1").unwrap();
        assert!(two.allows("127.0.0.1".parse().unwrap()));
        assert!(Allow::parse("10.10.10.0/33").is_err());
        assert!(Allow::parse("home").is_err());
    }

    #[test]
    fn only_plain_file_names_are_served() {
        let f = Files { dir: None };
        assert!(f.read("index.html").is_some());
        for bad in ["../main.rs", "", ".hidden", "a/b.js", "INDEX.html"] {
            assert!(f.read(bad).is_none(), "{bad}");
        }
    }
}
