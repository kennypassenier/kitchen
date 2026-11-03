//! kitchen — AuDHD-friendly recipes: a wheel that chooses, cook mode with
//! parallel tracks, backward timing, bad days.
//!
//! Built on chassis: configuration, logging, login, health, metrics,
//! graceful shutdown, the static web app, signed self-update and webhooks
//! all come from the kit. This file wires the kitchen's store (`boot.rs`) and its JSON
//! routes into it; the screens are the ES modules under `web/`.

#![forbid(unsafe_code)]

mod boot;
mod import;
mod parents;
mod photos;
mod recipe_parse;
mod routes;
mod store;

use std::sync::Arc;

use chassis::shell::pages::Page;
use chassis::shell::webapp::WebApp;
use chassis::storage::BrowserKeys;
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

    // The app database (feat-db-store-1): the kitchen's lists, settings and answered take keys, imported once from
    // kitchen.json (store/db/import), beside the kit's synced preferences: a person's browser choices (the timing
    // page's numbers, where cook mode stands) follow them from the phone to the PC; the theme key stays out because
    // it must work before the login. The file opens when the service starts, not here.
    let db = match app.app_db(store::db::app_db_spec()) {
        Ok(db) => db,
        Err(e) => {
            eprintln!("kitchen: {e}");
            return std::process::ExitCode::FAILURE;
        }
    };
    // The store and its routes exist only for a run that serves (`--version` and friends have no state directory).
    if let Some(dir) = app.loaded.as_ref().map(|l| l.state_dir.clone()) {
        boot::wire(&mut app, db, &dir, slot);
    }
    let (host, allow) = match parents_settings() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("kitchen: {e}");
            return std::process::ExitCode::FAILURE;
        }
    };
    app.request_guard(parents::parents_guard(host, allow, files));

    app.sync_browser_keys(BrowserKeys::new().prefix("kitchen:").prefix("kp-remember:"));

    let web = match web_dir {
        Some(dir) => WebApp::dir(dir),
        None => WebApp::embedded(FILES),
    };
    // Kenny 02/11/2026 17:24 ("Nu overstappen"): the pages import kp-themes' per-module
    // entries, so the injected runtime must use them too (one copy of kp's state).
    app.webapp(web.kp_modules());
    register_pages(&mut app);
    app.run().await
}

/// The host the parents' wheel is kept to and the clients it answers, from the environment.
fn parents_settings() -> Result<(Option<String>, parents::Allow), String> {
    let host = std::env::var("KITCHEN_PARENTS_HOST")
        .ok()
        .map(|h| h.trim().to_ascii_lowercase())
        .filter(|h| !h.is_empty());
    let allow = std::env::var("KITCHEN_PARENTS_ALLOW")
        .ok()
        .filter(|a| !a.trim().is_empty())
        .unwrap_or_else(|| parents::Allow::DEFAULT.to_string());
    let allow = parents::Allow::parse(&allow).map_err(|e| e.to_string())?;
    Ok((host, allow))
}

/// The pages of the app's bar and the hidden ones.
fn register_pages(app: &mut App) {
    register_bar(app);
    register_more(app);
    register_hidden(app);
    // The kit's Storage page is secondary by default (chassis-rs 4.2.0), so it sits in the More menu with the five below.
    app.brand("/")
        .brand_title("Kitchen")
        // Nothing calls a client API and the kit's status page would be a
        // second home; the operator reads /healthz and `kitchen --check`.
        .disable_kit_page("status")
        .disable_kit_page("clients");
}

/// The bar: the five places of every day, in the order of an evening (Kenny, 01/11/2026 20:21: "Meer-menu").
fn register_bar(app: &mut App) {
    app.page(Page::new("wheel", "What do we eat?", "/").order(0))
        .page(Page::new("timing", "When do I start?", "/timing").order(1))
        .page(Page::new("baddays", "Bad days", "/bad-days").order(2))
        .page(Page::new("recipes", "Recipes", "/recipes").order(3))
        // Every line of the log, recipes cooked and shelf foods eaten.
        .page(Page::new("log", "What I ate", "/log").order(4));
}

/// The secondary pages sit behind the bar's More menu instead, in the order given here (`Page::secondary`, chassis-rs
/// 4.2.0: the kit's own header and phone tab bar put them in its one More menu too; web/js/shell/plan.js reads the flag).
fn register_more(app: &mut App) {
    // The dishes behind the parents' wheel, and the wheel itself in English; the Dutch one is /eten, without a login.
    app.page(
        Page::new("dishes", "Dishes", "/dishes")
            .secondary()
            .order(10),
    )
    // The one list of ingredients dishes and recipes point at.
    .page(
        Page::new("ingredients", "Ingredients", "/ingredients")
            .secondary()
            .order(11),
    )
    .page(
        Page::new("parents", "Parents' wheel", "/parents")
            .secondary()
            .order(12),
    )
    // The websites whose recipe pages the import reads well (Kenny, 29/10/2026 15:11).
    .page(
        Page::new("sources", "Recipe sources", "/sources")
            .secondary()
            .order(13),
    )
    // Last in the menu, after the kit's Storage (order 1000 and up).
    .page(
        Page::new("settings", "Calm settings", "/settings")
            .secondary()
            .order(1100),
    );
}

/// The recipe page, the editor and cook mode are reached from a dish, not the bar.
fn register_hidden(app: &mut App) {
    app.page(
        Page::new("recipe", "Recipe", "/recipe")
            .group("Recipes")
            .hidden(),
    )
    // The recipe editor is a page of its own (Kenny, 01/11/2026): `?id=` edits, `?new=1` / `?dish=` writes a new one.
    .page(
        Page::new("recipe-edit", "Edit recipe", "/recipe/edit")
            .group("Recipes")
            .hidden(),
    )
    .page(Page::new("cook", "Cook", "/cook").group("Recipes").hidden());
}
