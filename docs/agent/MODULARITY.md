# Modularity audit and split plan (2026-10-30)

**Standing rule (Kenny, 30/10/2026).** Everything written from now on is as modular as possible and built to
software-development best practice, so it is easy to maintain and understand. Large files that hold several
components are not acceptable. Every new file and feature: one responsibility per file, aim at 400 lines or fewer and
20 KB or less, shared helpers in one shared module (never copied into a page), Rust unit tests in a sibling file once the
module passes the limit, long closures (`mount`, `openEditor`) split into named section functions or files. A change
that touches an over-limit file below should split that file first, in the order given here, instead of growing it.
Quoted rule (Dutch): "Ik verwacht dat als je code schrijft dat je alles zo modulair mogelijk doet ... Grote bestanden
met verschillende componenten in zijn dus uit den boze."

Audit only: no code was changed. Measured with `wc -l -c` over `src/**/*.rs`, `web/js/**`, `web/eten/**`, `web/css/**`,
`scripts/**`, `tests/**` (not `tests/fixtures/*.html`), `build.rs`; PNG icons excluded. **78 files, 20,309 lines, 920,990
bytes. 18 files are over 400 lines or 20 KB** (the 18 files hold 12,855 lines, 63% of all code).

## 1. Files over the limit

| File | Lines | KB | Of which inline tests | Responsibilities mixed |
|---|---:|---:|---:|---|
| src/store.rs | 1410 | 52.4 | 460 (l.951) | data model + collections, refusal type, CRUD/draft pruning, validation, migrations 1-5, seeding, tests |
| web/js/pages/baddays.js | 932 | 41.6 | - | page HTML template (l.50-270), date/text helpers, mini-recipe picker, freezer list, undo ring, focus-steps handoff, one 600-line `mount` |
| web/js/pages/wheel.js | 871 | 43.5 | - | label maps, date/time helpers, ingredient chips, filters + odds, spin/result, history, one 800-line `mount` |
| web/js/recipe/editor.js | 858 | 50.4 | - | form primitives (row, input, area, stepper, toggle, segmented, select, rows; l.54-191), id helper, a 660-line `openEditor` (details, ingredients, steps, schedule, photos), stamp helper |
| web/js/pages/cook.js | 844 | 34.9 | - | amount text, date helpers, card/section/actionRow builders, dial/timer, timeline, step focus, one `mount` |
| src/recipe_parse.rs | 796 | 27.9 | 256 (l.541) | text clean-up, JSON-LD extraction, DOM-step fallback, pasted-text parser, tests |
| web/js/i18n/nl-pages.js | 776 | 47.9 | - | ten pages' words in one map (wheel, timing, bad days, settings, recipes, recipe, photos, editor, cook, parents) |
| web/js/i18n/en-pages.js | 776 | 45.1 | - | same ten pages, English |
| web/js/pages/timing.js | 752 | 38.0 | - | time zone helpers, planning maths (`planFor`), card/section/button builders, one 600-line `mount` |
| web/js/records.js | 723 | 35.5 | - | date helpers, labels, list registry `LISTS`, drawer, form fields, record editors, safe-dish actions, delete + in-use, row actions, `tableCard` |
| web/js/i18n/kp-nl.js | 659 | 31.0 | - | the package's Dutch words for ~10 component families in one map |
| src/import.rs | 596 | 19.8 | 193 (l.404) | error type, SSRF address policy, redirect logic, fetch, image sniff, two handlers + router, tests |
| src/parents.rs | 574 | 20.7 | 170 (l.405) | file serving, router, language helpers, wheel JSON builder, IP allow-list, guard middleware, tests |
| web/js/i18n/en.js | 485 | 24.1 | - | words of records, item, dishes, sources, log, picker... in one map |
| web/js/i18n/nl.js | 483 | 25.8 | - | same, Dutch |
| web/js/pages/item.js | 469 | 23.9 | - | link helpers, facts list (l.60-188), dish recipes (189-264), used-by table (265-368), `mount` |
| web/css/pages/recipe.css | 447 | 8.7 | - | card, QR, print sheet, cooking log, photos in one file (4+ sections) |
| web/js/pages/recipe.js | 404 | 18.1 | - | step words, source row, card/section helpers, `mount` |

