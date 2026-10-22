# The kitchen's data

One JSON file, `<state dir>/kitchen.json`, read whole by `GET /data/kitchen`
and changed through the routes in `src/routes.rs`. The server issues `id`
(a UUID), `created` and `updated` (RFC 3339); everything else below is the
pages' agreement with each other. A field not listed may be added by a page
that needs it; add it here in the same change.

Dates and times shown to a person are `dd/mm/yyyy HH:mm`, Europe/Brussels.
Stored dates are ISO (`2026-10-19`, `2026-10-19T18:30:00+02:00`).

## recipes

| Field | Type | Meaning |
|---|---|---|
| `name` | string | Full name: "Spaghetti with tomato sauce and meatballs" |
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
| `ingredients` | `{id, name, amount: number \| null, unit, group, note?}`[] | Scalable amounts for `portions`; `unit` is `g`, `ml`, `pc`, `tbsp`, `tsp`, `pinch`, `clove`, `slice`, `handful`, …; `group` heads the checklist ("Ingredients", "From the cupboard") |
| `tools` | `{id, name}`[] | Gathered before cooking (the Begin checklist's "Tools") |
| `tracks` | `{id, name}`[] | Parallel tracks ("Pasta", "Sauce"); empty for a one-track dish |
| `steps` | step[] | In cooking order, see below |
| `mini_note` | string | What the mini version (bad days) leaves out |

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

## dishes

What lands on a plate, for the parents' wheel (`/dishes` keeps them;
`src/parents.rs` makes the wheel). Every name is `{nl, en}`; an empty half
only drops it from that language's wheel, which goes for a dish, a kind of
part, a category and a choice alike. At least one half is filled.

| Field | Type | Meaning |
|---|---|---|
| `name` | `{nl, en}` | "Stoofvlees" / "Flemish beef stew" |
| `category` | string \| null | A `dish_categories` id |
| `parents` | boolean | On the parents' wheel |
| `recipe_id` | string \| null | The recipe to cook it from, if there is one |
| `parts` | `{part, choices: {nl, en}[]}`[] | `part` is a `dish_parts` id, once per dish; when the kind has `wheel` on and there are two or more choices, the small wheel picks one; otherwise the choices are named as they are |

## dish_parts (kinds of part) and dish_categories

`{name: {nl, en}, order: number}`, and on `dish_parts` also `wheel: boolean`
(picked by the small wheel): "Aardappelen, rijst of pasta" / "Potatoes, rice
or pasta" with `wheel: true`, "Dagelijkse kost" / "Everyday". `order` is the position, 1, 2, 3, … without
gaps; the dishes page keeps it so. A kind or category a dish uses cannot be
deleted from the page.

## freezer

`{dish, recipe_id: string | null, portions: number, frozen_on: ISO datetime}`.
`POST /data/freezer/{id}/take` with `{"portions": 1}` takes one out (Undo
sends `-1`); an item at zero portions stays until a page deletes it.

## shelf (zero-prep shelf)

`{title, text, minutes, gear, energy: "open" | "easy" | "any"}`: `open` is
"Just open it", `easy` "One easy step", `any` "Anything here".

## log (what was cooked)

`{recipe_id, date: "YYYY-MM-DD", feeling: string | null, note}`. The wheel's
"days since last cooked" and the recipe page's heat log both read it.

## resting

`{recipe_id, until: "YYYY-MM-DD"}`: "Not this one, not again this week".
The wheel leaves a resting dish out until `until` has passed.

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
