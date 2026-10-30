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

### Round 2 (30/10/2026)

| Split | Commit ID | Before → after (lines) |
|---|---|---|
| `records.js` → `records/{index,lists,drawer,editors,safe,delete,table-card}.js`; name/link helpers and `dishHas` live in `lists.js`, pages import `records/index.js` | `[refactor-records-1]` | 716 → 227 (editors.js, the largest part) |
| `pages/item.js` → `pages/item/{index,facts,dish-recipes,used-by,links}.js`; the `hasIt` alias is gone | `[refactor-item-1]` | 470 → 144 (facts.js) |
| editor pure logic (`recipe/editor/logic.js`: step row to step, liveRows, the two times, label, dish name, recipe body and draft) + `scripts/editor.test.mjs` (19 cases, written, not run) | `[test-editor-1]` | +125 logic, +157 test |
| `recipe/editor.js` → `recipe/editor/{index,details,times,lists,steps,step-row,timeline,draft,save,wiring,consts,controls,ids,logic}.js` | `[refactor-editor-1]` | 729 → 148 (index.js); step-row.js 147 |
| `pages/recipe.js`: step words, source row, step photos → `recipe/page-parts.js` | `[refactor-recipe-1]` | 389 → 352 |
| `pages/timing.js` → `pages/timing/{index,plan,text,frame,sentence,plan-view,timer,nudge,fill}.js`; `plan.js` is pure (schedule.test.mjs pattern fits) | `[refactor-timing-1]` | 734 → 142 (fill.js) |
| `pages/baddays.js` → `pages/baddays/{index,template,helpers,safe,freezer,freezer-form,shelf,mini-recipe,month}.js` | `[refactor-baddays-1]` | 927 → 223 (template.js) |

Duplicates removed from section 4: dmy (4 definitions → `dmy` + `dmyDate`), today in Brussels (4), pad/hhmm/iso (4), capitalise (4),
minutes to words (2), reason/why (4 incl. the log refusal), stamp (moved), card/section/button/link/actionRow builders (7 definitions
in 4 pages), raw `fetch` with its own login redirect (2 modules, 3 redirects → 1), form primitives (moved). Not done yet: the
wheel.js `card` (an HTML-string builder with a badge), `main.js`/`sheet.js`/`eten.js` GET fetches (different shapes, not
wrappers), name/link helpers and `dishHas` alias (they belong to the `records/` split), and the CSS repeated blocks.
`reason` follows baddays' rule (`Error` → its message), so a non-ApiError in records, the dish editor and the log now shows the
bare message instead of `Error: message`.

### Round 3 (30/10/2026)

| Split | Commit ID | Before → after (lines) |
|---|---|---|
| `minutesWords` moved to `i18n/minutes.js`, so `format.js` loads in node | `[refactor-format-1]` | format.js 41 → 36 |
| cook mode's pure logic (`pages/cook/logic.js`: steps shown, focus steps, where a timer leads, real marks, fixed start offsets and planned waits, the plan from the real clock) + `scripts/cook.test.mjs` (22 cases) | `[test-cook-1]` | cook.js 816 → 721; +148 logic, +181 test |
| `pages/cook.js` → `pages/cook/{index,parts,memo,stage,begin,calm,done,timers,timeline,states,mise,fill,load,logic}.js`; every live thing in `ctx.cleanups` | `[refactor-cook-1]` | 721 → 148 (logic.js, the largest); index.js 128 |
| wheel's pure logic (`pages/wheel/logic.js`: fits, odds, constraints, loosening, resting/freezer/days rules, chips, start plan, dates) + `scripts/wheel.test.mjs` (29 cases) | `[test-wheel-1]` | wheel.js 867 → 725; +252 logic, +237 test |
| `pages/wheel.js` → `pages/wheel/{index,model,labels,template,filters,easy,actions,answer,answer-html,card-sync,wheel-view,list-view,logic}.js`; `/` renders the identical DOM; check-wheels 0 | `[refactor-wheel-1]` | 725 → 252 (logic.js, the largest); index.js 132 |
| `css/pages/recipe.css` → `css/pages/recipe/{base,card,qr,print,log,photos}.css`, six link tags in index.html in file order; computed styles identical at 1280/390, formal/dark and print | `[refactor-css-1]` | 447 → 219 (card.css) |
| fix found by the browser check: `stepEditor`'s chip array shadowed the rows accessor (`list`), so the recipe editor opened without steps since `[refactor-editor-1]` | `[fix-editor-1]` | 10 lines |
| `openRecordEditor` (208 lines) → `records/editors{,-stock,-log,-names}.js`; `stepEditor` (129) → five helpers | `[refactor-fns-1]` | editors.js 227 → 40 |
| `nudgeItems`, timing `fill`, `renderSafe`, shelf and mini draws, cook `buildCookSection`, wheel view → named helpers; stale `pages/item.js` / `records.js` comments | `[refactor-fns-2]` | see commit |