Next in line (under the limit, watch them): web/js/dishes/editor.js 315, web/js/api.js 310 (14 KB), web/eten/dishwheel.js
286 (14 KB), web/js/pages/settings.js 324, src/photos.rs 315 (51 test lines).

## 2. Split plan per file

Sizes are rough targets after the split. "Risk" is the chance of a behaviour change, not effort.

| File | New modules (what moves) | Size after | Risk |
|---|---|---|---|
| src/store.rs | `store/mod.rs` (Store, open, CRUD, drafts, settings: l.163-503, ~330); `store/data.rs` (Data, COLLECTIONS, FORMAT, Refused: l.31-162, ~150); `store/validate.rs` (both_names, recipe_source, source: l.515-633, ~120); `store/migrate.rs` (migrate, to_2..to_5, ingredient_id: l.634-938, ~310); `store/seed.rs` (seed, sources_seed, ~25); tests to `store/tests/{crud,validate,migrate}.rs` (~150 each) | largest ~330 | medium: data-critical migrations, private fns need `pub(super)`; behaviour moves verbatim and the existing tests pin it |
| src/recipe_parse.rs | `recipe_parse/mod.rs` (Imported, re-exports, ~60); `text.rs` (decode_entities, clean: l.56-128); `ld_json.rs` (blocks, find_recipe, iso_minutes, steps/image/portions, dom_steps, from_page: l.129-415, ~290); `pasted.rs` (Part, heading, strip_marker, from_text: l.416-540, ~125); `tests.rs` (256) | ~290 | low: pure functions, tests cover each part |
| src/import.rs | `import/mod.rs` (consts, router, handlers import/image: l.345-403, ~110); `import/fail.rs` (Fail + IntoResponse: l.59-110); `import/policy.rs` (allowed_v4/v6/ip, parse_url, next_hop, vet: l.111-233, ~125); `import/fetch.rs` (Fetched, fetch_inner, fetch, sniff_image: l.234-344, ~115); `import/tests.rs` (193) | ~125 | medium: SSRF guard; move verbatim, keep the tests as the gate |
| src/parents.rs | `parents/mod.rs` (Files, Public, router, english, page/file/dutch/serve: l.44-156, ~150); `parents/wheel.rs` (Lang, named, by_id, order, joined, wheel: l.157-297, ~145); `parents/guard.rs` (Allow, not_home, home_only, app_file, parents_guard: l.298-404, ~110); `parents/tests.rs` (170) | ~150 | low |
| web/js/records.js | `records/index.js` (re-export barrel so imports stay `./records.js`); `records/lists.js` (PLACES, LISTS, DETAIL_BASE, detailHref, itemLink, logWhat, sideName, dishHas, missingBadge: l.53-149, ~100); `records/drawer.js` (drawer, dateField, pair, choiceOf, openForm: l.151-253, ~110); `records/editors.js` (openRecordEditor l.254-462, ~210); `records/safe.js` (BLANK_RECIPE, recipe editor/import openers, safe picker, unmarkSafe, ateShelf: l.463-557, ~95); `records/delete.js` (loses, usersOf, inUse, deleteRecord, duplicates, rowActions: l.558-675, ~120); `records/table-card.js` (tableCard: l.676-723, ~50) | ~210 | medium: 8 pages import from it; the barrel keeps their import lines unchanged |
| web/js/recipe/editor.js | `ui/form-parts.js` (row, input, area, stepper, toggle, on, segmented, select, rows, textCell: l.48-191, ~150); `recipe/editor/index.js` (`openEditor` shell + save, ~150); `editor/details.js`, `editor/ingredients.js`, `editor/steps.js`, `editor/schedule-photos.js` (each ~120-160, extracted from the 660-line closure); `stamp` goes to `format.js` | ~160 | high: `openEditor` is one closure with shared local state (draft, dirty flag, validators) and there is no JS unit test; extract by passing a small `state` object |
| web/js/pages/baddays.js | `baddays/template.js` (sections(): l.50-270, ~220); `baddays/helpers.js` (firstSentence, lastMade, safeRecipes, miniRecipe, toFocusSteps: l.271-322, ~55); `baddays/index.js` (`mount` wiring, ~150); `baddays/mini-recipe.js`, `baddays/freezer.js`, `baddays/undo.js` (~120-170 each from `mount`) | ~220 | medium: `mount` closure state is shared; no tests; template is a pure string so low |
| web/js/pages/wheel.js | `wheel/labels.js` (l.39-46); `wheel/odds.js` (countOf, band, isKind, long-days weighting, ~120); `wheel/filters.js` (chips + tri-state, ~150); `wheel/spin.js` (spin + result card, ~170); `wheel/history.js` (~100); `wheel/index.js` (mount, ~150); dates to `format.js` | ~170 | high: 800-line `mount` closure, shared `state`, animation timing the demo fixes ("demo exact"); measure at 1280 and 390 after |
| web/js/pages/cook.js | `cook/steps.js` (amountOf, focus steps), `cook/timers.js` (dial, DIAL_MINUTES, snooze), `cook/timeline.js` (10 s ticker, clock), `cook/index.js` (mount); shared card/section/actionRow to `ui/cards.js` | ~200 each | high: timers and clocks hold live intervals that must be torn down together |
| web/js/pages/timing.js | `timing/plan.js` (ZONE, wall, at, hm, planFor, startsInWords, timedSteps: l.27-109, ~110, pure and node-testable); `timing/index.js` (mount); `timing/cards.js` (button/card/section: moves to shared `ui/cards.js`); `timing/digits.js` and `timing/snooze.js` out of `mount` | ~250 | medium: planning maths already pure (scripts/schedule.test.mjs pattern fits) |
| web/js/pages/item.js | `item/facts.js` (l.60-188, ~130); `item/dish-recipes.js` (l.189-264, ~80); `item/used-by.js` (l.265-368, ~105); `item/index.js` (links + mount, ~140) | ~140 | medium: three sections share the `pageEl` and kitchen subscription |
| web/js/pages/recipe.js | `recipe/page-parts.js` (STEP_WORDS, sourceRow, stage, dataOf, section: l.30-72, ~60, `section/stage` go to `ui/cards.js`); `mount` stays (~330) | ~340 | low |
| web/js/i18n/nl-pages.js, en-pages.js | per page, same layout in both languages: `i18n/nl/{wheel,timing,baddays,settings,recipes,recipe,editor,cook,parents}.js` and `i18n/en/...`; `nl-pages.js` / `en-pages.js` become spreads of these (~15 lines each). Section markers `// wheel` etc. already sit on l.5/129/248/354/419/442/460/577/670 | 40-120 each | low: plain data, spread order unchanged; a key-parity check (en vs nl) should guard it |
| web/js/i18n/en.js, nl.js | split by owning file as the existing comments already do (`// records.js`, `// pages/item.js`, `// pages/sources.js`...): `i18n/{en,nl}/{records,item,dishes,sources,log,wheel-extra}.js` | ~60-150 each | low |
| web/js/i18n/kp-nl.js | `i18n/kp-nl/{toggles-ago,forms,tables,overlays,wheel,calendar,steps}.js` + `index.js` merge; keep the `DEFAULT_STRINGS` import in index | ~100 each | low |
| web/css/pages/recipe.css | `recipe/{card,qr,print,log,photos}.css` matching sections 1-4 + Photos (l.22/241/286/330/367). First verify how the stylesheet is linked (app.css or page link); keep selector order | ~90 each | low (cascade order is the only trap) |

