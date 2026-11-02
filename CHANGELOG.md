# Changelog

All notable changes to kitchen. Semantic versioning: a breaking change
in the API, the configuration knobs or the on-disk state is a major, and
carries a **Migration** section saying what an operator must do.

## [Unreleased]

Everything since 5.0.0 (Kenny's four UX rounds of 01/11/2026 and his six bug fixes), ready to become the release notes.
Nothing here is released or deployed yet; no store format change, no new setting (see "Migration / deploy notes").

### Added
- **New Kitchen app icon** (pot with steam, approved 01/11/2026): the full set (180/192/512, maskable 192/512, monochrome 512, SVG) in `web/pwa` and on the parents' page (`web/eten`, whose manifest now lists maskable and monochrome icons); the kit's own manifest picks up maskable/monochrome with the next chassis-rs.
- **Undo for every delete that can come back**: a dish, recipe, recipe source, ingredient, dish or ingredient category,
  freezer portion, shelf food, log line or resting mark goes at once and a 10 s "Undo" toast puts it back at its place
  under its own id. The server keeps what it deleted in memory for 2 minutes (`POST /data/restore/{list}/{id}`).
- **The recipe editor page** (`/recipe/edit`) with the kit's always-visible unsaved bar (Save, Discard, Ctrl+S), an
  "On this page" index and Keep as draft / Discard when you leave; **Edit** in the recipe page's header.
- **Import from a link at the top of the Recipes page** ("Paste a link" + Import; pasted text in a fold).
- **Cook mode as one full-screen stage** with a "Gather first" sheet and a "More" sheet (see Changed).
- **Add rows** on top of the What I ate table and of the category tables; categories reorder by dragging.
- **Reasons on disabled Delete** ("Used by 1 dish and 2 recipes").
- **Tonight's answer is remembered for the day** in this browser, so "When do I start?" opens on it.
- **Wheel filter chips** with a Want / Not / Either way menu; **"Send to phone"** and **"Print options"** popovers;
  **"Add a safe dish"** as a list; **"From the dish"** in the freezer form.

### Changed
- **Calm settings give the "what it says now" column more room** (Kenny 02/11/2026): the name column stops at 30 % of the card, so at 1280 the current value reads on one or two lines instead of three.
- **The bar keeps five places and a More menu** (Kenny 01/11/2026): What do we eat?, When do I start?, Bad days, Recipes and
  What I ate stay in the bar; Dishes, Ingredients, Parents' wheel, Recipe sources, Storage and Calm settings sit under
  "More ▾". The header is one row at 1280. The NL/EN toggle left the bar: the language is chosen in Calm settings only.
- **Calm settings: the theme is a button with the theme's name** ("Formal ▾") that opens the kit's theme menu.
- **Recipe page**: the "Cook on your phone" card is a "Send to phone" button beside Edit that opens the code in a
  popover, and the four print options sit in a "Print options" popover next to "Print this recipe"; the preview stays.
- **Bad days**: "Add a safe dish" is a short list of the recipes not yet safe (one click marks one safe); the safe
  dishes' Edit and "Not safe any more" buttons align on a shared grid; adding to the freezer starts with "From the
  dish", which fills both names.
- **Recipes**: each row has Edit and a menu with Duplicate and Delete (the delete is the one with Undo).
- **Delete at once, with a 10 s Undo** for every item that can come back: dishes, recipes, recipe sources,
  ingredients, dish and ingredient categories, freezer portions, shelf foods, log lines and resting marks. No typed
  name any more. The server keeps a deleted item for 2 minutes and Undo puts the same item back at its place under the
  same id (`POST /data/restore/{list}/{id}`), so log lines, freezer items and dishes that point at it find it again;
  a recipe's photos are deleted only when the Undo window closed.
- **Delete is off while an item is in use**, with the reason on the button: "Used by 1 dish and 2 recipes" for an
  ingredient, "Used by 6 dishes" for a category (tables and the item's own page). The ingredients table counts
  dishes and recipes apart.
- **Categories are edited in their table**: both names in their cell (Enter saves, Esc cancels), the order by dragging
  a row or Alt+Up / Alt+Down, a new one in the add row on top. The category drawer is gone; a category's own page
  opens its cell in the table.
- **What I ate has an add row on top of its table**: day, what was eaten, how it felt and a note; Enter adds. The
  drawer for a new line is gone (editing a line keeps it).
- **The recipe editor is a page of its own** (`/recipe/edit`, Kenny 01/11/2026), not a drawer. `?id=<id>` edits a recipe,
  `?new=1` or `?dish=<id>` writes a new one (`&safe=1` makes it a safe dish), `&start=copy|import` opens an editable
  copy or an import result as unsaved work, and `&from=<path>` is where Save and Back return to. It has the kit's page
  header, the kit's unsaved-changes bar (Save and Discard always in view, docked to the foot of the screen once the
  header scrolls away, Ctrl+S) which counts the changed sections, and an "On this page" list (a fold on a phone) with
  the sections the drawer had. Draft autosave and the restore offer are unchanged; leaving a changed page (a link, the
  bar's Back) asks Keep as draft / Discard, closing the tab asks the browser's question, and a Back button in the browser
  keeps the work as a draft. Recipes (Add, Edit, Duplicate), a dish's Recipes card, bad days and an import result all open
  the page; Save returns to where you came from, else the recipe page. The recipe drawer is gone.
- **Edit in the recipe page's header** (Kenny 01/11/2026): the recipe page has an Edit button beside the effort badge; it opens the
  editor page and Save comes back to the recipe.
- **Import from a link, at the top of the Recipes page** (Kenny 01/11/2026): "Paste a link" and an Import button sit on a row
  of the form grid above the table, with "Which sites work?" beside them and the pasted-text fallback in a fold
  ("Paste the recipe text instead"). The result opens the editor page as an unsaved draft, with the unmatched-lines
  warning and the cover-photo question as before. "Import from this site" (sources) and a dish's Import button open
  the Recipes page with the field focused and a line naming the site or the dish (`/recipes?import=1&site=` / `&dish=`).
  The import drawer is gone.
- The unsaved bar and the contents list speak Dutch in the Dutch interface (`web/js/i18n/kp-nl/unsaved.js`).
- **Cook mode is one full-screen stage** (Kenny, 01/11/2026): the step in hand fills the screen, Back and Next are pinned
  at the bottom (55 px), running timers are pinned at the top as compact rows while one runs, and the tracks are one strip
  of tabs over the step. Begin with the mise en place, the explanations, the timeline, the timer discs, calm mode and the
  links to the recipe and the mini version are in one "More" sheet; until cooking has begun a quiet "Gather first" opens
  it on Begin. Wake lock, timers, `fresh=1`, planned waits and Read aloud work as before.
- **The cook timeline fits a phone**: no bar is cut at the edge any more and its rows are lower (390 px: 272 to 202 px).
  It asks for kp-themes' own fit mode (`data-kp-gantt-scroll="fit"`) from the kit release that carries it.
- **What do we eat?**: "Yes, cook this" is drawn as the primary action only once the wheel has given an answer, and the
  answer column keeps its lines so the buttons never move. Each filter chip opens a small menu with Want / Not / Either
  way and shows its answer as a mark and a word; the help line is said once at the top of the filter card.
- **The empty side wheel says why inside its disc** ("No side for this dish" / "Geen bijgerecht bij dit gerecht"), at
  the same size, on `/`, `/eten` and `/parents`.
- **When do I start?** has one recipe picker, in the page header, and opens on tonight's wheel answer (kept in this
  browser for the day); the empty state no longer has a button of its own.
- **A dinner time moved on "When do I start?" is for today only** (Kenny 02/11/2026 03:43): "Eat at 00:22 instead" or a
  typed dinner or start time no longer changes the default in Calm settings; this browser keeps it for the day (and after
  midnight until that dinner has come), the wheel shows the same time, and the next day starts from the default again.
- **The recipe line on "When do I start?" counts the steps** (Kenny 02/11/2026 03:43): "… start to plate" is the total
  of the timed steps laid out on their tracks, the same figure as the plan, not the minutes stored with the recipe.

### Fixed
- **A reload after the last step keeps cook mode finished** [fix-cook-finished-1]: the steps open on the last one with the
  "Log tonight's dinner" card (the kit forgets the place once the flow is done, so it opened on step 1 with no card); a logged
  dinner stays logged, so it cannot be logged twice. Kept per recipe in this tab until cooking starts fresh.
- **The timer band never sends the cook back** [fix-cook-goto-1]: once the cook is past the step that started a timer, its
  button is "Stop <timer>" ("You are already past this step") instead of "Go to step N"; the band follows each step move.
- **A meeting step follows back after a timeline drag** [fix-meet-pin-1]: a drop writes a start only for the bars it moved
  (the sequencer's `changed`), so a step where the tracks meet is no longer pinned at its old start and moves earlier again
  when a step before it shrinks.
- **The installed parents' app always opens the wheel** [fix-eten-scope-1]: its manifest's `start_url` and `scope` are
  `/eten` (they were `/`, which is Kitchen itself when the app was added from Kitchen's own host).
- **A restored draft or a copy counts only what changed** [fix-change-count-1]: it said "5 changes" (every section);
  a restored draft of a saved recipe is compared with the saved recipe, a copy or import counts what differs from how it
  opened (at least its dish section, so Save stays offered).
- **A new recipe with only its dish chosen can be saved** [fix-dish-only-save-1]: the bar counted "No changes" when the
  editor opened from the dish; a new recipe with a dish now counts its dish section as changed.
- **A long recipe edits without a freeze per key** [fix-long-recipe-1]: the editor's timeline is painted again when typing
  pauses (300 ms; a picked value, an added row or a stepper still at once), and a step's second-language text in its
  closed "More" fold is sized only when the fold opens. 60 lines / 40 steps in Firefox at 1280: a key press went from
  about 2.2 s to about 0.2 s; opening stays slow (20-33 s under load; the kit's autosize and sequencer, kp-gaps).
- **An import or a copy no longer writes over a kept draft** [fix-draft-key-1]: each has its own draft key (it shared the blank new
  recipe's `new:<dish>`), carried in the editor's address so a reload finds it; a new recipe in that dish still offers
  the draft an import or copy left behind.
- **Closing the recipe editor never throws work away**: Escape, the close button and Cancel keep the draft; leaving a
  changed page asks Keep as draft / Discard.
- **The wheel's filter and "what counts as easy" panels fit inside their card** (they stuck out at the edge), and the
  easy options use the normal chip style.
- **The recipe log shows no empty toolbar ghost** above its empty state.
- **"Read aloud" in cook mode is a 44 px touch target** (was smaller).
- **Pages use the kit's page width** (80 % of the window, never under 64rem); the wheel page stays wider on purpose.
- **Calm settings** rows whose value cell has a hint keep what the setting says on the line of its name (they hung 9 to
  19 px under it); the Dutch calendar on Bad days no longer scrolls a 390 px phone sideways (its nav folds below 26rem).

- **Runaway input is refused, and the page says where**: a name half over 200 characters, any other text over 5,000 and
  a recipe with more than 200 steps, ingredient lines, tools or tracks is refused by the server (400 with the field and
  the limit); the editors stop typing at the limit (`maxlength`) and name the field in their error ("Step 4, text
  (Dutch) is too long: at most 5000 characters.") in Dutch and English.
- **A draft that could not be saved shows "Draft not saved"** once (until a save works again) instead of nothing; the
  other swallowed failures (draft and photo deletes, the recipe-move rollback, the start-up read) are logged.

### Internal
- The unused safe-dish picker and its words are gone; the recipe editor page's Save and heading helpers, the recipes
  table's life and the page registrations moved into small modules (no behaviour change); functions the UX rounds grew
  were split under 40 lines.
- `ganttFitAttrs` (`web/js/recipe/timeline-fit.js`) asks the kit for `data-kp-gantt-scroll="fit"` from kp-themes
  `FIT_FROM` (12.2.0, assumed) and "off" before; tests in `scripts/`.

### Migration / deploy notes (for the homelab thread)
- **Environment**: no new or changed variable. `KITCHEN_TRUSTED_PROXIES` must still include Traefik (10.10.10.4) behind
  the home route, as in 5.0.0; `KITCHEN_TRUSTED_ADMINS`, `KITCHEN_PARENTS_ALLOW` and the rest are untouched.
- **Store**: `kitchen.json` stays format 5 (`FORMAT` in `src/store/data.rs`; no migration step added since 5.0.0). No new
  collection or field is stored: Undo lives in server memory only and is lost at a restart (an Undo after a restart
  answers "can no longer be undone"). The kit's own database stays at schema 2 (chassis 4.0.0, unchanged).
- **Rollback to 5.0.0**: the data file is identical in shape, so 5.0.0 opens it as is; only the Undo route and the new
  screens go away. A backup is still good practice, but none is required for this step. Going further back than 5.0.0
  keeps the 5.0.0 rule (a backup taken before that update).
- Deploys the same way as 5.0.0 (no new dependency, no new port, no new file on disk).

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
