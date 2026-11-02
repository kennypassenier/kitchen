# Open

5 items open: the deploy of 5.0.0, the release of what is on main (now on chassis-rs 4.3.0), the kp-themes split delivery's release checks, the offline copy's release checks, and two choices for Kenny about the offline copy.
The chassis-rs 4.2.0 bump is done (02/11/2026, commits meta-chassis-420-1 to fix-cat-rename-stale-1); its checks wait for
the release (list below).

| Item | Waits on |
|---|---|
| Deploy 5.0.0 (released and signed 31/10/2026, tag v5.0.0, release commit 208d3de; signature verified with `minisign -Vm SHA256SUMS`). Live is 4.1.0. Behind the home route `KITCHEN_TRUSTED_PROXIES` must include 10.10.10.4; the kit's own database moves to schema 2 on first start, so going back to 4.1.0 needs the backup taken before the update (CHANGELOG 5.0.0 Migration) | the homelab thread (Live view on CT 121) |
| On main, not released: the four UX rounds of 01/11/2026 and the fixes of 02/11/2026 (CHANGELOG [Unreleased]), and since 02/11/2026 chassis-rs 4.2.0 with kp-themes 12.2.0 (gantt fit mode, dropped workarounds, the signed-out notice, More pages as kit secondary pages, the category rename's stale toast). Kitchen's kit database moves to schema 3 on first start, so a rollback to 5.0.0 needs a backup of `kitchen-kit.db` taken before the update (CHANGELOG [Unreleased] Migration) | Kenny's release decision (a form with the open items), then the release checks below |
| Two choices about the offline copy (section "Choices for Kenny" below): the per-recipe toggle's shape and a freezer take without a connection | Kenny (a form) |
| The offline copy [feat-offline-kitchen-1..4] and the revision fold [refactor-rev-kit-1] (02/11/2026, on chassis-rs cd68fd9): built, release checks 9 and 10 below not run | Kenny's release decision, then release checks 9 and 10 |
| kp-themes split delivery (Kenny 02/11/2026 17:24, "Nu overstappen"): merged on main 6f3fc0e [feat-kp-split-3] (branch `kp-split-entries`, 4ee6fbb), with Kitchen pinned to chassis-rs main fcb993f [meta-chassis-fcb993f-1], whose `WebApp::kp_modules()` makes the kit inject `webapp-runtime-modules.js` (imports only `remember.js`, `freshness.js`, `auto-refresh.js`), so a page holds one copy of kp's state. Release checks still to run (item 7 below) | Kenny's release decision, then release check 7 |

## Release checks (not run on 02/11/2026: tests only at the release, with Kenny's ok)

What ran on 02/11/2026 before Kenny stopped test runs (16:16): one full gate after the bump commits (node 256/256 in
0.4 s, cargo test 74/74 in 13.4 s, clippy, fmt and the three checks clean) and one Firefox smoke at 1280 and 390 in
English and Dutch (0 console errors; 1 failed step in 3 of 4 runs, below). Nothing after fix-cat-rename-stale-1 ran.

1. The full suite: `node --test scripts/` (new: `scripts/signed-out.test.mjs`, `scripts/cat-rename-stale.test.mjs`;
   changed: `scripts/shell-plan.test.mjs`; gone: `scripts/quantity-lock.test.mjs`), `cargo test`, clippy, fmt, the three checks.
2. Smoke step `editor-save-leave` failed at 390 EN, 1280 NL and 390 NL (passed at 1280 EN): the smoke found no "Save"
   button after typing in the gear field (`getByRole('button', { name: /Save|opslaan/i })`). Find out whether the
   editor's unsaved bar or the smoke's locator is at fault before the release.
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
8. **Re-pin chassis-rs to its release tag: DONE 02/11/2026** [meta-chassis-430-1] (tag v4.3.0 = db11d10 carries
   `kp_modules()`, the gzip prefs fix, the login `?next=` and the offline data client; only `chassis` moved in `Cargo.lock`).
9. **The offline copy [feat-offline-kitchen-1..4], [refactor-rev-kit-1]** (nothing run on 02/11/2026): the new and changed
   unit tests `node --test scripts/offline-apply.test.mjs scripts/offline-keep.test.mjs scripts/offline-size.test.mjs
   scripts/offline-describe.test.mjs scripts/save-rev.test.mjs`, and `cargo test` (changed: `src/routes.rs` tests for the
   kit's 409 shape, `src/store/tests/rev.rs` on `Precondition`, new `if_match_star_saves_over_any_revision`).
10. **The offline release script** `KITCHEN_BASE=… KITCHEN_TOKEN=… node scripts/release/offline.e2e.mjs` (Firefox, a test
   Kitchen; it edits the pace and one dish's name and puts both back): cook mode reloaded offline with "Keep everything
   offline" on; only one recipe kept (prints SKIPPED until choice 1 is made); an offline edit shown after an offline reload,
   then replayed; a conflict on replay landing in the list of refused edits and "Keep the kitchen's version" emptying it;
   "Clear offline copy" then an offline reload showing the failed state; signing out with an unsent edit asking first
   (expected to FAIL until the logout kit gap is fixed). Then the Firefox smoke and `measure.mjs` on `/settings` (the new
   Calm row) at 1280 and 390, EN and NL, and the failed-list drawer at 390.

## Waiting on kp-themes or chassis-rs (workarounds kept; drop each when its fix ships)

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

1. **The per-recipe "Offline bewaren" toggle (held, feat-offline-kitchen).** Kenny chose a toggle per recipe when "Alles
   offline bewaren" is off. The kit keeps copies per URL and keeps every LIST route as soon as one item is kept ("a list is
   the way to a kept item"); Kitchen reads everything as one list answer, `GET /data/kitchen`, and has no item GET. So:
   - A. The toggle keeps the whole-kitchen copy (`/data/kitchen` stays the one route; the toggle marks the recipe and
     turns the copy on for it). No server change, cook mode works offline for every recipe, but the toggle then means
     "keep the kitchen" rather than "keep this recipe", and turning one recipe on keeps them all.
   - B. A server item route `GET /data/dishes/{id}` (a recipe lives in its dish) plus `/data/ingredients` and
     `/data/settings` as kept lists; the adapter builds a partial kitchen offline (only kept dishes); `/data/kitchen` is
     no kit route. Needs a kit option for "a list kept only when keep-all is on" (chassis-rs change), or with "all" on every
     dish must be fetched one by one to be kept.
   - C. Ask chassis-rs for an app hook that stores a derived copy (e.g. `keepDerived(path, data)`), so Kitchen saves a
     trimmed kitchen (the kept recipes' dishes, the ingredients, the settings) under its own key. Kit change; most
     precise, one more API in the kit.
2. **A freezer take without a connection (held).** "Take a portion" is `POST /data/freezer/{id}/take` (relative, never a
   conflict); the kit has no POST, so offline it now says "needs a connection".
   - A. Keep it online-only (as now).
   - B. Send it as `PUT /data/freezer/{id}` with the new absolute `portions` and the item's `rev`: queued and replayed like
     any edit, but two devices taking a portion offline then conflict (the second goes to the failed list).
   - C. Ask chassis-rs for a queued `post()` (non-idempotent, never rebased): Kitchen keeps the relative take; kit change.

Kit gaps found while building (chassis-rs cd68fd9, filed in kp-gaps/chassis-rs.md 02/11/2026; re-check against 4.3.0, whose CHANGELOG says logout with unsent edits asks):
- **Logout does not ask on Kitchen.** The sign-out button exists only on the kit's own pages (`layout.html`,
  `#chassis-logout`), which do not start `chassisData`, so the kit's "unsent edits" confirmation never runs there; Kitchen's
  pages have no sign-out of their own. Kitchen does not bypass the kit (no logout code in Kitchen). Fix in the kit (configure
  the data client's logout hook on its own pages from the app's name) or give Kitchen a sign-out form (a choice).
- **The kit's band toasts read their words once** (`bindBand` spreads `messages` at bind time): after a language switch
  they stay in the start language until the next load. The logout question follows (it reads them each time).
- **No `post()` in the client** (choice 2 above) and **no failed-list view** (Kitchen draws its own).

Not open (decided or moved): the side wheel's kicker 64.7 px lower than the dish wheel's on `/` and `/eten` at 1280 is
deliberate (Kenny, 30/10/2026 17:52, bottoms level; see `docs/DECISIONS.md`); "After 1.0: memory, sensory profile, low
typing" is parked in `docs/agent/PARKED.md`; Kitchen runs live, so the homelab-stack row is gone.
