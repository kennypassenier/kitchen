# Decisions

Every decision Kenny made, newest first. Each line says what and when.

| When | Decision |
|---|---|
| 22/10/2026 | A parents' page: a wheel of only the dinners marked for Kenny's parents; a dish with sides spins a second, smaller wheel for the side, a dish without sides shows none. Kenny's PC (10.10.10.10) is let in as the admin without a login |
| 19/10/2026 22:25 | kp-themes comes only through chassis-rs: the pages load it from the kit's `/static/kp/`, never from a copy of their own; a missing piece waits for a chassis-rs release |
| 19/10/2026 09:22 | No more demos of approved components: build the real app; every kp-themes component with its standard loading, empty and failed states, loading in the theme's own animation |
| 19/10/2026 05:11, 06:43 | Every view is a CSS grid; forms, settings, fact lists and button groups on `.kp-formgrid`, aligned vertically |
| 19/10/2026 02:38–06:43 | All five screen designs approved (kp-themes `research/audhd-recepten/`); the wheel's slices are all equal by default; the start disc is a 60-minute dial |
| 19/10/2026 01:38 | Release 0.1 = wheel, guided cooking with parallel tracks, backward timing, bad days, calm. After 0.1: memory, sensory profile (plus a parents' page with only the wheel), low typing. Name: at least ten new suggestions |
| 15/10/2026 | Its own homelab stack on a kp-soft.dev subdomain; the stack of the homelab admin dashboard (Rust on chassis-rs, plain ES modules, kp-themes); health as bands, numbers opt-in, calories never by default; shopping lists, sharing and prices later |
| 14/10/2026 | The project starts, as part of Life |

Technical choices made while building (Claude, 19/10/2026, reversible):
one plain JSON file as the store (small data, readable backup); the
pages own the recipe shape (`docs/agent/DATA.md`).

The app is called Kitchen (Kenny, name form, 19/10/2026): crate and
binary `kitchen`, env prefix `KITCHEN_`, unit `kitchen.service`, state
file `kitchen.json`, repository `kennypassenier/kitchen`.
