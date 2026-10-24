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
| `minutes` | number | Total time, start to plate |
| `hands_on` | number | Minutes of real work |
| `portions` | number | Portions the amounts below make |
| `prep` | `none` \| `light` \| `full` | How much preparing it needs (`none` = no prep, a bad-day dish) |
| `safe` | boolean | A safe favourite for bad days |
| `gear` | string | What it dirties: "1 pot", "the oven, 2 pots" |
| `last_note` | string | The "Last time" note on the recipe page |
| `ingredients` | `{id, ingredient, amount: number \| null, unit, group, note?}`[] | `ingredient` is an `ingredients` id (format 3; the name comes from there). Scalable amounts for `portions`; `unit` is `g`, `ml`, `pc`, `tbsp`, `tsp`, `pinch`, `clove`, `slice`, `handful`, …; `group` heads the checklist ("Ingredients", "From the cupboard") |
| `tools` | `{id, name}`[] | Gathered before cooking (the Begin checklist's "Tools") |
| `tracks` | `{id, name}`[] | Parallel tracks ("Pasta", "Sauce"); empty for a one-track dish |
| `steps` | step[] | In cooking order, see below |
| `mini_note` | string | What the mini version (bad days) leaves out |
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
| `photos` | string[] | Photo ids in show order (at most 8 in the editor): shown under the step on the recipe page and large in cook mode while the step is in hand. Missing = none |

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

Who deletes: the editor deletes the photos a recipe no longer refers to when it
saves (a removed photo, a removed step) and the ones it uploaded when it is
cancelled; the recipes page deletes a recipe's photos when the recipe is
deleted. Known limit: a photo that was uploaded and then never saved nor
cancelled cleanly (tab closed, connection lost during delete) stays as an
orphan file; nothing sweeps them.

## dishes

What lands on a plate, for the parents' wheel (`/dishes` keeps them;
`src/parents.rs` makes the wheel). Every name is `{nl, en}`; an empty half
only drops it from that language's wheel, which goes for a dish, a side and
a category alike. At least one half is filled.

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
into `dish_id` in the freezer and resting.

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

`{dish, dish_id: string | null, portions: number, frozen_on: ISO datetime}`:
`dish` as written, `dish_id` the dish it is when it is one of Kenny's (the
wheel counts its portions for that dish; format 4).
`POST /data/freezer/{id}/take` with `{"portions": 1}` takes one out (Undo
sends `-1`); an item at zero portions stays until a page deletes it.

## shelf (zero-prep shelf)

`{title, text, minutes, gear, energy: "open" | "easy" | "any"}`: `open` is
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