Rust test files: tests stay compiled only under `#[cfg(test)] mod tests;` pointing at a sibling `tests.rs`, so production
files shrink by 1079 lines in total without any behaviour change.

**Lines to move in the full plan: about 11,400** (Rust 2,600; JS pages and records 4,600; i18n 4,300; CSS 230;
minus overlap), spread over 18 files: **9 low, 6 medium, 3 high risk**.
Low: recipe_parse.rs, parents.rs, nl-pages.js, en-pages.js, kp-nl.js, en.js, nl.js, recipe.css, pages/recipe.js.
Medium: store.rs, import.rs, records.js, item.js, timing.js, baddays.js.
High: recipe/editor.js, pages/wheel.js, pages/cook.js.

## 3. Order (avoids rework)

1. **Shared helpers first** (new, small, no behaviour change): `web/js/format.js` (today, dmy, brusselsDay, pad, hhmm,
   stamp, cap/sentence, minutes text), `web/js/errors.js` or an export in `api.js` (`reason`), `web/js/ui/cards.js`
   (card, section, stage, actionRow, button), `web/js/ui/form-parts.js` (from recipe/editor.js l.48-191). Point the
   existing copies at them (section 4 lists each).
2. **i18n** (low, independent, large share of the lines): nl/en `-pages`, `en`/`nl`, `kp-nl`. Add the key-parity check.
3. **Rust tests out** (`tests.rs` siblings), then `parents/`, `recipe_parse/`, `import/`, and last `store/`.
4. **records.js** with a barrel so the eight importing pages stay untouched.
5. **recipe/editor.js** (needs step 1 form-parts), then `item.js`, `pages/recipe.js`.
6. **Pages with big `mount` closures**, lowest risk first: `timing.js`, `baddays.js`, then `cook.js`, `wheel.js` last
   (measure align/gaps at 1280 and 390 after each).
