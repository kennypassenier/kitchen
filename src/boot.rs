//! Wiring the store into the kit: the app database with its one-time import, the synced collections, the routes and
//! the start sequence (feat-db-store-1).
//!
//! The kit opens `kitchen.db` (and runs the import of `kitchen.json`) only inside `App::run`, after every route is
//! declared, so the store is made over the unopened handle here and filled from the start hook:
//!
//! 1. the import must be done; a failed import refuses the start (Kenny 03/11/2026 06:12, "Geen terugval": no file
//!    fallback). The kit has rolled it back and logged its own line; Kitchen logs what failed and exits 1, so the
//!    service manager and the kit's update probation see a failed start instead of a Kitchen without data;
//! 2. the kitchen is read into memory, old drafts are pruned and orphan photos swept, then the store opens for
//!    requests (until then every store route answers 503) and the parents' wheel gets it;
//! 3. the photo sweep runs every `SWEEP_EVERY`.

use std::path::Path;
use std::sync::Arc;

use chassis::App;
use chassis::storage::{AppDb, ImportState};

use crate::parents;
use crate::routes;
use crate::store::db::sync::{KitchenLoad, collections};
use crate::store::{self, Store};

/// Declare the store's routes, its synced collections and its start sequence on `app`.
pub fn wire(app: &mut App, db: AppDb, dir: &Path, slot: parents::Slot) {
    let store = Arc::new(Store::new(db.clone(), dir));
    for c in collections() {
        app.sync_collection(c);
    }
    app.sync_load(KitchenLoad);
    app.dashboard_routes(routes::router(store.clone(), dir))
        .dashboard_routes(parents::english(store.clone()));
    app.on_start(move || start(store, &db, slot));
}

/// The start hook: refuse a failed import, then load and open the store in the background.
fn start(store: Arc<Store>, db: &AppDb, slot: parents::Slot) {
    if let Err(why) = import_verdict(&db.import_state()) {
        refuse(&why);
    }
    tokio::spawn(async move {
        if let Err(why) = store.load().await {
            refuse(&why);
        }
        // Drafts nobody reopened for a week go, with the photos only they refer to (Kenny, 29/10/2026).
        report_pruned(store.prune_drafts(chassis::shell::time::now_epoch()).await);
        // Photo files nothing refers to any more go too, once older than an upload in flight could be
        // (fix-photo-orphans-1). After the drafts, so a pruned draft's photos are not counted twice; before the store
        // opens, so no upload races it.
        report_orphans(store.sweep_orphan_photos().await);
        store.open_for_requests();
        let _ = slot.set(store.clone());
        // Photos that dropped out of a dish go once Undo can no longer bring them back (fix-undo-photos-1).
        let mut tick = tokio::time::interval(store::SWEEP_EVERY);
        loop {
            tick.tick().await;
            store.sweep_photos().await;
        }
    });
}

/// Whether the store may start on the database: only when the one-time import is done (now or at an earlier start).
pub fn import_verdict(state: &ImportState) -> Result<(), String> {
    match state {
        ImportState::Done => Ok(()),
        ImportState::Failed { why } => Err(format!(
            "the one-time import of kitchen.json into kitchen.db failed and was rolled back: {why}. kitchen.json is \
             untouched and its first copy is kitchen.json.pre-db; fix the cause and start again (the import is \
             retried), or roll back to the previous version as docs/OPEN.md describes"
        )),
        other => Err(format!(
            "kitchen.db did not report its one-time import as done ({other:?}); nothing was served"
        )),
    }
}

/// Stop the service with the reason: Kitchen does not run without its data (no file fallback, by decision).
fn refuse(why: &str) -> ! {
    tracing::error!(reason = why, "kitchen refuses to start");
    eprintln!("kitchen: refusing to start: {why}");
    std::process::exit(1);
}

/// Say how many old drafts the start dropped (silent when none went), or that dropping them failed.
fn report_pruned(pruned: Result<usize, String>) {
    match pruned {
        Ok(0) => {}
        Ok(pruned) => tracing::info!(
            pruned,
            days = store::DRAFT_DAYS,
            "old recipe drafts dropped"
        ),
        Err(error) => tracing::warn!(%error, "old recipe drafts could not be dropped; they stay"),
    }
}

/// Say how many orphan photo files the start deleted (always, so the sweep is seen to run), and any it could not delete.
fn report_orphans(swept: Result<store::OrphanSweep, String>) {
    match swept {
        Ok(store::OrphanSweep { removed, failed: 0 }) => tracing::info!(
            removed,
            min_age_mins = store::ORPHAN_MIN_AGE.as_secs() / 60,
            "orphan photo files deleted at start"
        ),
        Ok(store::OrphanSweep { removed, failed }) => tracing::warn!(
            removed,
            failed,
            "orphan photo files deleted at start; some could not be (see the lines above)"
        ),
        Err(error) => {
            tracing::warn!(%error, "the start-up photo sweep did not run; every photo file stays")
        }
    }
}