Tests (30/10/2026, run once at the end): `node --test scripts/*.test.mjs` 85 cases, all pass, 0.11 s; `cargo test` 49 tests, all pass, 22 s.
Browser smoke (Firefox, throwaway kitchen): every touched page loads with 0 console and page errors; wheel (bring back, spin, set aside,
filters, no energy), recipe editor (add, edit, draft restore, import preview from pasted text), cook flow, timing, bad days (freezer add and
take, shelf, mini, calendar) are clean. A real pointer drag on the editor timeline lengthens the step before the meeting step by 5 min:
meeting start 27 → 32 min, total 32 → 37 min, at 1280 and at 390.

### Final numbers (after round 3; superseded by round 4 below)

| | Before the audit | After |
|---|---:|---:|
| Source files measured (src/**/*.rs, web/js, web/eten, web/css, scripts, tests excl. fixtures html, build.rs) | 78 | 228 |
| Lines / bytes | 20,309 / 920,990 | 22,694 / 1,040,438 (the tests and doc comments added) |
| Files over 400 lines or 20 KB | 18 | **0** (largest: wheel.css 366, recipe.js 352 lines; 17 KB largest by bytes: settings.js) |
| Files over 250 lines | n/a | 13 (see below) |
| Lines relocated (`git diff --shortstat 19feab2..HEAD`) | | 12,562 removed from their old place, 15,058 added (incl. new tests) in 200 files |
| Commits from 84ba542 (exclusive) to the end of round 3 | | 24 |

Files still over 250 lines: wheel.css 366, pages/recipe.js 352, recipes.css 331, pages/settings.js 318, src/photos.rs 315 (51 test lines), api.js 314,
store/migrate.rs 313, dishes/editor.js 312, recipe_parse/ld_json.rs 295, eten/dishwheel.js 286 (the one wheel component, "demo exact"),
recipe_parse/tests.rs 262, wheel/logic.js 252, eten/wheel.js 251. All are one responsibility each and under the 400/20 KB limit.

Remaining exceptions (not done, each by design or out of scope):
- Functions over ~40 lines: the factories `createFiller`, `createNudge`, `createSentence`, `createTimer`, `createFreezer`, `wireFreezerForm`,
  `createShelf`, `createMini`, `createMonth`, `createSafe` hold named inner helpers that each fit the limit but the factory as a whole does not;
  pages never touched by a round (`pages/recipe.js` mount 316, `settings.js` mount 250, `recipe/log.js` createLog 209, `recipes.js` 164, `dishes.js` 132,
  `ingredients.js` 114, `ingredients/picker.js` 132, `dishes/picker.js` 126, `recipe/import.js` 108, `photos.js`, `dishes/editor.js`) are still single closures.
- The measure tool reports state-footprint faults on the wheel page (card empty/failed shorter than the loaded footprint) and one side-wheel
  alignment fault; identical before the refactor (kp footprint helper / `web/eten/dishwheel.js`, not touched here).
- Some round 2 splits (editor, records, baddays, timing) had never run in a browser before round 3 (see `[fix-editor-1]`).

### Round 4 (30/10/2026)

Measured first (the same command for before and after: tracked `src/`, `web/`, `scripts/`, `tests/` (not fixtures), `build.rs`; `.rs .js .mjs .css .sh`; functions by brace count, JS also in `web/eten` and `scripts`, nested closures included): **13 files over 250 lines, 53 JS functions over 40 lines (51 in web/js, 2 in web/eten), 18 Rust functions over 40 (12 outside tests)**.