7. `recipe.css` split, with the page that owns it.

One commit per file split, so a regression bisects to one move.

## 4. Duplication (file:line)

| What | Where | Fix |
|---|---|---|
| `dmy` date formatter, 4 variants | web/js/records.js:32, web/js/pages/baddays.js:271, web/js/pages/wheel.js:50 (takes a Date), web/js/recipe/log.js:23 | one `format.js` pair: `dmy(iso)` and `dmyDate(date)` |
| "Today in Brussels" (`en-CA` + `Europe/Brussels`) | web/js/records.js:30, web/js/pages/cook.js:55, web/js/recipe/log.js:14, web/js/pages/baddays.js:595; ZONE separately at pages/timing.js:36; stamp formatting at recipe/editor.js:855 | `format.js` exports `ZONE`, `today()`, `brusselsDay()`, `stamp()` |
| `pad`/`hhmm`/`iso` | web/js/pages/wheel.js:48-51, web/js/pages/timing.js:35 | `format.js` |
| Capitalise first letter (`cap`, `sentence`, `sentenceCase`) | recipe/editor.js:48, pages/wheel.js:58, pages/cook.js:58, pages/timing.js:59 | `format.js` `cap` |
| Minutes to words ("1 h 5 min") | pages/wheel.js:57, pages/timing.js:57, recipe/amounts.js:46 (already shared, takes `words`) | reuse `amounts.minutesText` with the page's `t` key |
| Error to message (`reason`/`why`) | pages/baddays.js:280, records.js:42 (ApiError only), dishes/editor.js:94 | one `reason` in `api.js`, next to `ApiError` |
| Card/section builders | pages/timing.js:116-130 (`card`, `section`), pages/cook.js:63-90 (`actionRow`, `section`), pages/recipe.js:53-72 (`stage`, `section`), pages/settings.js:65-90 (`card`, `section`), pages/wheel.js:248 (`card`) | `ui/cards.js`; five copies of the same `kp-card` shell with loading state |
| Link/button builders | pages/cook.js:61 (`link`), pages/timing.js:111 (`button`) | `ui/cards.js` |
| `fetch` wrappers beside api.js | recipe/cover.js:26, recipe/photos.js:89 and :109 (own POST/DELETE with the same credentials and error mapping), main.js:141, recipe/sheet.js:21, eten/eten.js:32 | add `postRaw`/`del` helpers to api.js; the two recipe modules use them |
| Name helpers | records.js:44-46 (`dish`, `shelfItem`), item.js:31-43 (`ingLink`, `dishLink`), records.js:120 (`sideName`) alongside api.js `ingredientName` | gather name/link lookups in `records/lists.js` |
| `dishHas` aliased | records.js:132, item.js:51 (`const hasIt = dishHas`) | import under the real name |
| Table cards | one builder, `tableCard` (records.js:682), used by ingredients, dishes, log, sources, item: this is the model to copy | keep, move to `records/table-card.js` |
| i18n lookups | every page calls `t("page.key")`; label maps rebuilt per page (wheel.js:39-41 `mealLabels`/`bandLabels`/`kindLabels`, editor.js:33-34 `mealItems`/`prepItems`, records.js:37-39 `energies`/`feelings`) | meal/prep labels shared via `records/lists.js` |
| CSS repeated blocks | not measured in depth: pages/cook.css and pages/baddays.css are both 165 lines and share the card/heading pattern; check `rp-`, `bd-`, `ck-` prefixes for the same grid rules against `.kp-formgrid` before splitting | follow-up when css is split |

