# The kitchen's data

One JSON file, `<state dir>/kitchen.json`, read whole by `GET /data/kitchen`
and changed through the routes in `src/routes.rs`. The server issues `id`
(a UUID), `created` and `updated` (RFC 3339); everything else below is the
pages' agreement with each other. A field not listed may be added by a page
that needs it; add it here in the same change.

Dates and times shown to a person are `dd/mm/yyyy HH:mm`, Europe/Brussels.
Stored dates are ISO (`2026-10-19`, `2026-10-19T18:30:00+02:00`).

## a dish's recipes (`dish.recipes`)

Since format 4 (Kenny, 24/10/2026 09:18, 09:27: "the recipe belongs to the
dish", and a dish may have several) a recipe is not a list of its own: it
is one entry of `dish.recipes`, with its own `id`, a `label` `{nl, en}` (the
pages say "Recipe 1", "Recipe 2" while it is empty: "Oven", "Snelkookpan")
and `default` on one of them (the one the wheel uses and "Yes, cook this"
opens). The pages read them through a view (`web/js/api.js`: `k.recipes` is
every recipe of every dish, named "Stoofvlees · Oven" when the dish has
several or the recipe has a label, with `dish_id`; a create, replace or
remove on "recipes" goes to the dish). The fields below are a recipe's;
there is no `name` in it.

| Field | Type | Meaning |
|---|---|---|
| `short` | string | Short label for the wheel's slice ("Pasta"); the wheel's `short` option |
| `summary` | string | A few sentences for the recipe page's lede; may be empty |
| `meals` | string[] | `breakfast`, `lunch`, `dinner` |
| `ing` | string[] | Main ingredients the wheel filters on: `chicken`, `beef`, `egg`, `cheese`, `tomato`, `potato`, … |
| `minutes` | number | Total time, start to plate: the effective value (Kenny, 29/10/2026: computed from the steps, see below) |
| `hands_on` | number | Minutes of real work: the effective value, computed from the hands-on steps |
| `minutes_override` | number \| null | A time typed by hand (the editor's Override switch); when a number it is what `minutes` holds. Absent = null |
| `hands_on_override` | number \| null | The same for `hands_on` |
| `portions` | number | Portions the amounts below make |
| `prep` | `none` \| `light` \| `full` | How much preparing it needs (`none` = no prep, a bad-day dish) |
| `safe` | boolean | A safe favourite for bad days |
| `gear` | string | What it dirties: "1 pot", "the oven, 2 pots" |
| `last_note` | string | The "Last time" note on the recipe page |
| `ingredients` | `{id, ingredient, amount: number \| null, unit, group, note?}`[] | `ingredient` is an `ingredients` id (format 3; the name comes from there). Scalable amounts for `portions`; `unit` is `g`, `ml`, `pc`, `tbsp`, `tsp`, `pinch`, `clove`, `slice`, `handful`, …; `group` heads the checklist ("Ingredients", "From the cupboard"); `note` is a plain remark about the line ("chopped", "schil en sap"; Kenny, 29/10/2026), one text in whatever language it was written, like a step's `note`: edited under the ingredient in the editor, read under the name on the recipe page and in the print sheet |
| `tools` | `{id, name}`[] | Gathered before cooking (the Begin checklist's "Tools") |
| `tracks` | `{id, name}`[] | Parallel tracks ("Pasta", "Sauce"); empty for a one-track dish |
| `steps` | step[] | In cooking order, see below |
| `mini_note` | string | What the mini version (bad days) leaves out |
| `source` | string \| null | Where an imported recipe came from (Kenny, 29/10/2026): an `http://` or `https://` address, or absent / null / empty. The server refuses anything else (400, "recipes[0].source must be a web address…"). Shown on the recipe page as a link ("Source" / "Bron", `target="_blank"`, `rel="noopener noreferrer"`, the host as its text) and editable or clearable in the editor. Optional with no default needed, so the format stays 5 |
| `photo` | string \| null | A photo id (see Photos below): the one picture of the dish, at the top of the recipe page (Kenny, 24/10/2026 05:23) |

A step:

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Stable within the recipe |
| `track` | string \| null | A track id; `null` where the tracks meet |
| `text` | string | The instruction, one action |
| `say` | string | Lower-case phrase for timing sentences: "put the pasta water on" |
| `mins` | number | How long the step takes |
| `active` | boolean | Hands-on (stretched by a slow-day pace) or walk-away |
| `timer` | `{seconds, name}` \| null | A timer the step starts |
| `uses` | `{amount: string, name}`[] | What this step needs, as written ("400 g") |
| `note` | string | A line under the step |
| `note_tone` | `""` \| `warning` | The note's tone |
| `mini` | boolean | Kept in the mini version |
| `start` | number \| null | Minutes from the recipe's start at which the step begins; `null` or absent = right after the previous step of its track. Set by the timeline (a later kp-themes component), optional |
| `with` | string \| null | A step id: this step starts together with that one ("runs alongside"); it does not push its own track's next step back. `null` or absent = no partner. A dangling id is ignored |
| `photos` | string[] | Photo ids in show order (at most 8 in the editor): shown under the step on the recipe page and large in cook mode while the step is in hand. Missing = none |

### Computed times (`web/js/recipe/schedule.js`)

One pure module lays the steps out per track (sequential, a step with `start` placed there, a step with `with`
beside its partner, a step with no track, or a track that is gone, after every track so far) and the editor, the
timing page and cook mode all use it (timing counts back from dinner with `align: "end"`, cook mode takes its rows
and the `with` pairs). The recipe's total is the critical path (the latest end); the hands-on time is the union of
the `active` steps' intervals. The editor writes the effective values into `minutes` and `hands_on` on every save
(computed, or the typed override), so every reader keeps reading those two; a recipe whose steps have no minutes yet
keeps the figures it has. No store change: all four fields are optional, format stays 5. Test:
`node --test scripts/schedule.test.mjs`.

### Photos

Not part of `kitchen.json`: files in `<state dir>/photos/<uuid>.jpg|webp`
(so the backup of the state directory takes them), referenced by the uuid.
Routes behind the login (`src/photos.rs`): `POST /data/photos` (body = the
image bytes, `Content-Type` `image/jpeg` or `image/webp`, checked against the
first bytes, at most 4 MiB; answers `{"id"}`), `GET /data/photos/{id}` (long
private cache), `DELETE /data/photos/{id}`. The id in the address must be a
plain lower-case UUID. The browser makes the picture at most 1600 px on the
long side (WebP, JPEG as fallback) before sending (`web/js/recipe/photos.js`).
The kit refuses any request body above `KITCHEN_MAX_BODY_BYTES` (1 MiB by
default), which is lower than the 4 MiB cap here, so the browser shrinks a
photo further until it is under about 1 MB; raise the knob only if that ever
bites.

Duplicate (Kenny, 29/10/2026): a copy of a recipe or dish refers to the SAME photo ids as the original: the
files are shared, nothing is copied on disk. That is why a photo file is deleted (editor Save, Recipes-page delete)
only when no recipe of the kitchen refers to it any more.

Who deletes: the editor deletes the photos a recipe no longer refers to when it
saves (a removed photo, a removed step) and the ones it uploaded when it is
cancelled; the recipes page deletes a recipe's photos when the recipe is
deleted. Known limit: a photo that was uploaded and then never saved nor
cancelled cleanly (tab closed, connection lost during delete) stays as an
orphan file; nothing sweeps them.

## dishes

What lands on a plate, for the parents' wheel (`/dishes` keeps them;
`src/parents.rs` makes the wheel). Every name is `{nl, en}` with both halves
filled (Kenny, 24/10/2026 10:04): the server refuses a dish, a dish
category, an ingredient or an ingredient category with an empty half (400,
"name.en is empty"), and a side's or recipe's own `label` that has one half
only. A half missing in an item stored before that rule only drops it from
that language's wheel, and the pages mark it.

| Field | Type | Meaning |
|---|---|---|
| `name` | `{nl, en}` | "Stoofvlees" / "Flemish beef stew" |
| `category` | string \| null | A `dish_categories` id |
| `parents` | boolean | On the parents' wheel |
| `recipes` | recipe[] | Its recipes (the fields above, with `id`, `label` and `default`), added and edited from the dish's page; empty while it has none |
| `ingredients` | string[] | `ingredients` ids that always come with the dish: the stew itself, "Sla" (Kenny, 24/10/2026 05:26) |
| `sides` | `{ingredients: string[], label?: {nl, en}}`[] | The choices, in the dish's order. Each side is one or more ingredients that go together ("Frieten" + "Mayonaise") and is one entry on the small wheel, which spins when there are two or more; one side is simply named. The entry reads as the side's `label` in that language ("Kroketten met mayonaise"; 05:27), else as its ingredients joined ("Frieten en mayonaise"). An ingredient stands once within a side but may stand in several sides |

The wheel data (`/eten/data`, `/data/wheel/en`) gives each dish its fixed
`ingredients` as names and each side as `{name, ingredients}`, already in
the page's language; an ingredient without a name in it is left out, and a
side with none left goes.

Older files are lifted on the first start (`src/store.rs` `migrate`):
format 1 kept "kinds of part" in a `dish_parts` list that a dish's `parts`
pointed at; format 2 turned each choice into a side `{name, choice}`;
format 3 turns every distinct side name and recipe line name into one
ingredient (category "Andere" / "Other"), a side with `choice` on into a
side of one ingredient and one with `choice` off into a fixed ingredient;
format 4 moves each recipe into its dish's `recipes` (the dish that linked
it, else the one with its name, else a new dish with its name; the first in
a dish is the default), adds `dish_id` to the log and turns `recipe_id`
into `dish_id` in the freezer and resting; format 5 puts a shelf food's
title, text and gear and a freezer item's name into `{nl, en}`, the old text
in both halves.

## drafts

`{key, data, saved}` (Kenny, 29/10/2026): the recipe editor's autosaved form, in the database and not in the
browser, so it follows Kenny from one device to the next. `key` is the recipe's id, or `new:<dish id>` for a
recipe that has no id yet (`new:` alone when it has no dish); `data` is the editor's form state (a recipe body
with `dish_id` or `new_dish`, `label` and the steps); `saved` is set by the server on every write. One draft per
`key`: `POST /data/drafts` with the same `key` replaces it (its `id` and `created` stay), so the editor saves
about 1 s after the last change without ever making a second one. The editor deletes the draft on Save and on
Cancel / Discard; a draft that is still there is what a closed tab or a dropped connection left, and reopening
the recipe offers "Restore the draft from dd/mm/yyyy HH:mm?". The list is optional in the file (an older file
has none), so the format stays 5. Photos a draft refers to are files like any other (see Photos).

