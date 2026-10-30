# Changelog

All notable changes to kitchen. Semantic versioning: a breaking change
in the API, the configuration knobs or the on-disk state is a major, and
carries a **Migration** section saying what an operator must do.

## [Unreleased]

### Added
- A draggable timeline in the recipe editor (own section "Timeline"): the steps as clips on one lane per track, like
  a video editor. Drag a step to move it, drag it to another track to run it at the same time, drag its edge to
  change how long it takes; Enter picks a step up for the keyboard, a zoom control and a sideways scroll inside its
  own box serve a phone. The kit's new `sequencer` (chassis 3.14.0, kp-themes 11.3.0). The quick-add step list stays
  the other view: every change in either one is written to the same step fields (`track`, `mins`, `start`, `with`)
  and shown in the other, the total and hands-on time update when a drag is dropped, and the draft keeps saving.
  Within a track the list follows the order of the starts. No format change. Cook mode keeps its own run timeline
  (the real clock, steps done, the step in hand), which the sequencer is not.
- A step in the "Where the tracks meet" lane now moves along by itself when a step before it gets longer or moves, so it
  never overlaps one and the total stays right without dragging (`web/js/recipe/meet.js`). A step dragged later keeps
  its later start.
- Recipe sources (`/sources`, Dutch "Receptbronnen"): the websites whose recipe
  pages the import reads well, as a list of your own with Add, Edit, Delete,
  search, a language filter and an own page per source. Every site link opens
  in a new tab; "Import from this site" opens the import drawer with a pointer
  to it, and the drawer links to the page ("Which sites work?"). New optional
  `recipe_sources` collection (format stays 5; `POST /data/recipe_sources`
  accepts only http(s) addresses, a language and a note in both languages or
  none). A new kitchen, and a file from before the list, starts with six sites
  proven by one real import each: Dagelijkse Kost, 24Kitchen, Leuke recepten,
  BBC Good Food, Simply Recipes and RecipeTin Eats.
- Import a recipe (Recipes page and a dish's Recipes card): a web address or
  pasted text becomes an unsaved draft in the recipe editor. Kitchen reads the
  page's recipe data (JSON-LD), splits amounts, units and names, matches
  ingredients to the catalogue (unknown ones offer "Add as a new ingredient"),
  proposes step minutes from the text and asks "Use this photo as the cover?"
  before any picture is fetched. The fetch refuses private, loopback and
  link-local destinations, pins the checked address, follows at most 3
  redirects and stops at 10 s and 2 MB (`docs/agent/DATA.md`).
- A recipe has an optional `source` (the import stores the page's address): a
  link on the recipe page, editable or clearable in the editor; the server
  accepts only an http(s) address or nothing. No format change.
- A remark in brackets or after a comma in an imported ingredient line is kept
  as the line's note (editable, shown under the name on the recipe page).
- Cook mode honours a step's fixed `start`: counted from the moment cooking
  began and shown as a planned wait in the timeline.
- `scripts/measure.mjs` runs kp's measures with the theme set in localStorage,
  so dark is measured here too.

### Changed
- chassis 3.14.0 with kp-themes 11.3.0; tokio 1.53.3 to 1.54.1 (RUSTSEC-2026-0386), nothing else in `Cargo.lock`
  moved but chassis itself.
- Workarounds of Kitchen's own that kp-themes 11.3.0 made redundant are gone: the page's `preventDefault` on the
  bad-days form, the cook-mode timeline's own CSS minimum width and sideways scroll (the gantt keeps its minimum
  width and scrolls inside its own frame), the lane stretch for the time a running step has left (the gantt draws
  it from `plannedEnd`), the read of the remembered progress (`getStepsPassed`) and the 180 degree turn of the
  wheel's left-half names (the wheel reads upright itself). `scripts/check-forms.mjs` fails when a form that posts
  natively lacks `data-kp-form-native-submit`; it runs with the two older checks from
  `.claude/hooks/gates.project.sh`. No form of Kitchen needed the attribute: all eight save with `fetch`.
- An imported ingredient line the catalogue does not know is no longer dropped
  on Save: the editor warns, each line can be added as a new ingredient or
  discarded, and Save waits until none is left.
- Recipe drafts are dropped after 7 days (checked when the kitchen starts),
  and a discarded or expired draft takes the photos only it refers to with it.

### Fixed
- Photo upload: when the browser cannot decode a picture directly, the fallback now reads it through a data: URL instead of a blob: URL, which the Content-Security-Policy blocks (`web/js/recipe/photo-decode.js`). The policy is unchanged.
- Dagelijkse Kost imports read all steps: that site lists only two in its
  recipe data, so the page's own instruction list is used when it is longer.
- The step and recipe photo galleries keep their height while loading, empty
  or failed instead of collapsing.


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