## 5. Boundaries that already work

- **Folders by feature** under web/js: `recipe/` (14 small single-purpose modules: amounts 52, cover 83, duplicate 53,
  import-lines 157, schedule 133, sequence 79, sheet 122, timeline 60), `dishes/`, `ingredients/`, `pages/`, `i18n/`.
  Copy this shape for the splits above.
- **`web/js/dom.js`, `links.js`, `api.js`** are small, shared, single-purpose and imported by name.
- **`tableCard`** (records.js:682) serves five pages with one config object: the right level of abstraction.
- **`i18n/index.js`** (111 lines) separates language switching from the word maps; the word maps are plain data.
- **Rust `routes.rs` (103), `main.rs` (148), `photos.rs` (315)** are one responsibility each; `chassis-rs` supplies the
  rest. Pure functions in `recipe_parse.rs` and the `import.rs` SSRF policy are already separable and tested.
- **`scripts/schedule.test.mjs`** shows the pattern for node tests of pure front-end logic; `timing/plan.js` fits it.
- **`web/eten/`** (parents' wheel) is a separate small bundle with its own `wheel.js` / `dishwheel.js`; no cross
  imports into `js/` except the one from item.js to `/eten/dishwheel.js`.

## 6. Progress (round 1, 30/10/2026)

| Split | Commit ID | Before → after (lines of the file that held it) |
|---|---|---|
| editor `settleFields` uses the same step set as `timesNow`/`paintTimeline` | `[app-seq-4]` | small fix, +7 -4 |
| shared helpers: `format.js` 40, `raw.js` 30, `ui/cards.js` 75, `ui/form-parts.js` 149, `reason` in `api.js` | `[refactor-helpers-1]` | recipe/editor.js 858 → 729; cook.js 844 → 816; timing.js 752 → 734; settings.js 324 → 318; recipe.js 404 → 389; records.js 723 → 716 |
| i18n: `en`, `nl`, `en-pages`, `nl-pages` into `i18n/{en,nl}/*.js` (18 parts each, 17-182 lines), `kp-nl` into `i18n/kp-nl/*.js` (11 parts) | `[refactor-i18n-1]` | en.js 485 → 24; nl.js 483 → 24; en-pages.js 776 → 24; nl-pages.js 776 → 24; kp-nl.js 659 → 37 |
| `parents.rs` → `parents/{mod,wheel,guard,tests}.rs` | `[refactor-rs-parents-1]` | 574 → 162 (mod) |
| `recipe_parse.rs` → `recipe_parse/{mod,text,ld_json,pasted,tests}.rs` | `[refactor-rs-recipe-parse-1]` | 796 → 295 (largest part) |
| `import.rs` → `import/{mod,fail,ssrf,fetch,tests}.rs` (SSRF guard in `ssrf.rs`) | `[refactor-rs-import-1]` | 596 → 128 (largest part) |
| `store.rs` → `store/{mod,data,validate,migrate,seed,ops,drafts}.rs` + `tests/{crud,validate,migrate}.rs` | `[refactor-rs-store-1]` | 1410 → 313 (migrate.rs, the largest part) |

Duplicates removed from section 4: dmy (4 definitions → `dmy` + `dmyDate`), today in Brussels (4), pad/hhmm/iso (4), capitalise (4),
minutes to words (2), reason/why (4 incl. the log refusal), stamp (moved), card/section/button/link/actionRow builders (7 definitions
in 4 pages), raw `fetch` with its own login redirect (2 modules, 3 redirects → 1), form primitives (moved). Not done yet: the
wheel.js `card` (an HTML-string builder with a badge), `main.js`/`sheet.js`/`eten.js` GET fetches (different shapes, not
wrappers), name/link helpers and `dishHas` alias (they belong to the `records/` split), and the CSS repeated blocks.
`reason` follows baddays' rule (`Error` → its message), so a non-ApiError in records, the dish editor and the log now shows the
bare message instead of `Error: message`.
