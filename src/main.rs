//! kitchen — AuDHD-friendly recipes: a wheel that chooses, cook mode with
//! parallel tracks, backward timing, bad days.
//!
//! Built on chassis: configuration, logging, login, health, metrics,
//! graceful shutdown, the static web app, signed self-update and webhooks
//! all come from the kit. This file wires the kitchen's store and its JSON
//! routes into it; the screens are the ES modules under `web/`.

#![forbid(unsafe_code)]

mod parents;
mod routes;
mod store;

use std::sync::Arc;

use chassis::shell::pages::Page;
use chassis::shell::webapp::WebApp;
use chassis::storage::{AppDbSpec, BrowserKeys};
use chassis::{App, AppSpec};

// The web files, generated from web/ by build.rs.
include!(concat!(env!("OUT_DIR"), "/web_files.rs"));

const HELP: &str = "\
KITCHEN_WEB_DIR=<path to web/> serves the screens from disk instead of the
copy built into the binary (development only: a changed file shows on reload).
KITCHEN_PARENTS_HOST=<host> (eten.kp-soft.dev) keeps that host to the parents'
wheel: its root opens the wheel without a login, every other path leads back.
KITCHEN_PARENTS_ALLOW=<addresses and ranges, comma-separated> (default
10.10.10.0/24): the only clients the parents' wheel answers.";

#[tokio::main]
async fn main() -> std::process::ExitCode {
    let spec = AppSpec {
        name: "kitchen",
        version: env!("CARGO_PKG_VERSION"),
        repository: Some("kennypassenier/kitchen"),
        help_extra: Some(HELP),
        ..Default::default()
    };
    let web_dir = std::env::var("KITCHEN_WEB_DIR")
        .ok()
        .filter(|d| !d.trim().is_empty());
    let files = parents::Files {
        dir: web_dir.as_ref().map(std::path::PathBuf::from),
    };
    // The parents' wheel needs no login, so its routes go on the kit's public
    // router; the store joins them once it has opened.
    let slot: parents::Slot = Arc::default();
    let public = parents::router(slot.clone(), files.clone());
    let mut app = match App::from_env_and_args(spec, public) {
        Ok(app) => app,
        Err(e) => {
            eprintln!("{e}");
            return std::process::ExitCode::FAILURE;
        }
    };

    // The store opens only for a run that serves (`--version` and friends
    // have no state directory).
    if let Some(dir) = app.loaded.as_ref().map(|l| l.state_dir.clone()) {
        let store = match store::Store::open(&dir) {
            Ok(s) => Arc::new(s),
            Err(e) => {
                eprintln!("kitchen: {e}");
                return std::process::ExitCode::FAILURE;
            }
        };
        app.dashboard_routes(routes::router(store.clone()))
            .dashboard_routes(parents::english(store.clone()));
        let _ = slot.set(store);
    }
    let host = std::env::var("KITCHEN_PARENTS_HOST")
        .ok()
        .map(|h| h.trim().to_ascii_lowercase())
        .filter(|h| !h.is_empty());
    let allow = std::env::var("KITCHEN_PARENTS_ALLOW")
        .ok()
        .filter(|a| !a.trim().is_empty())
        .unwrap_or_else(|| parents::Allow::DEFAULT.to_string());
    let allow = match parents::Allow::parse(&allow) {
        Ok(a) => a,
        Err(e) => {
            eprintln!("kitchen: {e}");
            return std::process::ExitCode::FAILURE;
        }
    };
    app.request_guard(parents::parents_guard(host, allow, files));

    // The app database holds only the kit's synced preferences: the recipes
    // stay in kitchen.json. A person's browser choices (the timing page's
    // numbers, where cook mode stands) follow them from the phone to the PC;
    // the theme key stays out because it must work before the login.
    if let Err(e) = app.app_db(AppDbSpec::new(Vec::new())) {
        eprintln!("kitchen: {e}");
        return std::process::ExitCode::FAILURE;
    }
    app.sync_browser_keys(BrowserKeys::new().prefix("kitchen:").prefix("kp-remember:"));

    let web = match web_dir {
        Some(dir) => WebApp::dir(dir),
        None => WebApp::embedded(FILES),
    };
    app.webapp(web);
    // The bar: the four places a person goes, in the order of an evening.
    // The recipe page and cook mode are reached from a dish, not the bar.
    app.page(Page::new("wheel", "What do we eat?", "/"))
        .page(Page::new("timing", "When do I start?", "/timing"))
        .page(Page::new("baddays", "Bad days", "/bad-days"))
        .page(Page::new("settings", "Calm settings", "/settings"))
        .page(Page::new("recipes", "Recipes", "/recipes"))
        // The dishes behind the parents' wheel, and the wheel itself in
        // English; the Dutch one is /eten, without a login.
        .page(Page::new("dishes", "Dishes", "/dishes"))
        .page(Page::new("parents", "Parents' wheel", "/parents"))
        .page(
            Page::new("recipe", "Recipe", "/recipe")
                .group("Recipes")
                .hidden(),
        )
        .page(Page::new("cook", "Cook", "/cook").group("Recipes").hidden())
        .brand("/")
        .brand_title("Kitchen")
        // Nothing calls a client API and the kit's status page would be a
        // second home; the operator reads /healthz and `kitchen --check`.
        .disable_kit_page("status")
        .disable_kit_page("clients");
    app.run().await
}
