# Changelog

All notable changes to kitchen. Semantic versioning: a breaking change
in the API, the configuration knobs or the on-disk state is a major, and
carries a **Migration** section saying what an operator must do.

## [Unreleased]

Built on **chassis-rs 4.5.0 with kp-themes 12.3.0** (was 4.4.0 with 12.2.0; tag v4.5.0, `[meta-chassis-450-1]`). The 4.5.0
changelog has no Migration section; `Cargo.lock` moved only `chassis`, `docs/KIT.md` got the new `sync_retain_days` knob.

### Removed

- The stand-ins kp-themes 12.3.0 makes redundant `[refactor-drop-stand-ins-1]`: the data-table footprint script
  (`web/js/ui/datatable-footprint.js`, kp 2bc105c2b), the popover panel `box-sizing` rule and the settings row's
  `nameTrigger` (kp e1406eddb). Re-measured at the next release (docs/OPEN.md, release check 15).

## [6.0.0] - 2026-11-03

Everything since 5.0.0 (Kenny's four UX rounds of 01/11/2026 and his six bug fixes), ready to become the release notes.
Nothing here is released or deployed yet; no store format change (optional fields only), no new server setting (see "Migration / deploy notes").
Built on **chassis-rs 4.4.0 with kp-themes 12.2.0** (was 4.0.0 with 12.0.0; tag v4.4.0, `[meta-chassis-440-1]`): it carries
`WebApp::kp_modules()`, the fix that gives gzipped pages their preferences block, the login's `?next=`, the offline data
client with `IfMatch` / `Revisioned` / `Conflict`, trimmed offline keeping, `chassisData.post()` with `IdempotencyKey`, the
kit's failed-edits drawer and the server-is-master rules (Kitchen ran on unreleased revs of chassis main for these on
02/11/2026, last 67d593e, which v4.4.0 carries; only `chassis` moved in `Cargo.lock`).

### Added
- **The whole kitchen offline** [feat-offline-kitchen-1..4] (Kenny 02/11/2026, "Hele keuken offline"): on the kit's offline
  data client (`window.chassisData`, chassis-rs cd68fd9). Every read of the kitchen goes through it and a copy is kept on the
  device in IndexedDB, so recipes, cook mode and the lists open without a connection after a reload. Edits made without a
  connection (any list's save or delete, a recipe saved as its dish, the settings) wait in the kit's queue, show at once and
  after an offline reload, and are sent in order when the kitchen answers again; Undo of a waiting delete takes it back from
  the queue. The kit's connection band (kp-themes) shows offline, reconnecting and "N changes waiting" on every page.
  - **Calm settings: "Keep everything offline" / "Alles offline bewaren"**, on by default on every device, with how much room
    the copy takes and **"Clear offline copy" / "Offline kopie wissen"** (deletes the copy; edits still waiting stay).
  - **Edits the kitchen refused** (Kenny's kit decision: skip and continue): an edit refused when it is sent (changed
    elsewhere meanwhile) goes to a list opened from the kit's toast ("Review"), with "Keep the kitchen's version" or "Save
    mine over it"; the other edits are sent.
  - Signing out with edits not yet sent is meant to ask first (the kit's confirmation, given Kitchen's words); the sign-out
    button lives on the kit's own pages, which do not start the data client, so it does not ask yet (docs/OPEN.md).
  - Creating something new, a draft, an import and Undo's restore still need a connection (the kitchen
    gives new things their number); without one they now say so ("This needs a connection ...").
