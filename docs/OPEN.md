# Open

3 items open: the deploy of 5.0.0, the four finished UX rounds that no release carries yet, and adopting the kp-themes gantt fit-to-width mode.

| Item | Waits on |
|---|---|
| Deploy 5.0.0 (released and signed 31/10/2026, tag v5.0.0, release commit 208d3de; signature verified with `minisign -Vm SHA256SUMS`). Live is 4.1.0. Behind the home route `KITCHEN_TRUSTED_PROXIES` must include 10.10.10.4; the kit's own database moves to schema 2 on first start, so going back to 4.1.0 needs the backup taken before the update (CHANGELOG 5.0.0 Migration) | the homelab thread (Live view on CT 121) |
| The four UX rounds of 01/11/2026 (bar and More menu, recipe page popovers, bad days, recipes row menu, delete with Undo, inline add rows, editor page, import field, cook stage, wheel filter menus; CHANGELOG [Unreleased]) are on main, checked on 01/11/2026 (full suite green, every page walked in Firefox at 1280 and 390 in English and Dutch with 0 console errors, measure clear but for the accepted side-wheel kicker); nothing is released or deployed | Kenny's release decision (a form with the open items) |
| Adopt the kp-themes gantt fit mode when it reaches chassis-rs (Kenny, 01/11/2026 "Passend maken"; `data-kp-gantt-scroll="fit"`, kp-themes main 6989f8cc6, not released). The attribute is already in: `ganttFitAttrs` in `web/js/recipe/timeline-fit.js` (scripts/timeline-fit.test.mjs) asks for "fit" from kp-themes `FIT_FROM` (12.2.0, assumed) and "off" before. What remains: the kit release through chassis-rs, then check `FIT_FROM` against the kp-themes CHANGELOG, re-measure cook mode at 390 px, and see whether the lower rows in `web/css/pages/cook.css` (`--kp-gantt-row-sub`) are still needed | a chassis-rs release that carries it |

Not open (decided or moved): the side wheel's kicker 64.7 px lower than the dish wheel's on `/` and `/eten` at 1280 is
deliberate (Kenny, 30/10/2026 17:52, bottoms level; see `docs/DECISIONS.md`); "After 1.0: memory, sensory profile, low
typing" is parked in `docs/agent/PARKED.md`; Kitchen runs live, so the homelab-stack row is gone.
