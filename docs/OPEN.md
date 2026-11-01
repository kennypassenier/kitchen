# Open

2 items open: the deploy of 5.0.0, and adopting the kp-themes gantt fit-to-width mode.

| Item | Waits on |
|---|---|
| Deploy 5.0.0 (released and signed 31/10/2026, tag v5.0.0, release commit 208d3de; signature verified with `minisign -Vm SHA256SUMS`). Live is 4.1.0. Behind the home route `KITCHEN_TRUSTED_PROXIES` must include 10.10.10.4; the kit's own database moves to schema 2 on first start, so going back to 4.1.0 needs the backup taken before the update (CHANGELOG 5.0.0 Migration) | the homelab thread (Live view on CT 121) |
| Adopt the kp-themes gantt fit-to-width mode when it reaches chassis-rs (Kenny, 01/11/2026 "Passend maken"; built on kp-themes main, not released). The hook is `ganttFitAttrs` in `web/js/recipe/timeline-fit.js` (scripts/timeline-fit.test.mjs): add the kit's attribute to its "fit" branch, the one cook mode asks for; then check whether the lower rows in `web/css/pages/cook.css` (`--kp-gantt-row-sub`) and the running-bar packing gap in ~/Projects/kp-gaps/kitchen.md are still needed | a chassis-rs release that carries it |

Not open (decided or moved): the side wheel's kicker 64.7 px lower than the dish wheel's on `/` and `/eten` at 1280 is
deliberate (Kenny, 30/10/2026 17:52, bottoms level; see `docs/DECISIONS.md`); "After 1.0: memory, sensory profile, low
typing" is parked in `docs/agent/PARKED.md`; Kitchen runs live, so the homelab-stack row is gone.