- **Keep one recipe offline** [feat-offline-recipe-1..3] (Kenny 02/11/2026 17:25 and 19:12, "zowel de hele keuken als per
  recept"): with "Keep everything offline" off, the recipe page has "Keep offline" / "Offline bewaren": it keeps that
  recipe on this device with its dish (and so the dish's other recipes) and the ingredient names it uses, so the recipe
  page and cook mode open it without a connection; Calm settings counts the recipes kept this way. Switching "Keep
  everything offline" off now removes the rest of the copy instead of leaving it until "Clear offline copy".
- **A kept recipe that is gone leaves the offline copy** [feat-offline-gone-1] (Kenny 02/11/2026 19:43, "Uit kopie halen"):
  when the kitchen answers 404 for a recipe kept offline (its dish was deleted), its keep, its copy and the ingredients no
  other kept dish uses are dropped, and a toast says "This recipe is no longer in the kitchen and has been removed from your
  offline copy." once. No connection, or any other error, drops nothing.
- **Take a portion without a connection** [feat-offline-take-1] (Kenny 02/11/2026 19:13): "Take a portion" on Bad days
  works offline; the freezer shows it at once and the kitchen takes it when the connection is back, exactly once even if
  an answer got lost on the way.
- **A heading on the import card** (Kenny 02/11/2026): the Recipes page's import field sits under "Import a recipe" / "Recept importeren" and one sentence saying what it does; the field row is unchanged.
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
- **Revisions are the kit's** [refactor-rev-kit-1]: `PUT /data/{list}/{id}` reads `If-Match` with chassis-rs' `IfMatch`
  (`5`, `"5"`, `W/"5"` and now `*`; a malformed header is the kit's 400 `{error, remedy}`), and a stale save is the kit's
  409 `{error, remedy, code: "stale", rev}` with `ETag: "<rev>"` (was `{error, code, rev}` without `remedy`; the words of
  `error` changed, `code` and `rev` did not). A saved item answers with `ETag: "<rev>"` too; `rev` stays in the body. The
  pages send `If-Match` through the kit's client; Kitchen's own header code is gone.
- **kp-themes split delivery on every page** [feat-kp-split-1] (Kenny 02/11/2026 17:24, "Nu overstappen"): `web/index.html`
  and the parents' page `web/eten/index.html` link `kp-themes-base.min.css` (fonts included) instead of `fonts.css` plus the
  4.4 MB `kp-themes.css`; `/static/theme-boot.js` sits below it with `data-register-pattern`, `data-themes` and
  `data-fallback` (as the kit's layout writes them), and `dist/js/auto.js` loads as a module. A picked theme fetches its
  register through `attachLazyRegisters` (`web/eten/registers.js`, shared by both pages, before the theme pickers). The 92
  import lines from the one-file bundle and the 11 JSDoc type imports now name kp's per-module entries (204 import lines
  over 49 entries, from `action-tiles.js` to `wheel.js`; `components.js` for the skip links, nav toggles and
  `openConfirmation`, which have no smaller entry). The printable sheet reads the base sheet plus the formal register
  instead of `kp-themes.css`. `scripts/kp-entries.test.mjs` fails on any path back to the bundle, a page that mixes the two,
  or a name an entry does not export; `scripts/check-wheels.mjs` also knows `dist/js/wheel.js`.
  Merged on main [feat-kp-split-3] with Kitchen pinned to chassis-rs main fcb993f [meta-chassis-fcb993f-1] (unreleased,
  still 4.2.0; re-pin to its release tag before Kitchen's release): Kitchen's `WebApp` calls `kp_modules()`, so the kit
  injects `webapp-runtime-modules.js` on the same per-module entries and a page holds one copy of kp's state.
- **chassis-rs 4.2.0 / kp-themes 12.2.0** [meta-chassis-420-1]: only `chassis` moved in `Cargo.lock`. The cook timeline uses
  the kit's fit mode (`data-kp-gantt-scroll="fit"`, `FIT_FROM` 12.2.0 confirmed). The bar's More pages (Dishes,
  Ingredients, Parents' wheel, Recipe sources, Calm settings) are the kit's secondary pages (`Page::secondary`), so the
  kit's own pages (Storage, the login) show the same five places plus More [app-more-secondary-1].
- **Signed out while a page is open** [fix-signed-out-1]: the kit now answers a page's call without a login 401 instead
  of the login page, and Kitchen no longer leaves the page for the login: a notice says so in Dutch or English with a
  "Sign in (new tab)" link, so what was typed stays and the save can be repeated after signing in.
- **An empty Recipes card on a dish page offers one way in** (Kenny 02/11/2026): while the dish has no recipe, the card header's Add and Import are hidden and the empty state's own "Add the recipe" is the action; they come back with the first recipe (an Undo too).
- **"Enter adds" moved under the Add button** (Kenny 02/11/2026): in the add row of What I ate (and of the category tables, which share it) the button's label line is empty and "Enter adds" / "Enter voegt toe" stands under the button as its help.
- **The Bad days calendar sits in a card** (Kenny 02/11/2026): "When things went in" shows its month in a full-width card titled "This month in the freezer" / "Deze maand in de diepvries" with one line saying what a filled day means, like the other parts of the page.
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
- **"The link may be old" only when a link was followed** (Kenny 02/11/2026 03:43): when "When do I start?" opens on
  tonight's wheel answer and that recipe is gone, it says so in its own words ("Tonight's wheel answer has no recipe in
  the kitchen any more" / "Het recept van het antwoord van het wiel staat niet meer in de keuken").
- **"How it was checked" on a recipe source reads plainly** (Kenny 02/11/2026 03:43): "Checked on 29/10/2026 by
  importing Perfect guacamole" / "Getest op 29/10/2026 met een echte import van Perfect guacamole", the recipe a link.
  The seed now stores just the recipe address; kitchens seeded earlier keep their stored text and show the same words.

### Fixed
- An empty or failed data table on /dishes, /ingredients, /log, /sources and /recipes keeps the height it had loaded
  (it was 9-41 px lower): a stand-in for kp-themes 2bc105c2b adds the count line, pager and sort summary that leave to the
  plate's held height, until that kp-themes release reaches Kitchen through chassis-rs [fix-table-footprint-1]
- Found by the 6.0.0 release checks: the printable sheet printed without its ingredient checklist (kp-themes draws only
  into the page's own realm; the list is now drawn in the page and imported into the frame) [fix-sheet-checklist-1]; a new
  device kept nothing offline, because the "keep everything offline" default's mark followed the login (now device-only)
  [fix-offline-default-1]; on /settings "Clear offline copy" sits under its hint instead of off the "Use default" column
  [fix-settings-clear-align-1].
- **Every page could not read the kitchen** [fix-kit-ready-1]: Kitchen asked for the kit's data client while its own
  main.js ran; the browser already says `readyState` "interactive" then, before the kit's runtime module (injected after
  main.js) has run, so `window.chassisData` was not there yet and every page showed "the kit's data client is not on this
  page". Kitchen now waits for the client itself, DOMContentLoaded or `load` (`web/js/api/kit-ready.js`).
- **Print sheet fonts 404'd** [fix-paper-fonts-1]: the paper stylesheet adopted in the print frame had no base address, so
  its `../fonts/…` urls resolved to `/fonts/` (two console errors on every `/recipe`); it now carries the base sheet's url.
- **Offline: the server is always the master** (Kenny 02/11/2026 19:43, "de server is altijd de master, heeft altijd
  gelijk"; audit [fix-offline-master-1..4] on chassis-rs 67d593e, which now puts a refused edit's copy back to the
  server's version and drops a copy the server answers 404 for):
  - A queued edit the kitchen refused on replay (a freezer take with no portions left, a stale save) no longer stays on
    screen: the kitchen is read again after a replay that refused anything, not only after one that sent something
    [fix-offline-master-1].
  - A recipe kept offline on its own now follows the kitchen: every online kitchen read reads each kept dish and the
    ingredients again, keeps the ingredients a kept dish names since and lets go of the ones none names any more
    [fix-offline-master-2] (one extra request per kept dish; a kit gap is filed for doing it from the kitchen's answer).
  - A kitchen read from the device's copy is read again on every page change and when the browser is back online, so a
    page never keeps showing the offline copy once the kitchen answers [fix-offline-master-3].
  - Undo of a delete that was still waiting: the item put back is the page's own, so the next online read replaces it
    with the kitchen's version [fix-offline-master-4].
  - A delete and a settings change are checked like a save [fix-offline-master-5] (option A of the audit, which follows
    from Kenny's rule): `DELETE /data/{list}/{id}` and `PATCH /data/settings` honour `If-Match`, and the pages send the
    revision they read. A delete or settings change made offline and sent after someone changed the item or the settings
    elsewhere is refused and lands in the list of refused edits, and the copy goes back to the kitchen's version; online,
    the same refusal shows the "changed elsewhere" toast with Reload. Since the settings carry one revision, a settings
    change made over any newer settings change elsewhere is refused, even when it touched another key.
- **A category renamed in its table cell answers a stale save like every other quick save** [fix-cat-rename-stale-1]:
  when the category was saved elsewhere since the page read it, the shared "changed elsewhere" toast with Reload appears
  and the kitchen is read again; the cell still shows its own refusal.
- Key-value lists (the item page's Details, cook mode's Begin card) carry kp-themes' `kp-kv--center`, so a label that
  wraps lines up with its value once the kit ships it (12.2.0; harmless before). `scripts/kv-center.test.mjs` fails on a
  `dl.kp-kv` without it.
- **A restart no longer leaves photo files behind** [fix-photo-orphans-1]: when the kitchen starts it deletes the photo
  files nothing refers to any more (dropped within Undo's window just before a restart, or uploaded in a tab that closed
  before its draft was written), once they are older than 10 minutes, and logs how many went.
- **A quick action no longer overwrites a change made elsewhere** [fix-quick-rev-1]: the safe toggle, a category reorder,
  make default and a recipe's Undo send the revision they read, like the editor; when the item was saved in another tab
  or on another device in the meantime, nothing is overwritten and one toast says "This changed elsewhere in the
  meantime. Reload the page and try again." with **Reload**, and the page shows what is stored now.
- **A deleted recipe's photos no longer stay forever when the page reloads during Undo** [fix-undo-photos-1]: the server
  notes the photos that dropped out of a dish (or went with a deleted dish) and deletes the files once its 2-minute Undo
  window closed, unless a dish, a draft or a restorable item still refers to them.
- **Two tabs on one recipe no longer overwrite each other silently** [fix-stale-save-1]: every item has a revision and a
  save names the one it read (`If-Match`); a recipe saved elsewhere in the meantime answers "This recipe was changed
  somewhere else in the meantime." with **Reload** or **Keep my version as a draft**. The dish drawer is guarded the same way.
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
- Workarounds dropped now that kp-themes 12.2.0 fixes them [fix-chassis-420-workarounds-1]: the Dutch calendar nav
  width (`--kp-calendar-nav-fit`), the fifth action column on a dish's recipe rows, the popover plate's position and size
  (now the kit's `.kp-popover--panel`; only `box-sizing` stays), `theme-button.js` (now `themeMenuMarkup({ trigger: 'label' })`)
  and `quantity-lock.js` with its test. Each re-measured in Firefox at 1280 and 390: same place and size as before.
  Kept because they still help: the lower cook-timeline rows (lanes 86/112 px with, 128/168 without), the lazy fold
  autosize (long recipe opens in 2.9 s with, 8.2 s without) and the debounced timeline repaint (155 ms a key with, 350
  without). Two new kp-themes gaps and one chassis-rs gap logged in `~/Projects/kp-gaps/`.
- The unused safe-dish picker and its words are gone; the recipe editor page's Save and heading helpers, the recipes
  table's life and the page registrations moved into small modules (no behaviour change); functions the UX rounds grew
  were split under 40 lines.
- `ganttFitAttrs` (`web/js/recipe/timeline-fit.js`) asks the kit for `data-kp-gantt-scroll="fit"` from kp-themes
  `FIT_FROM` (12.2.0, confirmed against its CHANGELOG) and "off" before; tests in `scripts/`.

- The kit's own failed-edits drawer (Discard / Save again / Discard all; chassis-rs 073273f, in the pinned 8042dbe) replaces
  Kitchen's list of refused edits [refactor-offline-drawer-1]: `failed-list.js`, `describe.js`, their test and words are gone;
  Kitchen's NL/EN words go to the kit through `kitMessages`. The logout question on the kit's own pages and the band's words
  after a language switch are the kit's now. `web/js/api.js` lost the recipe import and the wheel reads to
  `web/js/api/server-reads.js` (still exported from `api.js`) [refactor-api-split-1].

### Migration
6.0.0 is a major: the kit's own database moves to a schema 5.0.0 refuses, so a rollback is not free. What an operator does:
- **Before the update, back up `kitchen-kit.db`** (in the state dir). It moves from schema 2 to 3 on the first start
  (chassis-rs 4.2.0 and later); 5.0.0 refuses schema 3, so going back to 5.0.0 needs that backup put back.
  `kitchen.json` stays format 5 and 5.0.0 opens it as is.
- **Environment**: nothing new. Behind the home route `KITCHEN_TRUSTED_PROXIES` keeps Traefik's address (10.10.10.4).
- **Store**: new optional fields only: `rev` on a saved item, `settings_rev`, and the freezer take's `answered` keys
  (absent = 0 / empty; 5.0.0 ignores them on a rollback).
- **Routes**: new read-only `GET /data/{list}/{id}` (one item with its `rev` as `ETag`, under the same `/data/` prefix and
  login); `POST /data/freezer/{id}/take` reads an optional `Idempotency-Key` (a UUID); `DELETE /data/{list}/{id}` and
  `PATCH /data/settings` honour `If-Match`. The proxy must pass `Idempotency-Key`, `If-Match` and `ETag` (Traefik does by
  default). Details in the deploy notes below.

### Migration / deploy notes (for the homelab thread)
- **Environment**: no new or changed variable. `KITCHEN_TRUSTED_PROXIES` must still include Traefik (10.10.10.4) behind
  the home route, as in 5.0.0; `KITCHEN_TRUSTED_ADMINS`, `KITCHEN_PARENTS_ALLOW` and the rest are untouched.
- **Store**: `kitchen.json` stays format 5 (`FORMAT` in `src/store/data.rs`; no migration step added since 5.0.0). One optional
  field is stored: `rev` on an item once it is saved (fix-stale-save-1; absent = 0, 5.0.0 ignores it). Undo lives in server memory only and is lost at a restart (an Undo after a restart
  answers "can no longer be undone"). **The kit's own database (`kitchen-kit.db`) moves from schema 2 to 3 on the first
  start** (chassis-rs 4.2.0 adds the empty `kit_push_subscriptions` table; Kitchen sends no push).
- **New read-only route** (feat-offline-recipe-1): `GET /data/{list}/{id}` answers one item with its `rev` as `ETag` (404
  when the list or item is missing), behind the same login as every `/data/` route. No proxy or setting change: it sits
  under the `/data/` prefix the home route already passes.
- **Freezer take keys** (feat-offline-take-1): `POST /data/freezer/{id}/take` reads an optional `Idempotency-Key` (a UUID,
  else 400) and `kitchen.json` gains an optional `answered` list (at most 200 keys with their first answer; absent when
  empty, format stays 5). 5.0.0 ignores the field on a rollback and drops it at its next save, which only means a replay
  queued before the rollback could take twice. The proxy must pass the `Idempotency-Key` header (Traefik does by default).
- **Settings revision** (fix-offline-master-5): `kitchen.json` gains `settings_rev` (a whole number, raised on every
  settings change; absent in an older file = 0, format stays 5; 5.0.0 ignores it on a rollback and drops it at its next
  save). `DELETE /data/{list}/{id}` and `PATCH /data/settings` now honour `If-Match` (no header: unchecked, as before),
  and `GET`/`PATCH /data/settings` answer an `ETag`. The proxy must pass `If-Match` and `ETag` (Traefik does by default;
  `PUT` already relies on them).
- **chassis-rs 4.4.0** (tag v4.4.0, `[meta-chassis-440-1]`; Kitchen ran on its unreleased revs 8042dbe and 67d593e
  before the tag): trimmed offline keeping, `chassisData.post()`, and the server-is-master rules (a refused replay restores
  the server's copy, a 404/410 drops it, "Save again" always sends `If-Match`, no overwrite policy, a list GET without a
  query string prunes items it no longer holds; Kitchen makes no filtered list read).
- **Size limits** (fix-field-limits-1): the server now refuses a name half over 200 characters, any other text over
  5,000 and more than 200 steps, lines, tools or tracks in a recipe. Data already stored is not touched; an item over a
  limit can still be read, but saving it again asks to shorten the field first.
- **Photo clean-up**: photos dropped from a dish are removed once the 120 s undo window closes (fix-undo-photos-1); a
  restart inside that window no longer leaves them: each start deletes the photo files nothing refers to that are older
  than 10 minutes (fix-photo-orphans-1) and logs "orphan photo files deleted at start" with the count. The first start
  of this version may delete older orphans from before it; files other than `<uuid>.jpg|webp` are never touched.
- **Rollback to 5.0.0**: `kitchen.json` is identical in shape, so 5.0.0 opens it as is; but 5.0.0 (chassis 4.0.0)
  refuses a kit database at schema 3 ("written by a newer build"), so **take a backup of `kitchen-kit.db` before the
  update** and put it back on a rollback (it holds the sessions and synced browser keys only; without it the start fails). Going further back than 5.0.0
  keeps the 5.0.0 rule (a backup taken before that update).
- **chassis-rs 4.2.0 behaviour the operator sees**: every answer carries `Permissions-Policy` (camera, microphone,
  geolocation and the rest off; Kitchen asks for none: photos come through a file input, which the policy does not
  touch), `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy: same-origin` (the parents' host /eten, the QR
  code, photos and PWA icons are all same-origin and load), and `Strict-Transport-Security` (one year) when Traefik
  reports HTTPS, so `kitchen.kp-soft.dev` and `eten.kp-soft.dev` must stay HTTPS-only. JSON answers are `no-store`
  (nothing in Kitchen relied on caching them). `/favicon.ico` answers a 308 to `/pwa/icon-192.png`; the manifest lists the
  maskable and monochrome icons from `web/pwa/`.
- **Offline**: the service worker still keeps pages and static files only, never `/data/*`. The offline copy is the page's
  own (feat-offline-kitchen): IndexedDB `chassis-data:kitchen` per browser, on by default, capped at the kit's 50 MB. A reload
  while offline draws the kitchen from that copy with the edits that wait to be sent; with the copy off or cleared it draws
  the failed states as before. Logout deletes the copy and the waiting edits (page and worker). No server setting.
- **Server answers changed by the revision fold** (refactor-rev-kit-1): a stale save's 409 body now carries `remedy` and the
  kit's `error` sentence (clients read `code: "stale"` and `rev`, unchanged), plus `ETag`; `If-Match: *` is accepted; a
  malformed `If-Match` answers the kit's 400 shape. `kitchen.json` is untouched (format 5, `rev` as before).
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
