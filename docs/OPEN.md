# Open

4 items open: the deploy of 5.0.0, the four finished UX rounds that no release carries yet, and adopting the kp-themes gantt fit-to-width mode.

| Item | Waits on |
|---|---|
| Deploy 5.0.0 (released and signed 31/10/2026, tag v5.0.0, release commit 208d3de; signature verified with `minisign -Vm SHA256SUMS`). Live is 4.1.0. Behind the home route `KITCHEN_TRUSTED_PROXIES` must include 10.10.10.4; the kit's own database moves to schema 2 on first start, so going back to 4.1.0 needs the backup taken before the update (CHANGELOG 5.0.0 Migration) | the homelab thread (Live view on CT 121) |
| The four UX rounds of 01/11/2026 (bar and More menu, recipe page popovers, bad days, recipes row menu, delete with Undo, inline add rows, editor page, import field, cook stage, wheel filter menus; CHANGELOG [Unreleased]) are on main, checked on 01/11/2026 (full suite green, every page walked in Firefox at 1280 and 390 in English and Dutch with 0 console errors, measure clear but for the accepted side-wheel kicker); nothing is released or deployed | Kenny's release decision (a form with the open items) |
| Adopt the kp-themes gantt fit mode when it reaches chassis-rs (Kenny, 01/11/2026 "Passend maken"; `data-kp-gantt-scroll="fit"`, kp-themes main 6989f8cc6, not released). The attribute is already in: `ganttFitAttrs` in `web/js/recipe/timeline-fit.js` (scripts/timeline-fit.test.mjs) asks for "fit" from kp-themes `FIT_FROM` (12.2.0, assumed) and "off" before. What remains: the kit release through chassis-rs, then check `FIT_FROM` against the kp-themes CHANGELOG, re-measure cook mode at 390 px, and see whether the lower rows in `web/css/pages/cook.css` (`--kp-gantt-row-sub`) are still needed | a chassis-rs release that carries it |
| The next chassis-rs bump: the checklist below | the first chassis-rs on kp-themes >= 12.2.0 |

## Next chassis-rs bump (target: the first chassis-rs on kp-themes >= 12.2.0)

Only pin + sync + checks should remain:

1. Build the chassis CLI from the new tag.
2. Pin the tag in `Cargo.toml` and `.chassis.toml`; `chassis sync --write`; `cargo update -p chassis` only (nothing else moves).
3. Verify `FIT_FROM` in `web/js/recipe/timeline-fit.js` against the kp-themes 12.2.0 release notes (gantt fit mode and run packing,
   `data-kp-gantt-spare`); adjust `scripts/timeline-fit.test.mjs` if it moved.
4. Drop `--kp-gantt-row-sub: 1.625rem` in `web/css/pages/cook.css` if the cook rows look right with the kit's fit mode (390 px).
5. At 12.2.0 drop the `--kp-calendar-nav-fit: 26rem` workaround in `web/css/pages/baddays.css` and re-measure `/bad-days` in NL at
   390 px: kp-themes main e0aff5f7e (ships as 12.2.0) measures the calendar nav with the words it carries
   (`--kp-calendar-nav-measured`; the Dutch 340 px nav overflowed 42 px, now fits).
6. Re-check the chassis-rs gaps 23-25 workarounds against the new chassis (23 popover position: the `position: fixed` + flip in
   `web/js/ui/popover.js`; 24 labelled theme trigger: `web/js/pages/settings/theme-button.js`; 25 More set in the folding bar:
   `web/js/shell/plan.js`); see `~/Projects/kp-gaps/chassis-rs.md`. Two are fixed in kp-themes 12.2.0 (main 65baed252):
   - 23: `.kp-popover[popover]` is `position: fixed` with flip fallbacks, so drop Kitchen's `.app-popover` override
     (`web/js/ui/popover.js` and its CSS) and re-measure the Send to phone, Print options and More menus at 1280 and 390 px.
   - 24: `themeMenuMarkup({ trigger: 'label', current })` draws "Formal ▾" and keeps the name and accessible name current, so
     drop `web/js/pages/settings/theme-button.js` and re-measure the `/settings` theme button at 1280 and 390 px.
   - The new chassis-rs also advertises the maskable and monochrome icons already in `web/pwa/` (kit manifest); check
     `/manifest.webmanifest` lists them.
7. Re-check Kitchen's imports against the new bundle with `/tmp/claude-1000/-home-kenny-Projects/cf5bc211-3b73-5e5c-b494-895e05e608c8/scratchpad/kp-names.mjs`.
8. Then the release gate: the full suite (cargo test, node tests, check scripts), Firefox smoke at 1280 and 390 (EN and NL), measure-align and
   measure-gaps clear; only then the release decision.

Not open (decided or moved): the side wheel's kicker 64.7 px lower than the dish wheel's on `/` and `/eten` at 1280 is
deliberate (Kenny, 30/10/2026 17:52, bottoms level; see `docs/DECISIONS.md`); "After 1.0: memory, sensory profile, low
typing" is parked in `docs/agent/PARKED.md`; Kitchen runs live, so the homelab-stack row is gone.