## import (`POST /data/import`, `POST /data/import/image`)

Kenny, 29/10/2026 14:27: a recipe from a website or from pasted text, with a preview. Nothing is stored by the
import itself: the answer opens the recipe editor as an unsaved draft (`drafts`, key `new:<dish id>`, deleted on
Save and Cancel like any draft).

`POST /data/import` takes `{"url": "https://…"}` or `{"text": "…"}` (text wins when both are sent) and answers
`{name, portions, ingredients: [text], steps: [text], minutes: {prep, cook, total}, image_url, source_url}`
(`portions`, the minutes and `image_url` may be null; `source_url` is the page after redirects, null for text).
A page is read from its `<script type="application/ld+json">` blocks: the first `Recipe` node (top level, in an
array, `@graph` or `mainEntity`; `@type` may be an array) with `name`, `recipeYield`, `recipeIngredient`,
`recipeInstructions` (string, array, `HowToStep`, `HowToSection`), ISO 8601 durations (`PT1H15M`, `P0DT20M`) and
`image` (string, array, `ImageObject`). Pasted text is split by its headings (Ingredients / Ingrediënten; Method,
Instructions, Directions, Steps, Bereiding, Werkwijze), bullets and numbers stripped; without headings, a line that
starts with an amount is an ingredient. A failure is `{"error": "<code>"}`: `blocked_address`, `bad_url`,
`unreachable`, `too_many_redirects`, `not_html`, `not_image`, `too_large`, `timeout`, `http_status`, `no_recipe`,
`empty`; the page maps the code to words (`imp.err.*`).

