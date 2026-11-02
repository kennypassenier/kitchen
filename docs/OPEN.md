# Open

4 items open: the deploy of 5.0.0, the release of what is on main (now on chassis-rs 4.2.0), the kp-themes split delivery, and one choice for Kenny.
The chassis-rs 4.2.0 bump is done (02/11/2026, commits meta-chassis-420-1 to fix-cat-rename-stale-1); its checks wait for
the release (list below).

| Item | Waits on |
|---|---|
| Deploy 5.0.0 (released and signed 31/10/2026, tag v5.0.0, release commit 208d3de; signature verified with `minisign -Vm SHA256SUMS`). Live is 4.1.0. Behind the home route `KITCHEN_TRUSTED_PROXIES` must include 10.10.10.4; the kit's own database moves to schema 2 on first start, so going back to 4.1.0 needs the backup taken before the update (CHANGELOG 5.0.0 Migration) | the homelab thread (Live view on CT 121) |
| On main, not released: the four UX rounds of 01/11/2026 and the fixes of 02/11/2026 (CHANGELOG [Unreleased]), and since 02/11/2026 chassis-rs 4.2.0 with kp-themes 12.2.0 (gantt fit mode, dropped workarounds, the signed-out notice, More pages as kit secondary pages, the category rename's stale toast). Kitchen's kit database moves to schema 3 on first start, so a rollback to 5.0.0 needs a backup of `kitchen-kit.db` taken before the update (CHANGELOG [Unreleased] Migration) | Kenny's release decision (a form with the open items), then the release checks below |
| One choice (section "Choices for Kenny" below): offline data for cook mode | Kenny (a form) |
| kp-themes split delivery (Kenny 02/11/2026 17:24, "Nu overstappen"): built on branch `kp-split-entries` [feat-kp-split-1], not merged. The kit injects `/static/chassis/webapp-runtime.js` into every page of Kitchen's web app, and that runtime still imports the one-file bundle (chassis-rs 4.2.0 keeps it there on purpose, `BUNDLE_USERS`); with Kitchen on the per-module entries the main app's pages would hold two copies of kp's state. Concretely: the runtime points the bundle's remember store at the login's preferences (`kp-remember:` keys), so cook mode's place (`data-kp-remember` on focus-steps) would fall back to this browser only, and the kit's refresh control would no longer get Kitchen's Dutch words. `/eten` alone gets no runtime, but it shares `web/eten/dishwheel.js` with `/parents`, so it cannot move alone | chassis-rs: a split-delivery runtime (or a knob to pick it), then merge the branch and run its release checks |

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
7. **The split delivery [feat-kp-split-1]** (written 02/11/2026, nothing run; only after the branch is merged on a
   chassis-rs whose runtime is off the bundle): `node --test scripts/kp-entries.test.mjs` (new; finds the vendored
   `dist/js/` in the cargo checkout of the chassis revision in `Cargo.lock`, or `KP_DIST=<dir>`); the Firefox smoke of
   every page (`/`, `/recipes`, `/recipe`, `/recipe/edit`, `/cook`, `/timing`, `/bad-days`, `/settings`, `/log`,
   `/dishes`, `/ingredients`, `/sources`, `/parents`, an item page, `/eten`) at 1280 and 390, English and Dutch, with 0
   console errors, and in every theme picked from the menu (the register loads before the switch, no unstyled frame);
   a network check per page that no page loads `kp-themes.min.js`, `kp-themes.css` or `css/fonts.css` (the injected
   runtime included) and no kp module or chunk loads twice; cook mode's remembered place still follows the login to a
   second browser (the kit's preference store); the printable sheet still prints with its checklist boxes; `auto.js`
   and Kitchen's own `attachThemePickers` do not wire the theme menu twice (one change per pick); `measure.mjs` on the
   main pages (CSS order moved: base + register instead of the full sheet).

## Waiting on kp-themes or chassis-rs (workarounds kept; drop each when its fix ships)

- kp-themes split delivery: Kitchen's pages stay on the one-file bundle until the kit's injected runtime
  (`webapp-runtime.js`) moves off it; the move waits ready on branch `kp-split-entries` (table above).
- Lower cook-timeline rows (`--kp-gantt-row-sub: 1.625rem`, `web/css/pages/cook.css`): still needed with 12.2.0 (lanes 86/112 px with, 128/168 without).
- Lazy fold autosize (`web/js/ui/fold-autosize.js`) and the debounced timeline repaint (`web/js/recipe/editor/paint-timing.js`):
  still help on the 60-line/40-step recipe (open 2.9 s vs 8.2 s; 155 vs 350 ms a key).
- `box-sizing: border-box` on the popover panel (`web/css/app.css`): `.kp-popover--panel` caps content-box (kp-gaps/kitchen.md).
- Renaming the settings row's labelled theme trigger after a pick in the header's menu (`nameTrigger`, `web/js/pages/settings/calm-theme.js`; kp-gaps/kitchen.md).
- The signed-out notice opens the login in a new tab because the kit's login reads no `next` (kp-gaps/chassis-rs.md).
- The More item of the bar is built by hand (no `data-kp-nav-more` in kp-themes yet); the in-use reason-tooltip workaround
  (`web/js/records/in-use.js`) until kp-themes ships its card-layout tooltip fix.

## Choices for Kenny (not built)

1. **Cook mode offline.** chassis-rs 4.2.0's worker no longer keeps `/data/*`; an open cook page keeps working offline,
   but a reload while offline shows its failed states, where 5.0.0 showed a stale copy. Options: (a) leave it (the kit's
   choice: never a stale kitchen); (b) Kitchen keeps the recipe being cooked in sessionStorage when cook mode opens, so a
   reload offline shows that one recipe; (c) keep the whole kitchen in IndexedDB for offline reading. Recommendation: (b),
   small and limited to the screen that is used in the kitchen.


Not open (decided or moved): the side wheel's kicker 64.7 px lower than the dish wheel's on `/` and `/eten` at 1280 is
deliberate (Kenny, 30/10/2026 17:52, bottoms level; see `docs/DECISIONS.md`); "After 1.0: memory, sensory profile, low
typing" is parked in `docs/agent/PARKED.md`; Kitchen runs live, so the homelab-stack row is gone.
