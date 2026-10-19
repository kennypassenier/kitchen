//! recepten — AuDHD-friendly recipes: a wheel that chooses, cook mode with
//! parallel tracks, backward timing, bad days.
//!
//! Built on chassis: configuration, logging, login, health, metrics,
//! graceful shutdown, the static web app, signed self-update and webhooks
//! all come from the kit. This file wires the kitchen's store and its JSON
//! routes into it; the screens are the ES modules under `web/`.

#![forbid(unsafe_code)]

mod routes;
mod store;

use std::sync::Arc;

use axum::Router;
use chassis::shell::pages::Page;
use chassis::shell::webapp::WebApp;
use chassis::{App, AppSpec};

// The web files, generated from web/ by build.rs.
include!(concat!(env!("OUT_DIR"), "/web_files.rs"));

const HELP: &str = "\
RECEPTEN_WEB_DIR=<path to web/> serves the screens from disk instead of the
copy built into the binary (development only: a changed file shows on reload).";

#[tokio::main]
async fn main() -> std::process::ExitCode {
    let spec = AppSpec {
        name: "recepten",
        version: env!("CARGO_PKG_VERSION"),
        repository: Some("kennypassenier/recepten"),
        help_extra: Some(HELP),
        ..Default::default()
    };
    let mut app = match App::from_env_and_args(spec, Router::new()) {
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
                eprintln!("recepten: {e}");
                return std::process::ExitCode::FAILURE;
            }
        };
        app.dashboard_routes(routes::router(store));
    }

    let web = match std::env::var("RECEPTEN_WEB_DIR") {
        Ok(dir) if !dir.trim().is_empty() => WebApp::dir(dir),
        _ => WebApp::embedded(FILES),
    };
    app.webapp(web);
    // The bar: the four places a person goes, in the order of an evening.
    // The recipe page and cook mode are reached from a dish, not the bar.
    app.page(Page::new("wheel", "What do we eat?", "/"))
        .page(Page::new("timing", "When do I start?", "/timing"))
        .page(Page::new("baddays", "Bad days", "/bad-days"))
        .page(Page::new("settings", "Calm settings", "/settings"))
        .page(Page::new("recipes", "Recipes", "/recipes"))
        .page(
            Page::new("recipe", "Recipe", "/recipe")
                .group("Recipes")
                .hidden(),
        )
        .page(Page::new("cook", "Cook", "/cook").group("Recipes").hidden())
        .brand("/")
        .brand_title("Recepten")
        // Nothing calls a client API and the kit's status page would be a
        // second home; the operator reads /healthz and `recepten --check`.
        .disable_kit_page("status")
        .disable_kit_page("clients");
    app.run().await
}