`POST /data/import/image` takes `{"url"}`, runs the same safe fetch (4 MiB cap), and answers the picture's bytes
(`image/jpeg`, `image/png` or `image/webp`, by its first bytes; nothing else, SVG included, is passed on). It stores
nothing: the browser makes the picture smaller and sends it through `POST /data/photos` like any photo
(`web/js/recipe/cover.js`), and only after Kenny pressed Yes on "Use this photo as the cover?", so no third-party
image is loaded before that and the site never sees the reader.

Safety of the fetch (`src/import.rs`; the routes are behind the login and the parents' host redirects them to the
wheel):

| Rule | How |
|---|---|
| http(s) only, default port, no credentials | `parse_url` refuses anything else (`bad_url`), for the address and for every redirect target |
| no private destinations | the host is resolved first and EVERY address must pass `allowed_ip`: not loopback, 10/8, 172.16/12, 192.168/16, 169.254/16, 0/8, 100.64/10, 198.18/15, 192.0.0/24, 240/4, multicast, broadcast, documentation; not `::`, `::1`, fe80::/10, fc00::/7, fec0::/10, ff00::/8; an IPv4 inside an IPv6 (`::ffff:`, `::a.b.c.d`, NAT64 `64:ff9b::`, 6to4 `2002::`) is judged as that IPv4 (`blocked_address`, before any connection) |
| DNS cannot change after the check | the connection goes to the checked address (`ClientBuilder::resolve` pins it; TLS still verifies the host name); the system proxy is off so nothing routes around it |
| redirects | followed by hand, at most 3 (`too_many_redirects`), each target judged like a typed address |
| bounded | 10 s for everything (`timeout`), 2 MB page / 4 MiB picture, reading stops past the cap (`too_large`); a page must be `text/html` or `application/xhtml+xml` (`not_html`) |
| nothing of ours leaves | no cookies, no `Authorization`, no `Referer`, `User-Agent: Kitchen recipe import` |

