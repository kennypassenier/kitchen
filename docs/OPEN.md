# Open

5 items open: the deploy of 5.0.0, the release of what is on main (now on chassis-rs main 67d593e), the kp-themes split delivery's release checks, the offline copy's release checks, and the per-recipe keep and offline freezer take (built, waiting on the chassis-rs release tag and their checks) about the offline copy.
The chassis-rs 4.2.0 bump is done (02/11/2026, commits meta-chassis-420-1 to fix-cat-rename-stale-1); its checks wait for
the release (list below).

| Item | Waits on |
|---|---|
| Deploy 5.0.0 (released and signed 31/10/2026, tag v5.0.0, release commit 208d3de; signature verified with `minisign -Vm SHA256SUMS`). Live is 4.1.0. Behind the home route `KITCHEN_TRUSTED_PROXIES` must include 10.10.10.4; the kit's own database moves to schema 2 on first start, so going back to 4.1.0 needs the backup taken before the update (CHANGELOG 5.0.0 Migration) | the homelab thread (Live view on CT 121) |
| On main, not released: the four UX rounds of 01/11/2026 and the fixes of 02/11/2026 (CHANGELOG [Unreleased]), and since 02/11/2026 chassis-rs 4.2.0 with kp-themes 12.2.0 (gantt fit mode, dropped workarounds, the signed-out notice, More pages as kit secondary pages, the category rename's stale toast). Kitchen's kit database moves to schema 3 on first start, so a rollback to 5.0.0 needs a backup of `kitchen-kit.db` taken before the update (CHANGELOG [Unreleased] Migration) | Kenny's release decision (a form with the open items), then the release checks below |
| Per-recipe "Offline bewaren" [feat-offline-recipe-1..3] and the offline freezer take [feat-offline-take-1] (Kenny 17:25, 19:12, 19:13): built on chassis-rs main 8042dbe [meta-chassis-8042dbe-1], release check 11 below not run. **Re-pin to the chassis-rs release tag carrying 8042dbe** before the release (only `chassis` moves in `Cargo.lock`) | the chassis-rs release, then Kenny's release decision and release check 11 |
| The offline copy [feat-offline-kitchen-1..4] and the revision fold [refactor-rev-kit-1] (02/11/2026, on chassis-rs cd68fd9): built, release checks 9 and 10 below not run | Kenny's release decision, then release checks 9 and 10 |
| kp-themes split delivery (Kenny 02/11/2026 17:24, "Nu overstappen"): merged on main 6f3fc0e [feat-kp-split-3] (branch `kp-split-entries`, 4ee6fbb), with Kitchen pinned to chassis-rs main fcb993f [meta-chassis-fcb993f-1], whose `WebApp::kp_modules()` makes the kit inject `webapp-runtime-modules.js` (imports only `remember.js`, `freshness.js`, `auto-refresh.js`), so a page holds one copy of kp's state. Release checks still to run (item 7 below) | Kenny's release decision, then release check 7 |

## Release checks (not run on 02/11/2026: tests only at the release, with Kenny's ok)

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
8. **Re-pin chassis-rs to the release tag carrying 67d593e** (OPEN again: [meta-chassis-67d593e-1] pinned rev 67d593e on
   02/11/2026 evening, after [meta-chassis-8042dbe-1] pinned 8042dbe; before that done as [meta-chassis-430-1]: tag v4.3.0 = db11d10 carries
   `kp_modules()`, the gzip prefs fix, the login `?next=` and the offline data client; only `chassis` moved in `Cargo.lock`).
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

13. **Offline: the server is the master [fix-offline-master-1..4]** on chassis-rs 67d593e (written 02/11/2026, nothing
   run): `node --test scripts/offline-sync.test.mjs scripts/offline-undo.test.mjs scripts/offline-kept.test.mjs` (new:
   offline-sync, offline-undo; `keptRefreshPlan` added to offline-kept), then the whole node suite and the existing
   offline scenarios of `scripts/release/offline.e2e.mjs` against 67d593e (the kit now restores the server's copy on a
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

- **Built on chassis-rs 8042dbe (unreleased)**: per-item keep [feat-offline-recipe] and the freezer take through
  `chassisData.post()` [feat-offline-take-1]. At the release tag: re-pin, run release check 11. A kit gap: `post(path, body, { optimistic })` amends only the copy of the POST's own path, so Kitchen
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
- Lazy fold autosize (`web/js/ui/fold-autosize.js`) and the debounced timeline repaint (`web/js/recipe/editor/paint-timing.js`):
  still help on the 60-line/40-step recipe (open 2.9 s vs 8.2 s; 155 vs 350 ms a key).
- `box-sizing: border-box` on the popover panel (`web/css/app.css`): `.kp-popover--panel` caps content-box (kp-gaps/kitchen.md).
  Fixed on kp-themes main e1406eddb (panel is border-box, 352 px at 390, no overflow at 320): drop the rule once that
  kp-themes release reaches Kitchen through chassis-rs, then re-measure the Send to phone / Print options popovers at 390.
- Renaming the settings row's labelled theme trigger after a pick in the header's menu (`nameTrigger`, `web/js/pages/settings/calm-theme.js`; kp-gaps/kitchen.md).
  Fixed on kp-themes main e1406eddb (the labelled trigger follows every theme change): drop `nameTrigger` once that
  kp-themes release reaches Kitchen through chassis-rs, then check the /settings theme button after a pick in the header.
- The signed-out notice opens the login in a new tab because the kit's login read no `next` (kp-gaps/chassis-rs.md).
  With chassis login `?next=` (chassis-rs main 0b541ca) the signed-out notice can link back to the same tab; decide at the release.
- The More item of the bar is built by hand (no `data-kp-nav-more` in kp-themes yet); the in-use reason-tooltip workaround
  (`web/js/records/in-use.js`) until kp-themes ships its card-layout tooltip fix.

## Choices for Kenny (not built)

None open: the unchecked replays are built as option A [fix-offline-master-5] (it follows from Kenny's rule of 19:43); the per-recipe toggle (option B, Kenny 19:12) and the freezer take ("Kit krijgt post()", 19:13) are decided and built on chassis-rs 8042dbe (rows above).

Kit gaps found while building (chassis-rs cd68fd9, filed in kp-gaps/chassis-rs.md 02/11/2026):
- [x] Logout did not ask on the kit's pages, the band's words read once, no `post()`, no failed-edits view: all four fixed in
  chassis-rs 073273f / 8042dbe (done on 8042dbe; the row for 073273f is ticked, re-check in release check 12).
- [ ] **Optimistic `post()` only updates the POST's own path** (`post(path, body, { optimistic })` amends the copy of the
  POST's path, not the list it changes): Kitchen draws the queued freezer take itself (`takePortions`, `offline/apply.js`).
  Filed in kp-gaps/chassis-rs.md 02/11/2026 (an `optimistic` that names the path it amends); drop Kitchen's overlay when it ships.

Not open (decided or moved): the side wheel's kicker 64.7 px lower than the dish wheel's on `/` and `/eten` at 1280 is
deliberate (Kenny, 30/10/2026 17:52, bottoms level; see `docs/DECISIONS.md`); "After 1.0: memory, sensory profile, low
typing" is parked in `docs/agent/PARKED.md`; Kitchen runs live, so the homelab-stack row is gone.
