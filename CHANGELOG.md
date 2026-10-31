# Changelog

All notable changes to kitchen. Semantic versioning: a breaking change
in the API, the configuration knobs or the on-disk state is a major, and
carries a **Migration** section saying what an operator must do.

## [Unreleased]

## [5.0.0] - 2026-10-31

Everything since 4.1.0, released together as 5.0.0 (Kenny, 31/10/2026).

### Added
- **Import a recipe from a website** (Recipes page and a dish's Recipes card): a web address or pasted text becomes an
  unsaved draft in the recipe editor. Kitchen reads the page's recipe data (JSON-LD), splits amounts, units and names,
  matches ingredients to the catalogue, proposes step minutes from the text and asks "Use this photo as the cover?"
  before any picture is fetched. A remark in brackets or after a comma in an ingredient line becomes that line's note.
  An ingredient the catalogue does not know is never dropped: the editor lists it and Save waits until each one is
  added as a new ingredient or discarded. The fetch refuses private, loopback and link-local destinations, pins the
  checked address, follows at most 3 redirects and stops at 10 s and 2 MB (`docs/agent/DATA.md`). Dagelijkse Kost pages
  read all their steps (the site lists only two in its recipe data, so the page's own list is used).
- **Recipe sources** (`/sources`, "Receptbronnen"): the websites whose recipes import well, as your own list with Add,
  Edit, Delete, search, a language filter and a page per source. Site links open in a new tab; "Import from this site"
  opens the import drawer. A new kitchen, and a file from before the list, starts with six sites proven by one real
  import each: Dagelijkse Kost, 24Kitchen, Leuke recepten, BBC Good Food, Simply Recipes and RecipeTin Eats.
- A recipe keeps the address it was imported from (`source`): a link on the recipe page, editable in the editor.
- **Draggable timeline in the recipe editor**: the steps as clips on one lane per track, like a video editor. Drag a
  step to move it, drag it to another track to run it at the same time, drag its edge to change how long it takes;
  keyboard, zoom and a sideways scroll serve a phone. The step list and the timeline stay in step both ways. A step in
  the "Where the tracks meet" lane moves along by itself when a step before it gets longer or moves, so it never
  overlaps one; a step dragged later keeps its later start.
- **Computed recipe times**: steps get an optional `start` and `with` (runs alongside another step); the total and the
  hands-on time are counted from the steps, with an Override switch. Timing and cook mode use the same calculation.
- **Quick-add steps**: one field, Enter adds the step and is ready for the next; each step is one line with its chips,
  a "More" fold for the rest, Alt+Up / Alt+Down to reorder, and a camera button with the step's photo strip under it.
- **The dish in the recipe editor**: the first field picks the dish (or makes a new one with both names); choosing
  another dish moves the recipe there.
- **Drafts**: the recipe editor saves a draft about 1 s after each change and offers it again when it reopens.
  Drafts older than 7 days are dropped at start (the log says how many), and a discarded or expired draft takes the
  photos only it uses with it.
- **Duplicate** a dish or a recipe: an editable copy with new ids, opened in its editor; nothing is made until Save.
- **Cook it** (the wheel, a dish, a recipe, bad days) starts cook mode at step 1; a badge says when the screen stays on.
  Cook mode honours a step's fixed start and shows it as a planned wait.
- **Step texts and notes in two languages, the second one optional** (Kenny, 30/10/2026, "Optioneel"): a clearly
  labelled field for the other language; without a translation Kitchen shows the one text it has in both languages.
- **Theme picker on the parents' page** (eten.kp-soft.dev), top right, in Dutch, kept in that browser and applied
  before the first paint.

### Changed
- chassis 4.0.0 with kp-themes 12.0.0: kp-themes now loads as one bundle (`/static/kp/dist/kp-themes.min.js`) instead of
  a tree of module files, so a page makes far fewer requests (the kit measured 451 requests and 2076 KB cold on the
  front page before, 155 and 1831 KB after) and static files are served gzip. Kitchen's own scripts import only that
  bundle.
- Kitchen's home page is now installable as an app (manifest, offline page and a service worker that never serves a
  stale page, icons in `web/pwa/`); the parents' page keeps its own manifest and icons. Notifications to kyu would
  need a token (not used here).
- tokio 1.54.1 (RUSTSEC-2026-0386). Kitchen's own workarounds that kp-themes
  11.3.0 made redundant are gone; the wheel's names read upright on its left half.
- **The code is split into small single-purpose modules** (Kenny's standing rule of 30/10/2026): no source file over
  250 lines (18 files were over 400), shared helpers instead of copies, and tests for the editor, cook mode, the wheel,
  the timeline, the schedule, the log and the two-language texts (`docs/agent/MODULARITY.md`). No behaviour changes.
- `scripts/check-forms.mjs` runs with the word and wheel checks at every commit.

### Fixed
- Photo upload: when the browser cannot decode a picture directly, the fallback reads it through a data: URL, which the
  Content-Security-Policy allows (it is unchanged).
- The step and recipe photo galleries and the wheel card keep their size while loading, empty or failed.
- Counting back from dinner no longer pulls a track earlier for a step that runs alongside.
- The dish picker keeps a new dish through blur and a restored draft; a new recipe starts with computed times.
- On a phone, step buttons wrap cleanly and photo tiles have one size.

### Migration
- None by hand. The store format stays 5: the new `recipe_sources` and `drafts` lists and the new step and recipe
  fields are optional, so a 4.1.0 file opens unchanged and gets the six sources on first start. Going back to 4.1.0
  needs the backup taken before the update (4.1.0 does not know the new lists and two-language step texts).
- 5.0.0 is a major because it moves to the next chassis-rs major (chassis 4.0.0). What an operator does:
  - Behind the home route (Traefik), add Traefik's address to `KITCHEN_TRUSTED_PROXIES` (10.10.10.4), so
    `KITCHEN_TRUSTED_ADMINS` also works on the hostname.
  - `KITCHEN_NOTIFY_TOKEN` is needed only when `KITCHEN_NOTIFY_URL` points at a kyu topic. Kitchen sets neither, so
    nothing to do.
  - No other knob, environment variable or on-disk change: the store format stays 5. The kit's own file moves to
    schema 2 on first start, so an older build refuses it (going back needs the backup taken before the update).

## [4.1.0] - 2026-10-24

### Added
- eten.kp-soft.dev is a web app: a manifest, home-screen icons and the iOS
  meta tags, so the parents' wheel can be pinned and opens full screen;
  safe areas keep it clear of the notch and the home bar. Manifest and
  icons answer only the home network, like the page. Kitchen itself has
  no manifest.

## [4.0.0] - 2026-10-24

### Changed
- Every name needs its Dutch and English half: dishes, categories,
  ingredients and ingredient categories (the server refuses a half name);
  adding an ingredient inline asks both. Older items show a badge. Shelf
  foods and freezer items keep their texts in both languages too.
- One wheel component for every wheel (eten.kp-soft.dev, /parents, "What do
  we eat?", an ingredient's page): the small wheel beside the big one,
  bottoms aligned, the answer beside them; a wider page. Names fit their
  slice from the first paint, a little room around the hub, no rewinding
  after the stop (the pastel theme overshot by up to 122.6 degrees).
- The small wheel spins only after the big one has stopped on a dish with
  two or more sides.
- The recipe editor picks several ingredients at once, one line each.

### Migration
- None by hand: the first start rewrites `kitchen.json` to format 5 (a
  shelf food's texts and a freezer item's name go into both language
  halves). Kitchen 3.0.0 refuses a format-5 file: going back needs the
  backup taken before the update.

## [3.0.0] - 2026-10-24

### Changed
- Recipes belong to their dish (`dish.recipes`, one the default); the
  separate recipe list is gone. Add, edit and pick the default from the
  dish's page; Recipes lists every recipe of every dish. The log, the
  freezer and resting point at dishes (`dish_id`).
- "What do we eat?" picks from the dishes, with a category filter and the
  small wheel for a dish's sides; "Yes, cook this" opens cook mode.
- The parents' page starts with the wheel card (no page header).
- Loading, empty and failed wheel cards take the room their plate needs,
  not the wheels' (the empty card on eten.kp-soft.dev was 1131 px high).

### Added
- The freezer form takes the dish an item is, so the wheel counts it.

### Fixed
- An ingredient's own page did not load (2.0.0).

### Migration
- None by hand: the first start rewrites `kitchen.json` to format 4 (each
  recipe into its dish, the first the default; `dish_id` on log lines,
  freezer items and resting marks). Kitchen 2.0.0 refuses a
  format-4 file: going back needs the backup taken before the update.

## [2.0.0] - 2026-10-24

### Changed
- The kitchen file is format 3, lifted on the first start: dishes have
  fixed ingredients and sides of one or more ingredients instead of parts
  and kinds of part; recipe lines point at one shared list of ingredients.
- A new kitchen starts with only the two dish categories, "Other" for
  ingredients and the dinner time; no sample recipes or dishes.
- The zero-prep shelf's "This one" is "I ate this": it writes a log line
  for today (`shelf_id`), with Undo.
- Every form grid spans the full width with its controls on one track and
  its hints on another; one, larger gap between the sections of a screen.

### Added
- Ingredients and ingredient categories (`/ingredients`), with a page per
  ingredient: its dishes and recipes, filters and a wheel among its dishes.
- Full add, view, edit and delete everywhere: safe dishes (pick or write a
  recipe, Not safe any more), freezer items, shelf foods, resting dishes,
  log lines (docs/agent/CRUD.md). Every item has its own page
  (`/dishes/<id>`, `/freezer/<id>`, …) with Edit and Delete; "What I ate"
  (`/log`) lists the log.
- `/data/wheel/nl` behind the login: Kitchen's `/parents` in Dutch.
- Cook mode shows the recipe's timeline, as the timing page does.
- A NL/EN toggle in the top bar: every screen in Dutch or English, kept in
  the kitchen's settings; the names follow it.
- Photos on recipes: one or more per step and one for the recipe, added in
  the recipe editor (a phone offers its camera), shown under the step and
  large in cook mode; stored as files next to `kitchen.json`
  (`<state>/photos/`). The browser shrinks a photo under the kit's body
  limit (`KITCHEN_MAX_BODY_BYTES`, 1 MiB by default).

### Fixed
- Kitchen's English parents' wheel (`/parents`) loaded its script and
  sheet from `/eten/`, which only the home network may open, so away from
  home it did not draw; only the Dutch page and its data stay home-only.
- The freezer's "Add something you froze" form never saved: the browser's
  own submit reloaded the page before the save went out.
- The recipe page's cooking log loads with the package's busy card, and its
  grid is left out under the empty plate.

### Migration
- None by hand: the first start of this version rewrites `kitchen.json`
  to format 3 (dishes' parts become fixed ingredients and sides, the kinds
  of part go, recipe lines point at ingredients; nothing is added or
  removed). Kitchen 1.0.0 refuses a format-3 file: going back to 1.0.0
  needs the backup taken before the update.

## [1.0.0] - 2026-10-22

### Added
- First release. Recipes with a wheel that chooses, cook mode with parallel
  tracks, backward timing from the moment dinner should be ready, the
  bad-days freezer and calm settings.
- Dishes page: dishes with a Dutch and an English name, a category and
  parts with choices; kinds and categories are lists of their own.
- The parents' wheel: in Dutch on its own host (`KITCHEN_PARENTS_HOST`)
  without an account, only for the home network (`KITCHEN_PARENTS_ALLOW`,
  default `10.10.10.0/24`); in English at `/parents` behind the login.
- `KITCHEN_TRUSTED_ADMINS`: addresses let in without a login.
- Built on chassis-rs v3.13.0 (kp-themes 11.2.0).

### Security
- rustls-webpki 0.103.16 and webpki-roots 1.0.10.