Reading a line (`web/js/recipe/import-lines.js`): what stands in brackets and what follows the first comma ("1 sinaasappel
(schil en sap)", "2 uien, fijn gesneden") becomes the line's `note` ("schil en sap", "fijn gesneden"; several are joined with
"; "), the rest is the name that is matched against the catalogue. The page's address (`source_url`) is stored on the recipe
as `source`.

An imported line the catalogue does not know is never dropped silently: the editor lists such lines in a warning above the
ingredient lines, each line offers "Add as a new ingredient" (the picker's own step; both names required) and "Discard this
line", and Save is refused with a message while any is left. The unresolved lines stay in the draft until then.

Known limit: the imported text is not translated (it lands in the label and lines as written).

## dish_categories

`{name: {nl, en}, order: number}`: "Dagelijkse kost" / "Everyday". `order`
is the position, 1, 2, 3, … without gaps; the dishes page keeps it so. A
category a dish uses cannot be deleted from the page.

## ingredients and ingredient_categories

One list of ingredients for the whole kitchen (Kenny, 24/10/2026 05:15):
a dish's fixed ingredients and sides and a recipe's lines point at it, so
"Mayonaise" is one thing with one page (`/ingredients/<id>`) that lists
every dish and recipe with it.

| Field | Type | Meaning |
|---|---|---|
| `name` | `{nl, en}` | "Frieten" / "Fries"; an empty half drops it only from that language |
| `category` | string \| null | An `ingredient_categories` id |

`ingredient_categories` are `{name: {nl, en}, order}` like the dish
categories: "Vlees" / "Meat", "Aardappelen" / "Potatoes", "Andere" /
"Other" (in a new kitchen and made by the migration when missing). An
ingredient or a category still in use cannot be deleted; the refusal names
every dish, recipe or ingredient that uses it.

## freezer

`{dish: {nl, en}, dish_id: string | null, portions: number, frozen_on: ISO datetime}`:
`dish` its name in both languages (format 5; it was one string), `dish_id`
the dish it is when it is one of Kenny's (the wheel counts its portions
for that dish; format 4).
`POST /data/freezer/{id}/take` with `{"portions": 1}` takes one out (Undo
sends `-1`); an item at zero portions stays until a page deletes it.

## shelf (zero-prep shelf)

`{title: {nl, en}, text: {nl, en}, minutes, gear: {nl, en}, energy: "open" | "easy" | "any"}`
(format 5: the texts in both languages; the title needs both, text and gear
both or neither): `open` is
"Just open it", `easy` "One easy step", `any` "Anything here".

## log (what was cooked)

`{dish_id, recipe_id?, shelf_id?, date: "YYYY-MM-DD", feeling: string | null, note}`.
Exactly one of `dish_id` and `shelf_id` is set: a dish that was cooked
(format 4; `recipe_id` says which of its recipes, when known), or a
zero-prep shelf food that was eaten
("I ate this" on /bad-days, Kenny, 24/10/2026 05:07). The wheel's "days
since last cooked" and the recipe page's heat log read only the dish lines;
"What I ate" (`/log`) and a shelf food's own page show both.

## resting

`{dish_id, until: "YYYY-MM-DD"}`: "Not this one, not again this week".
The wheel leaves a resting dish out until `until` has passed (format 4: a
mark whose recipe no dish carried was dropped).

## settings (one object, `PATCH /data/settings`)

| Key | Meaning |
|---|---|
| `dinner_time` | "18:30", the default dinner time for backward timing |
| `lang` | `en` \| `nl` |
| `pace` | `normal` \| `slow` |
| `spare` | minutes to spare before dinner |
| `odds` | wheel odds: `recency` \| `freezer` \| `equal` (default `equal`, Kenny 19/10/2026) |
| `timer_sound` | `chime` \| `bell` \| `buzzer` \| `off` |

Calm mode and the theme are kept per device by kp-themes itself
(`kp-remember:calm:*`, the theme picker), not here.
