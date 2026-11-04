# Open

7 items open: the deploy note (skip 6.0.0), the data move into databases (server and page side built 03/11/2026; docs/agent/DB_MOVE.md), the deploy of 5.0.0, the release of what is on main as 6.0.0 (Kenny's release word 02/11/2026 20:15, version 20:16; now on chassis-rs 4.5.0, tag v4.5.0), the kp-themes split delivery's release checks, the offline copy's release checks, and the per-recipe keep and offline freezer take (built, re-pinned to the release tag; their checks) about the offline copy.
The chassis-rs 4.2.0 bump is done (02/11/2026, commits meta-chassis-420-1 to fix-cat-rename-stale-1); its checks wait for
the release (list below).

| Item | Waits on |
|---|---|
| **Deploy note (coordinator, 03/11/2026 06:04): skip 6.0.0 on deploy: go from live 5.0.0 straight to the next release; back up kitchen.json and kitchen-kit.db first.** 6.0.0 is signed but is not deployed. The next release must also move `kitchen.json` into `kitchen.db` in one step from either state (5.0.0: no `rev` / `settings_rev`, kit schema 2; 6.0.0: optional `rev`, `settings_rev`, kit schema 3); see `docs/agent/DB_MOVE.md`. Measured 03/11/2026 (coordinator, CT 121 `/healthz`): **live is 4.1.0**; the import takes its FORMAT 5 file as well. | the next release |
| The data move into databases (Kenny 02/11/2026 21:01, "ALLE info gaat vanaf nu in databases"; choices answered 03/11/2026 06:12, `docs/agent/DB_MOVE.md` "Decisions"): **server side built** [feat-db-schema-1], [feat-db-sync-1], [feat-db-import-1], [feat-db-store-1]: `kitchen.db` tables with real columns, the one-time import with `kitchen.json.pre-db` and a value-for-value check, every write with its change-log entry, synced collections per list plus `settings` (`/data/settings/kitchen`). Page side built 03/11/2026 [feat-db-pages-1], [feat-db-pages-2], [refactor-offline-kitdb-1] (`chassisData.db`, choice D1; DB_MOVE.md "Page side, as built"). Four questions held (release check 16, "Held"). Nothing run (Kenny's test rule) | Kenny's answers to the four held questions, release check 16 |
| Deploy 5.0.0 (released and signed 31/10/2026, tag v5.0.0, release commit 208d3de; signature verified with `minisign -Vm SHA256SUMS`). Live is 4.1.0. Behind the home route `KITCHEN_TRUSTED_PROXIES` must include 10.10.10.4; the kit's own database moves to schema 2 on first start, so going back to 4.1.0 needs the backup taken before the update (CHANGELOG 5.0.0 Migration) | the homelab thread (Live view on CT 121) |
| On main, not released: the four UX rounds of 01/11/2026 and the fixes of 02/11/2026 (CHANGELOG [Unreleased]), and since 03/11/2026 chassis-rs 4.5.0 (tag v4.5.0 [meta-chassis-450-1]) with kp-themes 12.3.0 (stand-ins dropped, check 15), before that chassis-rs 4.4.0 (tag v4.4.0 [meta-chassis-440-1]) with kp-themes 12.2.0 (gantt fit mode, dropped workarounds, the signed-out notice, More pages as kit secondary pages, the category rename's stale toast). Kitchen's kit database moves to schema 3 on first start, so a rollback to 5.0.0 needs a backup of `kitchen-kit.db` taken before the update (CHANGELOG [Unreleased] Migration) | release checks run 02/11/2026 (below): the datatable footprints got a Kitchen stand-in (Kenny 22:03 "Tijdelijke oplossing", [fix-table-footprint-1]), measure clear; then `chassis release` |
| ~~Bump: chassis-rs release with kp-themes 2bc105c2b and e1406eddb~~ **done 03/11/2026**: chassis-rs 4.5.0 (tag v4.5.0, kp-themes 12.3.0) [meta-chassis-450-1]; the table-footprint stand-in, the popover box-sizing rule and `nameTrigger` removed [refactor-drop-stand-ins-1]; re-measure is release check 15 | release check 15 |
| Per-recipe "Offline bewaren" [feat-offline-recipe-1..3] and the offline freezer take [feat-offline-take-1] (Kenny 17:25, 19:12, 19:13): built on chassis-rs main 8042dbe [meta-chassis-8042dbe-1], now on tag v4.4.0 [meta-chassis-440-1] (only `chassis` moved in `Cargo.lock`); release check 11 below | release check 11 |
| The offline copy [feat-offline-kitchen-1..4] and the revision fold [refactor-rev-kit-1] (02/11/2026, on chassis-rs cd68fd9): built, release checks 9 and 10 below not run | Kenny's release decision, then release checks 9 and 10 |
| kp-themes split delivery (Kenny 02/11/2026 17:24, "Nu overstappen"): merged on main 6f3fc0e [feat-kp-split-3] (branch `kp-split-entries`, 4ee6fbb), with Kitchen pinned to chassis-rs main fcb993f [meta-chassis-fcb993f-1], whose `WebApp::kp_modules()` makes the kit inject `webapp-runtime-modules.js` (imports only `remember.js`, `freshness.js`, `auto-refresh.js`), so a page holds one copy of kp's state. Release checks still to run (item 7 below) | Kenny's release decision, then release check 7 |

## Release checks

**Run once for 6.0.0 on 02/11/2026 evening** (Kenny's release word 20:15), on chassis-rs v4.4.0, a throwaway Kitchen
(`--state-dir` under `~/.cache/kitchen-600/`), Firefox only. Durations measured; failed parts rerun alone after their fix.

| Check | Result | Duration |
|---|---|---|
| `node --test scripts/` | 318/319; `offline-sync.test.mjs` threw (test wrong: no global EventTarget in Node) [fix-offline-sync-test-1], file rerun 6/6 | 0.4 s + rerun < 0.1 s |
| `cargo fmt --check`, clippy `-D warnings`, `cargo test`, the three checks | clean; cargo test 94/94 | fmt < 1 s, clippy 0.2 s (built by the pin commit's hook), test 10.5 s, checks < 0.1 s each |
| `cargo deny check advisories` | advisories ok (no dependency update) | 1.1 s |
| 3 / 7: Firefox smoke, every page incl. `/storage`, 1280 + 390, EN + NL | 0 console errors, 0 failed steps in all four | 2 min 13 s, 2 min 14 s, 2 min 12 s, 2 min 12 s |
| 7: network, 17 pages | no `kp-themes.min.js` / `kp-themes.css` / `css/fonts.css`, no kp or kit module loaded twice | 58 s |
| 7: every theme from the header menu, 1280 EN + 390 NL | 12 themes each, one `data-theme` change and one stored write per pick (single wiring), 0 errors | 52 s |
| 7: cook mode's place follows the login to a second browser context | same place in both (kit preference store) | 9 s |
| 7: printable sheet | **FAILED**: no ingredient checklist (kp's `setChecklistItems` skips an element of the iframe's realm); fixed [fix-sheet-checklist-1], rerun: 2 boxed items, Print calls the frame's print once | 5 s + 7 s + 6 s |
| 5: category rename, two tabs | stale rename refused, "changed elsewhere" toast with Reload, the other tab's name kept | 11 s |
| 10-13: `scripts/release/offline.e2e.mjs` (all 8 scenarios, a token Kitchen without trusted admins) | 1-2 ok; 3 **FAILED** (app: the keep-everything default's mark was a synced `kitchen:` key, so a new device kept nothing) [fix-offline-default-1]; 5 and 6 failed on the test (datatable failed state; `/status` is not Kitchen's, `/storage` is) [fix-offline-e2e-2], [fix-offline-e2e-3]; reruns of 3-8 ok (`KITCHEN_E2E_ONLY` [fix-offline-e2e-1]) | 32 s (setup), 1 min 4 s, 1 min 30 s, 46 s, 20 s |
| 13 (a)-(d), 14 (a)-(e): two devices (scratch script `~/.cache/kitchen-600/twodev.mjs`) | all as written: the second take refused (409 in the failed list), counts never below 0; kept recipe shows B's edit offline; band leaves offline, no Retry; Undo then B's version wins; stale delete and settings replays refused with B's values shown; online stale delete toast; two quick settings rows both save; online Undo. First run's 4 misses were the script (timing, selectors), rerun ok | 3 min 4 s + 55 s |
| 4: `measure.mjs` formal,dark 1280,390 over 14 pages | `/` `/eten` `/parents` only the accepted 64.7 px kicker; `/recipe` `/recipe/edit` `/cook` `/timing` `/bad-days` clear; `/settings` **FAILED** (Clear offline copy off the actions column) fixed [fix-settings-clear-align-1], rerun clear EN + NL; **OPEN**: datatable state footprints on `/dishes` `/ingredients` `/log` `/sources` (1280) and `/recipes` (390): the driven empty/failed table is 9-41 px lower than its loaded footprint (kp `footprint.js` holds one table and not the other with identical attributes; clean on 01/11/2026 under kp-themes 12.0.0's bundle); stand-in [fix-table-footprint-1] (after kp-themes 2bc105c2b), rerun of all 14 pages: only the accepted kicker on `/` `/eten` `/parents` | 10 min 17 s (2 in parallel), `/settings` reruns 1 min 36 s + 1 min 22 s |

Total measured: about 33 min 36 s. Not run (by hand per the items): 12 (b) the band's words after a language switch, the
gone notice's words in NL/EN; 11's and 12's measure of the kit drawer at 390.

Before the release word (02/11/2026, kept for the record):

What ran on 02/11/2026 before Kenny stopped test runs (16:16): one full gate after the bump commits (node 256/256 in
0.4 s, cargo test 74/74 in 13.4 s, clippy, fmt and the three checks clean) and one Firefox smoke at 1280 and 390 in
English and Dutch (0 console errors; 1 failed step in 3 of 4 runs, below). Nothing after fix-cat-rename-stale-1 ran.

1. The full suite: `node --test scripts/` (new: `scripts/signed-out.test.mjs`, `scripts/cat-rename-stale.test.mjs`, `scripts/kit-ready.test.mjs`, `scripts/paper-fonts.test.mjs`;
   changed: `scripts/shell-plan.test.mjs`; gone: `scripts/quantity-lock.test.mjs`), `cargo test`, clippy, fmt, the three checks.
2. ~~Smoke step `editor-save-leave`~~ **cleared 02/11/2026 (investigation only, no full run)**. Cause: the smoke script,
   not the editor. The four runs shared one state and the step typed "2 pots" into the gear field; the first run (1280 EN)
   saved it, so later runs changed nothing and the kit bar's Save stayed `aria-disabled` (the click timed out). Reproduced
   on one shared state (1280 EN pass, then 390 EN and 1280 NL fail); with the step typing a value the recipe does not hold
   yet (fixed in `~/.cache/kitchen-420/smoke.mjs` and `~/.cache/kitchen-wrap/smoke.mjs`) all four pass on one shared
   state. The bar itself works: dirty shows "Save 1 change", docked to the viewport at 390. Found on the way and fixed:
   at HEAD every page failed to read the kitchen (kit client looked up before the runtime module ran) [fix-kit-ready-1],
   and `/recipe` logged two font 404s from the print sheet [fix-paper-fonts-1]; check 3 covers both.
3. Firefox smoke of every page at 1280 and 390, EN and NL, 0 console errors; also `/storage` (the kit's header and phone
   tab bar now show the five places plus More; check no tab label needs `Page::short_label`).
4. `node scripts/measure.mjs <path> formal,dark 1280,390` over the main pages (accepted: side-wheel kicker 64.7 px on / and /eten at 1280).
5. The category rename's stale toast (fix-cat-rename-stale-1) in Firefox: rename a category in one tab after saving it in another;
   expect the shared "changed elsewhere" toast with Reload and the cell's own refusal.
6. Measured once on 02/11/2026 (no re-run needed unless the code moves): popovers, settings theme button, /bad-days NL nav,
   the dish rows' five actions, `kp-kv--center`, long wheel names, Override switch, offline cook mode, photo upload, QR, the
   401 notice (EN 1280, NL 390). Numbers in CHANGELOG [Unreleased] and `~/Projects/kp-gaps/kitchen.md`.
7. **The split delivery [feat-kp-split-1]** (merged on main 6f3fc0e [feat-kp-split-3] on chassis-rs fcb993f with
   `kp_modules()`; release checks still to run, nothing run on 02/11/2026): `node --test scripts/kp-entries.test.mjs` (new; finds the vendored
   `dist/js/` in the cargo checkout of the chassis revision in `Cargo.lock`, or `KP_DIST=<dir>`); the Firefox smoke of
   every page (`/`, `/recipes`, `/recipe`, `/recipe/edit`, `/cook`, `/timing`, `/bad-days`, `/settings`, `/log`,
   `/dishes`, `/ingredients`, `/sources`, `/parents`, an item page, `/eten`) at 1280 and 390, English and Dutch, with 0
   console errors, and in every theme picked from the menu (the register loads before the switch, no unstyled frame);
   a network check per page that no page loads `kp-themes.min.js`, `kp-themes.css` or `css/fonts.css` (the injected
   runtime included) and no kp module or chunk loads twice; cook mode's remembered place still follows the login to a
   second browser (the kit's preference store); the printable sheet still prints with its checklist boxes; `auto.js`
   and Kitchen's own `attachThemePickers` do not wire the theme menu twice (one change per pick); `measure.mjs` on the
   main pages (CSS order moved: base + register instead of the full sheet).
8. ~~Re-pin chassis-rs to the release tag carrying 67d593e~~ **done 02/11/2026 [meta-chassis-440-1]**: tag v4.4.0
   (a37312e, carries 67d593e) in both `Cargo.toml` entries and `.chassis.toml`; only `chassis` moved in `Cargo.lock`
   (4.3.0 rev 67d593e to 4.4.0 tag a37312e); `chassis sync --write` regenerated `docs/KIT.md`. chassis 4.4.0 has no
   Migration item Kitchen had not done (`post()` / `IdempotencyKey`, the kit's failed-edits drawer, server-wins with no
   `onConflict` set, trimmed keep with `keepAll` / `keepItem` awaited).
9. **The offline copy [feat-offline-kitchen-1..4], [refactor-rev-kit-1]** (nothing run on 02/11/2026): the new and changed
   unit tests `node --test scripts/offline-apply.test.mjs scripts/offline-keep.test.mjs scripts/offline-size.test.mjs
   scripts/save-rev.test.mjs`, and `cargo test` (changed: `src/routes.rs` tests for the
   kit's 409 shape, `src/store/tests/rev.rs` on `Precondition`, new `if_match_star_saves_over_any_revision`).
10. **The offline release script** `KITCHEN_BASE=… KITCHEN_TOKEN=… node scripts/release/offline.e2e.mjs` (Firefox, a test
   Kitchen; it edits the pace and one dish's name and puts both back): cook mode reloaded offline with "Keep everything
   offline" on; only one recipe kept (release check 11); an offline edit shown after an offline reload,
   then replayed; a conflict on replay landing in the list of refused edits and "Keep the kitchen's version" emptying it;
   "Clear offline copy" then an offline reload showing the failed state; signing out with an unsent edit asking first
   (the kit's guard since 073273f); the refused edit shown and discarded in the kit's drawer (`dialog.chassis-failed`). Then the Firefox smoke and `measure.mjs` on `/settings` (the new
   Calm row) at 1280 and 390, EN and NL, and the kit's failed-edits drawer at 390.

11. **Keep one recipe offline [feat-offline-recipe-1..3] and the offline freezer take [feat-offline-take-1]** (written
   02/11/2026 on chassis-rs 8042dbe, nothing run): `cargo test` (new: `src/routes_tests.rs`
   `an_item_answers_the_dish_with_its_recipes_and_its_rev_as_etag`, `a_missing_item_or_list_is_404`,
   `a_take_replayed_with_the_same_key_takes_one_portion`, `a_key_that_is_not_a_uuid_is_the_kits_400_and_none_is_fine`;
   `src/store/tests/idempotent.rs`, five tests: a repeated key, another or no key, a refused take records nothing, only the
   last 200 keys, keys survive a reopen; the route tests moved from `src/routes.rs` to `src/routes_tests.rs`);
   `node --test scripts/offline-kept.test.mjs` (new: dish paths, kept ids, the switch's state, a dish's ingredients, the
   ingredient plan, the count, the partial kitchen, the route table) and the take tests added to
   `scripts/offline-apply.test.mjs`; scenarios 2 and 7 of
   `scripts/release/offline.e2e.mjs` (2: the kit keeps the dish and NOT `/data/kitchen`, the recipe and cook mode open
   offline, another dish does not, the Calm row counts it, clearing clears it; 7: a take whose answer is lost is replayed
   with the same key and takes ONE portion, an offline take shows at once and reaches the kitchen once). Also the existing
   offline tests against 8042dbe (`keepAll` / `keepItem` now return promises; Kitchen awaits both), then `measure.mjs` on
   `/recipe` with the switch shown, `/settings` (the count line) and `/bad-days`, 1280 and 390, EN and NL.
12. **A kept recipe whose dish is gone [feat-offline-gone-1]** (written 02/11/2026, nothing run): `node --test
   scripts/offline-gone.test.mjs` (new: a 404 is gone, no connection and every other status are not, only kept dishes
   missing from the list are asked about, the notice once per dish, the ingredient sweep) and scenario 8 of
   `scripts/release/offline.e2e.mjs` (a kept dish deleted on the server: a lost connection drops nothing; the next online
   read drops the keep and the copy and shows the notice once; a later read stays quiet). By hand once: the notice reads
   right in NL and EN and is not sticky.

13. **Offline: the server is the master [fix-offline-master-1..4]** on chassis-rs 67d593e, now v4.4.0 (written 02/11/2026, nothing
   run): `node --test scripts/offline-sync.test.mjs scripts/offline-undo.test.mjs scripts/offline-kept.test.mjs` (new:
   offline-sync, offline-undo; `keptRefreshPlan` added to offline-kept), then the whole node suite and the existing
   offline scenarios of `scripts/release/offline.e2e.mjs` against v4.4.0 (the kit now restores the server's copy on a
   refused replay and drops it on a 404). By hand in Firefox, or as new e2e scenarios: (a) take the last portion
   offline in two tabs, reconnect: the second take is refused and the freezer shows the server's count, not 0 below it;
   (b) keep one recipe with "keep everything" off, edit it on another device, open any page online, go offline and
   reload: the kept recipe shows the other device's edit; (c) go offline, navigate, come back online, navigate: the
   band leaves "offline" and the page shows the server's data without Retry; (d) delete a shelf item offline, Undo,
   change that item on another device, reconnect and navigate: the other device's version shows.

14. **A checked delete and settings change [fix-offline-master-5]** (written 02/11/2026, nothing run): `cargo test` (new:
   `src/store/tests/rev_delete_settings.rs`, seven tests: a stale delete refused and the newer item kept, a delete at the
   stored rev goes and Undo still restores it, a delete without `If-Match` as before, every settings merge bumps
   `settings_rev`, a stale settings merge refused and nothing changed, a merge without `If-Match` as before, an old file
   without `settings_rev` opens at format 5 and counts from 0; `src/routes_tests.rs`: a stale delete is the kit's 409 with
   the dish as `current`, a delete without `If-Match` or at the stored rev goes, the settings answer `ETag` and a stale
   PATCH is refused with the settings as `current`); `node --test scripts/save-rev.test.mjs` (new: `deleteRevFor`,
   `settingsRevFor`, the stale 409 recognised). Firefox, two devices (or two browsers) A and B: (a) on A go offline and
   delete a shelf item; on B change that item online; bring A back: A's replay is refused, lands in the kit's failed list
   (Review), and A shows B's version of the item, not a gap; (b) the same with a settings change (pace on A offline, pace
   or dinner time on B online): A's replay is refused and A's settings page shows B's values after the reread; (c) online,
   two tabs: delete an item in tab 1 that tab 2 saved after tab 1 read it: the "changed elsewhere" toast with Reload, the
   item stays; (d) on the settings page change two rows in quick succession: both save (merges run one after the other),
   no stale toast; (e) Undo right after an online delete still puts the item back.
15. **The dropped stand-ins [refactor-drop-stand-ins-1]** (03/11/2026 on chassis-rs 4.5.0 / kp-themes 12.3.0, nothing run): at the next
   release, in Firefox at 1280 and 390, formal and dark: (a) re-measure the five data-table pages (`node scripts/measure.mjs <path>
   formal,dark 1280,390`): an empty or failed table keeps the loaded footprint (the removed `datatable-footprint.js` made it 9-41 px
   taller before; 0 findings); (b) the Send to phone and Print options popovers at 390: the plate stays inside the window, no
   overflow at 320; (c) the /settings theme button: pick a theme in the header's menu and the row's labelled trigger names it at once;
   (d) `node --test scripts/` still green (no test referenced the removed files) and `node scripts/check-words.mjs` 0 (it was).

16. **The data move into databases [feat-db-schema-1], [feat-db-sync-1], [feat-db-import-1], [feat-db-store-1]** (server side
   built 03/11/2026 on chassis-rs v4.5.0; tests written, NOTHING run, Kenny's test rule). Static checks at the commits:
   `cargo build`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, check-words/forms/wheels clean.
   (a) `cargo test`, the new and changed tests:
   - `store::db::tests::import_roundtrip`: `the_4_1_0_file_imports_value_for_value`, `the_5_0_0_file_…`,
     `the_6_0_0_file_…_with_its_revisions_and_keys` (each fixture copied beside a fresh `kitchen.db`, opened through
     `AppDb::open` + `app_db_spec()`: import Done, `kitchen.json.migrated` and `kitchen.json.pre-db` hold the original
     bytes, the database equals the normalized file value for value, every item has a `rev`),
     `a_second_start_does_not_import_again_and_keeps_the_data`, `a_new_kitchen_gets_the_seed_and_renames_nothing`;
   - `store::db::tests::import_refused`: a newer-format file and a broken file are refused whole (import Failed, the file
     untouched, no `.migrated`, the copy kept, nothing written, `boot::import_verdict` refuses the start naming the
     reason), `a_retry_keeps_the_first_copy`, `only_a_done_import_lets_the_store_start`;
   - `store::db::tests::codec` (odd values through `k_extra`, empty list vs absent key, settings with an unknown key,
     the difference finder) and `store::db::tests::schema` (`schema_v1/*.sql` equals the table specs column for column);
   - `store::tests::db_store`: stale PUT, DELETE and settings PATCH refused with nothing changed in the database,
     the idempotent take with its key stored in `answered`, Undo's restore back at its place, memory and database
     agree after a run of changes;
   - `store::tests::db_sync`: create, replace, delete (tombstone rev + 1), restore, take and settings each record their
     change; a refused change records nothing; a failed write leaves neither row nor change (same transaction); the
     feed serves the changed dish exactly as the item route answers it and the delete after the cursor; the feed
     serves the settings item;
   - changed to the database: `crud::a_prune_that_cannot_save_…`, `idempotent::the_keys_survive_a_reopen_of_the_database`,
     `rev::an_old_file_without_revisions_imports_at_rev_0_…`, `rev_delete_settings::an_old_file_without_a_settings_revision_…`;
     the existing route tests (`routes_tests.rs`) run on the in-memory store as before.
   (b) By hand, throwaway state dir, Firefox: a copy of the LIVE 4.1.0 `kitchen.json` and `kitchen-kit.db` started once
   on the new binary: "one-time import committed" in the log, the kit DB migrates, every page shows the same data,
   `GET /data/kitchen` before (on 4.1.0) and after equal except the added `rev: 0`; `GET /api/sync` lists the eleven
   collections; a broken copy of the file: the service exits 1 with "kitchen refuses to start" and the reason.
   (c) The rollback once on that copy: stop; restore `kitchen-kit.db` (and `kitchen.db`: delete it, there was none);
   `kitchen.json.pre-db` back to `kitchen.json`; the 4.1.0 binary starts and shows the same data.
   (d) The page move (choice D1) [feat-db-pages-1], [feat-db-pages-2], [refactor-offline-kitdb-1] (written 03/11/2026,
   NOTHING run; static checks at the commit: `node --check` on every changed file, check-words/forms/wheels 0).
   `node --test scripts/`: new `offline-assemble.test.mjs` (made order, `pending` stripped, settings item to
   `settings` + `settings_rev` with null keys removed, waiting takes over the freezer with failed ones skipped,
   `partial`, `overServer` laying only waiting edits over the service's kitchen, `collectionOfPath`), new
   `offline-keep-plan.test.mjs` (toggle state, a dish's ingredients, `releasePlan`, orphans and missing names, the kept
   count, `goneDishIds` skipping own deletes, notice once), changed `offline-undo.test.mjs` (the database's record comes
   back, the parked copy only when the device does not hold it, `{ dropped, item }`), changed `offline-keep.test.mjs`
   (the needsReread test went with `offline/sync.js`; `kitchen-device:kept-dishes-seen` is not synced to the login);
   removed `offline-apply`, `offline-kept`, `offline-gone`, `offline-sync` tests (their modules are gone).
   `scripts/release/offline.e2e.mjs` (Firefox, throwaway Kitchen), the page scenarios: 1 an offline reload with keep-all
   on (cook mode, band offline); 2 one recipe kept (keep-all off: the database holds that dish and no other; recipe and
   cook mode open offline, another recipe does not; the Calm row counts it); 3 an offline edit shows after an offline
   reload and is replayed once online; 4 a stale replay lands in the kit's failed list, Discard keeps the server's
   version; 6 logout with an unsent edit asks first; 7 a freezer take whose answer was lost is replayed with the same
   Idempotency-Key and takes ONE portion, and one made offline shows at once and is sent once; 8 a kept dish deleted
   elsewhere: the kit's pull removes it, the keep is dropped, the notice shows once, offline nothing is dropped; 9 a
   settings merge made offline over another device's change is refused on replay and the page shows the other value.
   Scenario 5 (clear copy) is out until held question (4) is answered. By hand in Firefox besides: the band goes
   offline/online with the pulls; two tabs: an edit saved in one shows in the other after focus (the kit's pull);
   with keep-all off and online, every page shows the whole kitchen; switching keep-all off then on: the database is
   trimmed, then filled again; the 6.0.0 -> next update on a device that had the old copy: the first start reads from
   the database (the old `/data/kitchen` copy in `chassis-data:kitchen` is dead weight until "Clear offline copy").

   **For the page helper** (`chassisData.configure({ name, db: true })`): collections `freezer`, `shelf`, `log`,
   `resting`, `dishes` (recipes inside, `rev` covers them), `dish_categories`, `ingredients`, `ingredient_categories`,
   `drafts`, `recipe_sources`: key `id`, rev `rev`, routes `/data/<list>` (POST creates; the server issues the id) and
   `/data/<list>/:id` (GET with `ETag`, PUT whole item with `If-Match`, DELETE with `If-Match`); feed bodies are exactly
   the item route's body. `settings`: one item `kitchen`, `{id: "kitchen", rev: <settings_rev>, ..keys}`,
   `GET`/`PATCH /data/settings/kitchen` (PATCH merges, `null` removes, `If-Match` = rev, 409 with the item as
   `current`); `/data/settings` keeps the plain object for today's pages; both share one revision. Indexes: freezer
   `dish_id`, `frozen_on`; shelf `energy`; log `dish_id`, `shelf_id`, `date`; resting `dish_id`, `until`; dishes
   `category`; both category lists `order`; ingredients `category`; drafts `key`; recipe_sources `language`. The freezer
   take stays `POST /data/freezer/{id}/take` with `Idempotency-Key`; Undo stays `POST /data/restore/{list}/{id}`; both
   show in the feed as upserts. Items imported without a revision now carry `"rev": 0`; items created later have none
   until their first save (`rev_of` reads absent as 0, as before).

   **Held (questions for Kenny):** (1) offline creates under a device-made id (`client_key` /
   `check_create`; needs the create's `Idempotency-Key` stored per item, e.g. a bookkeeping column per list): build in
   this release, or keep creates online-only as today (recommended for this release: online-only, no new write path in
   the same release as the data move); (2) the feed carries no list order (`k_pos` is server bookkeeping, not in the
   body): the pages sort by `order`, `date`, names and `frozen_on` already; where a screen relies on stored order (none
   found in `web/js` sorts), options are sort by `created` in the page, or add the position to the feed body (a read-only
   field the server strips on PUT); recommended: sort by `created` in the page. **Interim as built
   [feat-db-pages-1]**: the page puts each list in `created` order (`byCreated`, `offline/assemble.js`), the order every
   route-made item had in the file; swap there if Kenny picks the feed field. (3) "Keep everything" off, ONLINE: the
   kit's database then holds only the kept keys and the kit has no online read for the rest. Options: (a) as built:
   `GET /data/kitchen` straight from the service (never copied) with the kept items' waiting edits and the waiting takes
   laid over (`overServer`); edits queued for an item the device does not keep show again only after their replay;
   (b) ask the kit for a "read through" mode of a collection (pull everything, store only the kept keys); (c) drop
   "keep everything" off and keep only per-recipe marks on top of a full database. Recommended: (a) now, (b) filed as a
   kit wish. (4) "Offline kopie wissen": the kit has no call that empties its local database and keeps the queue
   (`purge` drops the queue too, `clearCopy` only the response cache). Options: (a) as built: unchanged, the button
   clears the kit's response cache only (after the update that frees the old `/data/kitchen` copy; the database stays,
   the row's size does not drop to 0); (b) a kit call `db.clear()` (drop records, reset cursors, keep the queue and
   keeps; the next pull fills it again), then the button uses it; (c) remove the button. DECIDED (Kenny 03/11/2026
   "Knop verbergen"): the button is hidden until the kit ships `db.clear()` that keeps the queue (kp-gaps/chassis-rs.md
   03/11 local DB item 3); bring it back by setting `SHOW_CLEAR_COPY = true` in `web/js/pages/settings/offline-row.js`
   and wiring it to `db.clear()`. (3) is built as (a), the kit wish filed. Kit wish besides (no choice): an explicit `rev` on the collection's `put`/`patch`/`delete`,
   so Kitchen could drop `writeJson` (DB_MOVE.md "Page side, as built").

17. **chassis-rs 4.7.0 / kp-themes 12.6.0 [meta-chassis-460-1], [meta-chassis-470-1], [feat-kit-460-1],
    [feat-kit-470-1], [feat-kp-addrow-1], [refactor-nav-more-pinned-1], [feat-api-parts-1]** (04/11/2026; measured while
    building, not a release run): Firefox sweep of 15 pages x 1280/390/390-coarse x EN/NL on main 738df2d: 0 CSP
    violations, 0 failed states, 0 sideways scroll, console errors only the kit's service-worker line on `/status`
    (6/6, kp-gaps/chassis-rs.md 04/11). At the release: (a) `node --test scripts/` and `cargo test` (new:
    `scripts/snapshot-parts.test.mjs`, `src/routes_parts_tests.rs`; changed: `scripts/offline-assemble.test.mjs`,
    `scripts/timeline-fit.test.mjs`, `src/store/db/tests/import_refused.rs`); (b) an offline freezer take through the
    item action shows at once and is sent once (two devices, check 11's scenario); (c) "Offline kopie wissen" with an
    edit waiting (measured once: 7500 -> 0 bytes, the edit kept and sent); (d) the add rows on /log and both category
    tables, NL and EN: labels shown, Enter on a closed select adds, "Toegevoegd <naam>"; (e) `/data/kitchen` forced to
    fail: the pages load from the parts endpoints; (f) a broken `kitchen.json` on a throwaway state dir: exit 1, file
    untouched (measured once: 62 ms).

## Offline: the server is always the master (Kenny 02/11/2026 19:43)

"De server is altijd de master, heeft altijd gelijk." Online answers always replace the local copy; a server deletion
removes the local item; a refused queued edit never overrides the server: it stays in the kit's failed list (Discard /
Save again, which sends `If-Match` with the newest revision held). No path may let the local copy win silently.
Audited 02/11/2026 on chassis-rs 67d593e (which enforces the kit's half): a refused replay rereads the kitchen
[fix-offline-master-1]; kept recipes are re-read on every online kitchen read [fix-offline-master-2]; a kitchen read
from the copy is read again on a page change or reconnect [fix-offline-master-3]; Undo of a queued delete leaves the
next online read to win [fix-offline-master-4]. Checked and fine: Kitchen sets no `onConflict` (the kit's skip; the
overwrite answer no longer exists); "Save again" only from the kit's drawer; no list read carries a filter (a list GET
without a query string is the whole collection to the kit); local per-device values (language, calm mode, tonight's
wheel answer, today's dinner time, the timer's digits) never reach the server, and the settings page saves only on a
change. The last two unchecked replays, a queued `DELETE` and a queued settings `PATCH`, are checked since
[fix-offline-master-5] (option A, following from Kenny's rule; release check 14).

## Waiting on kp-themes or chassis-rs (workarounds kept; drop each when its fix ships)

- **Built on chassis-rs 8042dbe, released in 4.4.0 (re-pinned [meta-chassis-440-1])**: per-item keep [feat-offline-recipe] and the freezer take through
  `chassisData.post()` [feat-offline-take-1]. Release check 11. A kit gap: `post(path, body, { optimistic })` amends only the copy of the POST's own path, so Kitchen
  shows a queued take through its own overlay instead (filed for chassis-rs: an `optimistic` that names the path it
  amends).
- Built on chassis-rs main 073273f (in 8042dbe) `[refactor-offline-drawer-1]` (written 02/11/2026, nothing run): Kitchen's own
  failed-edits drawer (`web/js/offline/failed-list.js`, `describe.js`, `scripts/offline-describe.test.mjs`, `off.failed*` /
  `off.what*` words) is gone; the kit's drawer (Discard / Save again / Discard all) opens from the toast's Review,
  `chassisData.review()` or `[data-chassis-review]`, with Kitchen's NL/EN words through `kitMessages` (`off.kit*`).
  Release check 12: (a) from a Kitchen page AND a kit page (`/status`) sign out with an unsent edit: the kit asks first, "Stay"
  leaves Log out usable; (b) switch language NL/EN with the band showing offline/reconnecting/refused: its words follow at once
  (the drawer's words follow at the next load); (c) a refused replay (scenario 3 of `scripts/release/offline.e2e.mjs`, adjusted
  to `dialog.chassis-failed`): Review opens the kit drawer, Discard empties it, Save again resends; then `measure.mjs` of the
  drawer at 390 and 1280, EN and NL; `node scripts/check-words.mjs` 0 (it was).

- Lower cook-timeline rows (`--kp-gantt-row-sub: 1.625rem`, `web/css/pages/cook.css`): still needed with 12.2.0 (lanes 86/112 px with, 128/168 without).
- ~~Lazy fold autosize (`web/js/ui/fold-autosize.js`)~~ **dropped 03/11/2026 [refactor-drop-nav-autosize-1]**: on kp-themes 12.4.0 the editor of the
  60-line/40-step recipe opens in 2.77 s without it vs 3.04 s with it (Firefox, median of 3). The debounced timeline repaint
  (`web/js/recipe/editor/paint-timing.js`) stays: a key costs 302 ms without it vs 85 ms with it (`~/Projects/kp-gaps/kitchen.md`).
- ~~`box-sizing: border-box` on the popover panel and `nameTrigger`~~ **dropped 03/11/2026 [refactor-drop-stand-ins-1]** (kp-themes 12.3.0 has both fixes, e1406eddb); re-check in release check 15.
- The signed-out notice opens the login in a new tab because the kit's login read no `next` (kp-gaps/chassis-rs.md).
  The kit's login takes `?next=` since chassis-rs 0b541ca (in 4.7.0), so the notice can link back in the same tab;
  Kenny's choice at the release.
- ~~The More item of the bar is built by hand~~ **replaced 03/11/2026 [refactor-nav-more-pinned-1]** by kp's `data-kp-nav-more` on a `data-kp-nav-fold` bar
  (its words do not follow a language change: `~/Projects/kp-gaps/kitchen.md`). The in-use reason-tooltip workaround
  (`web/js/records/in-use.js`) stays until kp-themes ships its card-layout tooltip fix.

## Choices for Kenny (not built)

None open: the unchecked replays are built as option A [fix-offline-master-5] (it follows from Kenny's rule of 19:43); the per-recipe toggle (option B, Kenny 19:12) and the freezer take ("Kit krijgt post()", 19:13) are decided and built on chassis-rs 8042dbe (rows above).

Kit gaps found while building (chassis-rs cd68fd9, filed in kp-gaps/chassis-rs.md 02/11/2026):
- [x] Logout did not ask on the kit's pages, the band's words read once, no `post()`, no failed-edits view: all four fixed in
  chassis-rs 073273f / 8042dbe (done on 8042dbe; the row for 073273f is ticked, re-check in release check 12).
- [x] (4.7.0: the take is the freezer's item action, [feat-kit-470-1]) **Optimistic `post()` only updates the POST's own path** (`post(path, body, { optimistic })` amends the copy of the
  POST's path, not the list it changes): Kitchen draws the queued freezer take itself (`takePortions`, `applyTakes` in `offline/assemble.js`).
  Filed in kp-gaps/chassis-rs.md 02/11/2026 (an `optimistic` that names the path it amends); drop Kitchen's overlay when it ships.

Not open (decided or moved): the side wheel's kicker 64.7 px lower than the dish wheel's on `/` and `/eten` at 1280 is
deliberate (Kenny, 30/10/2026 17:52, bottoms level; see `docs/DECISIONS.md`); "After 1.0: memory, sensory profile, low
typing" is parked in `docs/agent/PARKED.md`; Kitchen runs live, so the homelab-stack row is gone.
