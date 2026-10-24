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

/// "Frieten en mayonaise", "Fries, peas and mayonnaise": a side's ingredients as one entry on the small wheel, the
/// first as written and the others starting small.
fn joined(names: &[String], lang: Lang) -> String {
    let and = if lang == Lang::Nl { "en" } else { "and" };
    let small = |s: &String| -> String {
        let mut c = s.chars();
        match c.next() {
            Some(f) => f.to_lowercase().chain(c).collect(),
            None => String::new(),
        }
    };

    match names {
        [] => String::new(),
        [one] => one.clone(),
        [first, rest @ .., last] => {
            let mut out = first.clone();
            for n in rest {
                out.push_str(", ");
                out.push_str(&small(n));
            }
            format!("{out} {and} {}", small(last))
        }
    }
}

/// The dishes on the parents' wheel in one language.
///
/// A dish shows when `parents` is true and it has a name in `lang`. Its
/// fixed `ingredients` always come with it; each of its `sides` is one
/// entry on the small wheel, named by its ingredients ("Frieten en
/// mayonaise"; Kenny, 24/10/2026 05:26) or by its own `label` (05:27). The
/// same ingredient may stand in several sides. An ingredient without a name
/// in `lang` is left out, and a side with none left goes.
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
        // The names in `lang` of a list of ingredient ids, the ones without such a name left out.
        let names = |ids: Option<&Value>| -> Vec<String> {
            ids.and_then(Value::as_array)
                .into_iter()
                .flatten()
                .filter_map(|id| named(by_id(&data.ingredients, Some(id))?.get("name"), lang))
                .collect()
        };
        let fixed = names(d.get("ingredients"));
        let sides: Vec<Value> = d
            .get("sides")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter_map(|side| {
                let shown = names(side.get("ingredients"));
                if shown.is_empty() {
                    return None;
                }
                // The side's own label when it has one in `lang` ("Kroketten met mayonaise"; 05:27).
                let name = named(side.get("label"), lang).unwrap_or_else(|| joined(&shown, lang));
                Some(json!({ "name": name, "ingredients": side["ingredients"] }))
            })
            .collect();
        let category = by_id(&data.dish_categories, d.get("category"))
            .filter(|c| named(c.get("name"), lang).is_some())
            .map(|c| c["id"].clone())
            .unwrap_or(Value::Null);
        dishes.push(json!({
            "id": d["id"],
            "name": name,
            "category": category,
            "ingredients": fixed,
            "sides": sides,
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

/// The paths only the home network may open: the Dutch page and its dishes.
/// The wheel's script and sheet under `/eten/` hold no data and pass from
/// anywhere, because Kitchen's own English page (`/parents`, behind the
/// login) loads them too: refused, the wheel broke for Kenny away from home
/// (found 24/10/2026, in Kitchen 1.0.0).
fn home_only(path: &str) -> bool {
    path == "/eten" || path == "/eten/data"
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

#[cfg(test)]
mod tests {
    use super::*;

    fn data() -> Data {
        let mut d = crate::store::seed();
        d.dish_categories = vec![
            json!({"id": "c-day", "name": {"nl": "Dagelijkse kost", "en": "Everyday"}, "order": 1}),
            json!({"id": "c-special", "name": {"nl": "Speciaal", "en": "Special"}, "order": 2}),
        ];
        d.ingredients = vec![
            json!({"id": "i-stew", "name": {"nl": "Stoofvlees", "en": "Beef stew"}}),
            json!({"id": "i-fries", "name": {"nl": "Frieten", "en": "Fries"}}),
            json!({"id": "i-croq", "name": {"nl": "Kroketten", "en": "Croquettes"}}),
            json!({"id": "i-mayo", "name": {"nl": "Mayonaise", "en": "Mayonnaise"}}),
            json!({"id": "i-salad", "name": {"nl": "Sla", "en": ""}}),
        ];
        d.dishes = vec![
            json!({"id": "d1", "name": {"nl": "Stoofvlees", "en": "Beef stew"}, "parents": true, "category": "c-day",
            "ingredients": ["i-stew", "i-salad", "i-gone"],
            "sides": [
                {"ingredients": ["i-fries", "i-mayo"]},
                {"ingredients": ["i-croq", "i-mayo"], "label": {"nl": "Kroketten met mayonaise", "en": ""}},
                {"ingredients": ["i-salad"]},
                {"ingredients": ["i-gone"]}
            ]}),
            json!({"id": "d2", "name": {"nl": "Konijn", "en": ""}, "parents": true, "category": "c-special", "sides": []}),
            json!({"id": "d3", "name": {"nl": "", "en": "Shakshuka"}, "parents": true}),
            json!({"id": "d4", "name": {"nl": "Pasta", "en": "Pasta"}, "parents": false, "sides": []}),
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
    fn a_side_is_one_wheel_entry_named_by_its_label_or_its_ingredients() {
        let nl = wheel(&data(), Lang::Nl);
        let d1 = &nl["dishes"][1];
        assert_eq!(d1["ingredients"], json!(["Stoofvlees", "Sla"]));
        assert_eq!(
            d1["sides"],
            json!([
                {"name": "Frieten en mayonaise", "ingredients": ["i-fries", "i-mayo"]},
                {"name": "Kroketten met mayonaise", "ingredients": ["i-croq", "i-mayo"]},
                {"name": "Sla", "ingredients": ["i-salad"]}
            ])
        );
        // English: no English label, so the ingredients; "Sla" has no English name, so its side goes.
        let en = wheel(&data(), Lang::En);
        assert_eq!(en["dishes"][0]["ingredients"], json!(["Beef stew"]));
        assert_eq!(
            en["dishes"][0]["sides"],
            json!([
                {"name": "Fries and mayonnaise", "ingredients": ["i-fries", "i-mayo"]},
                {"name": "Croquettes and mayonnaise", "ingredients": ["i-croq", "i-mayo"]}
            ])
        );
        assert_eq!(en["dishes"][1]["sides"], json!([]));
    }

    #[test]
    fn two_sides_may_share_an_ingredient() {
        let w = wheel(&data(), Lang::Nl);
        let sides = w["dishes"][1]["sides"].as_array().unwrap();
        let with_mayo = sides
            .iter()
            .filter(|s| {
                s["ingredients"]
                    .as_array()
                    .unwrap()
                    .contains(&json!("i-mayo"))
            })
            .count();
        assert_eq!(with_mayo, 2);
        assert_eq!(
            joined(&["A".into(), "B".into(), "C".into()], Lang::En),
            "A, b and c"
        );
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
    fn the_seed_leaves_the_wheel_empty() {
        let w = wheel(&crate::store::seed(), Lang::Nl);
        assert_eq!(w["dishes"], json!([]));
        assert_eq!(w["categories"], json!([]));
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
    fn only_the_page_and_its_data_are_kept_home() {
        assert!(home_only("/eten") && home_only("/eten/data"));
        for open in [
            "/eten/wheel.js",
            "/eten/wheel.css",
            "/eten/eten.js",
            "/parents",
        ] {
            assert!(!home_only(open), "{open}");
        }
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