| Split | Commit ID | Before -> after |
|---|---|---|
| wheel card states: `--kp-footprint-max: 22rem` on `.dw-card` | `[fix-wheel-1]` | 3 lines; wheel measure faults 5 -> 1 at 1280 and 2 -> 0 at 390 (see "Wheel measure faults") |
| `css/pages/wheel.css` 366, `recipes.css` 331 -> `wheel/{base,filters,extras}.css`, `recipes/{form,steps,import}.css` | `[refactor-css-2]` | largest 174 / 163 |
| `src/photos.rs` 315 -> `photos/{mod,check,tests}.rs` | `[refactor-rs-photos-1]` | 163 |
| `store/migrate.rs` 313 -> `migrate/{mod,to_2,to_3,to_4}.rs`, each migration in named steps (to_4 was 90 lines) | `[refactor-rs-migrate-1]` | 133 |
| Rust fns: `fetch_inner` 85, `wheel` 68, `both_names` 62, `from_page` 61, `create` 60, `from_text` 55, `iso_minutes` 48, `decode_entities` 45, `main` 112 | `[refactor-rs-fns-1..4]`, `[refactor-rs-ld-json-1]`, `[refactor-rs-main-1]` | `ld_json.rs` 295 -> 150 + `fields.rs` 169 |
| `recipe_parse/tests.rs` 263 -> `tests/{page,fields,paste}.rs` | `[refactor-rs-parse-tests-1]` | 164 |
| `api.js` 314 -> 249 + `api/http.js` + `api/recipe-view.js` | `[refactor-api-1]` | 249 |
| `pages/recipe.js` (mount 316) -> `pages/recipe/{index,frame,card,ingredients,share-sheet}.js`; later `show` / `createLoader` | `[refactor-recipe-2]`, `[refactor-recipe-3]`, `[refactor-fns-9]`, `[refactor-fns-11]` | largest 141 |
| `pages/settings.js` (mount 250) -> `pages/settings/{index,frame,parts,consts,calm-theme,rows,save}.js` | `[refactor-settings-1]`, `[refactor-fns-10]` | largest 89 |
| `recipe/log.js` (createLog 209) -> `recipe/log/{index,frame,paint,actions,dates}.js` | `[refactor-log-1]` | largest 86 |
| `pages/recipes.js` (mount 164) -> `pages/recipes/{index,template,rows}.js` | `[refactor-recipes-1]`, `[refactor-recipes-2]` | 111 |
| dishes, ingredients, sources, log pages share `records/table-page.js` (page head + table life cycle) | `[refactor-tables-1]` | mounts 132/114/88/81 -> 12-25 lines |
| timing factories (`createFiller` 144, `createSentence` 119, `createTimer` 107, `createNudge` 65, `buildFrame` 68, `createPlanView` 53) and mount 65 -> module-level functions over a parts object | `[refactor-timing-2]`, `[refactor-timing-3]` | all under 40 |
| bad-days factories (`createFreezer` 121, `wireFreezerForm` 107, `createMini` 77, `createMonth` 70, `createShelf` 53, mount 81) | `[refactor-baddays-2]` | all under 42 |
| item page (`facts` 123, `usedBy` 99, `dishRecipes` 70, mount 100) | `[refactor-item-2]`, `[refactor-item-3]` | all under 47 |
| ingredient and dish pickers (132, 126) | `[refactor-pickers-1]` | `buildBox`, `buildAsks`, `fill`, `extendCombobox`, ... |
| `recipe/import.js` `openImport` 108 | `[refactor-import-1]` | named steps |
| recipe editor (`openEditor` 108, `stepFields` 100, `listFields` 70, `timelineFields` 61, `timeFields` 47) | `[refactor-editor-2]` | all under 42 |
| `recipe/photos.js` (photoField 84, shrink 43) -> `photo-files.js` + `photos.js` | `[refactor-photos-1]` | 130 / 134 |
| `dishes/editor.js` 312 -> `editor` + `names` + `drawer` + `sides` | `[refactor-dishes-ed-1]` | 183 |
| `createSheet` 68, `rows` 56, `deleteRecord` 52, `schedule.layout` 46, `createDiscs` 46, wheel `mount` 43 | `[refactor-fns-3..8]` | under 40 |
| `web/eten/dishwheel.js` 286 -> `dishwheel.js` + `dishwheel-fit.js` (`scripts/check-wheels.mjs` names both as the one component); `mountDishWheel` 132 | `[refactor-dishwheel-1]` | 209 / 117 |
| `web/eten/wheel.js` 251 -> `wheel.js` + `words.js`; `mountWheel` 157 | `[refactor-eten-1]` | 206 / 53 |
| `pages/wheel/logic.js` 252 -> `logic.js` + `constraints.js` | `[refactor-wheel-2]` | 165 / 96 |
| week arithmetic of the log is pure: `scripts/log.test.mjs` (5 cases) | `[test-log-1]` | +45 |
| **bug found while splitting `createLog`**: `paint()` declared `const today = today()` (temporal dead zone) since `[refactor-helpers-1]`, so a recipe with log lines, or the log's Start button, threw and the recipe page showed its error card | `[fix-log-1]` | 8 lines |

