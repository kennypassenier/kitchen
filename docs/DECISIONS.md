# Decisions

Every decision Kenny made, newest first. Each line says what and when.

| When | Decision |
|---|---|
| 22/10/2026 21:45 | Dishes get their own page with Add, Edit and Delete: a Dutch and an English name (a dish with only one shows on neither wheel), a category (everyday, special, …, a list of its own) and parts from an open list of kinds (potatoes and co., vegetables, sauce, …) with their choices. The parents' wheel is in Dutch on eten.kp-soft.dev without an account; Kitchen itself on kitchen.kp-soft.dev. Claude's choices: two or more choices in a part are picked by the small wheel one part after the other, one choice is how the dish always comes; the categories narrow the parents' wheel; Kitchen keeps the same wheel in English at /parents |
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
