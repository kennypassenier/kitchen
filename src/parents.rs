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
//! | `GET /eten/data` | the dishes on the wheel, in Dutch: names, category, the parts with a choice |
//!
//! The English copy of the same list (`GET /data/wheel/en`) sits behind the
//! login with the rest of Kitchen. Both come from [`wheel`], so the rule
//! "a dish needs a Dutch and an English name, or it shows in neither" lives
//! in one place.
//!
//! When `KITCHEN_PARENTS_HOST` names a host, [`host_guard`] keeps that host
//! to the wheel: its root answers the page, `/eten…`, `/static/…` and
//! `/healthz` pass, and every other path sends the visitor back to the
//! wheel, so the login page is never reachable there.

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

/// `{nl, en}` in the asked language, but only when both are filled in.
fn both(v: Option<&Value>, lang: Lang) -> Option<String> {
    let v = v?;
    let nl = v.get("nl")?.as_str()?.trim();
    let en = v.get("en")?.as_str()?.trim();
    if nl.is_empty() || en.is_empty() {
        return None;
    }
    Some(if lang == Lang::Nl { nl } else { en }.to_string())
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
/// A dish shows when `parents` is true and it has both names. A part shows
/// when its kind has both names and at least one choice with both names;
/// parts come in the kinds' order. Categories are the ones the shown dishes
/// use, in their order, with how many dishes each holds.
pub fn wheel(data: &Data, lang: Lang) -> Value {
    let mut dishes: Vec<Value> = Vec::new();
    for d in &data.dishes {
        if d.get("parents").and_then(Value::as_bool) != Some(true) {
            continue;
        }
        let Some(name) = both(d.get("name"), lang) else {
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
            let Some(kind_name) = both(kind.get("name"), lang) else {
                continue;
            };
            let choices: Vec<String> = p
                .get("choices")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .filter_map(|c| both(Some(c), lang))
                .collect();
            if choices.is_empty() {
                continue;
            }
            parts.push((
                order(kind),
                json!({ "id": kind["id"], "name": kind_name, "choices": choices }),
            ));
        }
        parts.sort_by(|a, b| a.0.total_cmp(&b.0));
        let category = by_id(&data.dish_categories, d.get("category"))
            .filter(|c| both(c.get("name"), lang).is_some())
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
        .filter(|c| both(c.get("name"), lang).is_some())
        .collect();
    cats.sort_by(|a, b| order(a).total_cmp(&order(b)));
    let categories: Vec<Value> = cats
        .into_iter()
        .filter_map(|c| {
            let n = dishes.iter().filter(|d| d["category"] == c["id"]).count();
            (n > 0).then(|| json!({ "id": c["id"], "name": both(c.get("name"), lang), "count": n }))
        })
        .collect();
    json!({ "lang": lang.key(), "dishes": dishes, "categories": categories })
}

/// Keep `host` to the wheel (see the module comment). Paths are compared
/// without the query string; the host without its port.
pub fn host_guard(
    host: String,
    files: Files,
) -> impl Fn(chassis::shell::request_guard::GuardRequest) -> std::future::Ready<Result<(), Response>>
+ Send
+ Sync
+ 'static {
    move |req| {
        let asked = req
            .headers
            .get(header::HOST)
            .and_then(|h| h.to_str().ok())
            .map(|h| h.split(':').next().unwrap_or("").to_ascii_lowercase())
            .unwrap_or_default();
        if asked != host {
            return std::future::ready(Ok(()));
        }
        let path = req.path.as_str();
        let verdict = if path == "/" {
            Err(page_response(&files))
        } else if path == "/eten"
            || path.starts_with("/eten/")
            || path.starts_with("/static/")
            || path == "/healthz"
        {
            Ok(())
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
            json!({"id": "p-starch", "name": {"nl": "Aardappelen en co.", "en": "Potatoes and co."}, "order": 1}),
            json!({"id": "p-sauce", "name": {"nl": "Saus", "en": "Sauce"}, "order": 2}),
            json!({"id": "p-half", "name": {"nl": "Groenten", "en": ""}, "order": 3}),
        ];
        d.dish_categories = vec![
            json!({"id": "c-day", "name": {"nl": "Dagelijkse kost", "en": "Everyday"}, "order": 1}),
            json!({"id": "c-feast", "name": {"nl": "Feest", "en": "Festive"}, "order": 2}),
        ];
        d.dishes = vec![
            json!({"id": "d1", "name": {"nl": "Stoofvlees", "en": "Beef stew"}, "parents": true, "category": "c-day",
            "parts": [
                {"part": "p-sauce", "choices": [{"nl": "Mayonaise", "en": "Mayonnaise"}]},
                {"part": "p-starch", "choices": [{"nl": "Frieten", "en": "Fries"}, {"nl": "Puree", "en": ""}]},
                {"part": "p-half", "choices": [{"nl": "Wortelen", "en": "Carrots"}]}
            ]}),
            json!({"id": "d2", "name": {"nl": "Konijn", "en": ""}, "parents": true, "category": "c-feast", "parts": []}),
            json!({"id": "d3", "name": {"nl": "", "en": "Shakshuka"}, "parents": true, "parts": []}),
            json!({"id": "d4", "name": {"nl": "Pasta", "en": "Pasta"}, "parents": false, "parts": []}),
        ];
        d
    }

    #[test]
    fn a_dish_needs_both_names_and_the_parents_mark() {
        for lang in [Lang::Nl, Lang::En] {
            let w = wheel(&data(), lang);
            let ids: Vec<&str> = w["dishes"]
                .as_array()
                .unwrap()
                .iter()
                .map(|d| d["id"].as_str().unwrap())
                .collect();
            assert_eq!(ids, ["d1"], "{lang:?}");
        }
    }

    #[test]
    fn parts_and_choices_follow_the_same_rule_in_the_kinds_order() {
        let w = wheel(&data(), Lang::Nl);
        let parts = &w["dishes"][0]["parts"];
        assert_eq!(parts.as_array().unwrap().len(), 2);
        assert_eq!(parts[0]["name"], "Aardappelen en co.");
        assert_eq!(parts[0]["choices"], json!(["Frieten"]));
        assert_eq!(parts[1]["name"], "Saus");
        let en = wheel(&data(), Lang::En);
        assert_eq!(en["dishes"][0]["name"], "Beef stew");
        assert_eq!(en["dishes"][0]["parts"][0]["choices"], json!(["Fries"]));
    }

    #[test]
    fn only_the_categories_in_use_are_listed_with_their_count() {
        let w = wheel(&data(), Lang::Nl);
        assert_eq!(
            w["categories"],
            json!([{"id": "c-day", "name": "Dagelijkse kost", "count": 1}])
        );
    }

    #[test]
    fn the_seed_puts_eight_dinners_on_the_wheel() {
        let w = wheel(&crate::store::seed(), Lang::Nl);
        assert_eq!(w["dishes"].as_array().unwrap().len(), 8);
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