Wheel measure faults (`node scripts/measure.mjs / formal,dark 1280,390`, before the round: 1 alignment fault + 4 state faults at 1280, 2 state faults at 390, in both themes):
- **State faults (wl-card, wl-fits "card empty / failed shorter than the loaded footprint"): ours, fixed.** `.dw-card` hides the wheels while a plate shows (`.dw-card:not([data-kp-state="ready"]) .kp-card__data { display: none }` in `web/eten/dishwheel.css`, Kenny 24/10/2026 09:32: "the empty card was far too tall"), so the plate (356 / 404 px) is shorter than the loaded wheel card (715 / 428 / 760 px) on purpose. kp's state measure (`measure-states.mjs`, the `readyH` check around l.833) honours `--kp-footprint-max` as the cap on the footprint a component holds, so the card now declares the cap it really keeps (22rem). The look is unchanged. `[fix-wheel-1]`.
- **Alignment fault (1 at 1280: the side wheel's column starts 64.7 px off the big wheel's column): by Kenny's rule, left as is.** `.dw__wheels { align-items: end }` puts both wheel bottoms on one line (Kenny 24/10/2026 10:27); the side wheel is 20rem against 24rem, so its kicker "The side" sits 4rem (64 px) below the kicker "Tonight's wheel". `measure-align.mjs` section F (l.725-780) compares the first text lines of side-by-side columns and offers no way to declare this. Making both kickers share a top row would change the approved look (the kicker leaves its wheel), so it needs Kenny's word. Not a kp gap, and not edited in kp.

Final numbers (after round 4, same filter as before):

| | Before round 4 | After |
|---|---:|---:|
| Source files (src, web, scripts, tests, build.rs; .rs .js .mjs .css .sh) | 222 | 262 |
| Lines / bytes | 22,575 | 23,633 / 1,084,700 |
| Files over 250 lines | 13 | **0** (largest: `api.js` 249, `scripts/wheel.test.mjs` 238, `baddays/template.js` 223) |
| JS functions over 40 lines | 53 | **6** (41-42 lines) |
| Rust functions over 40 lines | 18 (12 outside tests) | 10 (4 outside tests) |
| Commits | | 44 (`b4bc69e..HEAD`) |

Tests (once, at the end): `node --test scripts/*.test.mjs` 90 cases in 6 files (cook 22, editor 19, log 5, meet 4, schedule 11, wheel 29), all pass, 0.10 s; `check-words`, `check-forms`, `check-wheels` clean, 0.12 s together; `cargo test` 49 tests, all pass, 28 s including the build.

Browser (Firefox, fresh build, throwaway seeded data dir, once at the end): the smoke over `/`, wheel spin / filters / easy switch, `/recipes` (editor add, edit with 5 step rows, draft restore with `draft.mjs`, import preview from pasted text), `/recipe`, `/cook`, `/timing`, `/bad-days` (freezer add + take, shelf, mini, calendar), `/dishes/<id>`, `/dishes`, `/ingredients/<id>`, `/ingredients`, `/sources`, `/settings`, `/log`, `/eten`: **0 console and page errors**. The real pointer drag on the editor timeline (preceding step +5 min): at 1280 and at 390 the simmer step 15 -> 20 min, the meeting step starts 27 -> 32 min, the total 32 -> 37 min. `node scripts/measure.mjs <page> formal,dark 1280,390` on `/`, `/recipes`, `/recipe?id=r1`, `/cook?id=r1`, `/timing?id=r1`, `/bad-days`, `/settings`, `/log`: **clear everywhere except one finding on `/` at 1280 in both themes (the side-wheel alignment, above)**; the state faults on the wheel page are gone.

Remaining exceptions (by design or too small to be worth a split):
- Functions of 41-42 lines (the count includes the closing brace and comment lines): `tableCard` (records/table-card.js, one config-to-DOM builder, 42), `openDrawer` (dishes/drawer.js, 41), `createMini` (baddays/mini-recipe.js, 41), recipes `mount` (41), `stepEditor` (recipe/editor/step-row.js, 41), `mountTables` (records/table-page.js, 41).
- Rust: `main` (76 lines, the start-up sequence with early `ExitCode::FAILURE` returns that cannot be hidden in helpers without changing the control flow), `from_text` (47, one pass over the lines), `fetch_inner` (43, the redirect loop of the SSRF-guarded fetch), `wheel_dish` (41); six long tests whose length is their fixture data.
- Alignment fault on the side wheel (above): Kenny's "bottoms on one line" rule against measure-align's first-line rule; waiting for his word.
- The `createImageBitmap` fallback in `recipe/photo-files.js` loads a `blob:` image that Firefox's CSP (`img-src`) blocks, so decoding a picture the first path cannot read logs a console error. Found, not changed (behaviour identical to before the round).
