# What each list offers on screen

Kenny, 24/10/2026 05:07 and 05:08: everything that is entered or read out
has full CRUD in the screens (C add, R view, U edit, D delete), and every
item has its own page. The API has had all four for every list since 1.0.0
(`/data/{list}`, `/data/{list}/{id}`); this table is about the screens.
`js/records/` holds the editors and the deletes, `pages/item/index.js` the item
pages.

| Item | Where | Before (C R U D, own page) | After (C R U D, own page) |
|---|---|---|---|
| Recipe (a dish's own, format 4) | the dish's page, /recipes, /recipe?id= | C R U D, page | C R U D from the dish's page and /recipes; Delete takes it off the dish (the dish stays) |
| Recipe lines, steps, tracks, tools | inside the recipe editor | C R U D, no page | C R U D on the recipe; no own page (by design) |
| Dish | /dishes | C R U D, no page | C R U D, `/dishes/<id>` |
| Dish side | inside the dish editor | C R U D, no page | C R U D, order, label; shown on the dish's page |
| Dish category | /dishes | C R U D, no page | C R U D, `/categories/<id>` (lists its dishes) |
| Kind of part | /dishes | C R U D | gone (Kenny 05:03) |
| Ingredient | /ingredients | did not exist | C R U D, `/ingredients/<id>` (its dishes, recipes, a wheel) |
| Ingredient category | /ingredients | did not exist | C R U D, `/ingredient-categories/<id>` |
| Freezer item | /bad-days | C (form), R, take a portion | C R U D, take a portion, `/freezer/<id>` |
| Shelf food | /bad-days | R only | C R U D, I ate this, `/shelf/<id>` (its days) |
| Safe dish (a recipe's `safe`) | /bad-days | R; set only in the recipe editor | Add (pick a recipe or write a new one), Edit (the recipe), Not safe any more (the recipe stays) |
| Log line | /log, recipe page | C R U D on the recipe page only, no list | C R U D on `/log` and the recipe page, `/log/<id>`; dishes and shelf foods |
| Recipe source | /sources | did not exist | C R U D, `/sources/<id>`; links open in a new tab; "Import from this site" opens the import with a pointer to it |
| Resting dish | / (the wheel) | C (set aside), R, D (bring back) | C R U D (Edit the last day), `/resting/<id>` |
| Settings | /settings | R U (one object) | R U; nothing to add or delete |

Counted on 24/10/2026: 14 items audited, 15 gaps found and 15 closed: no
own page for 6 lists (dish, dish category, freezer item, shelf food, log
line, resting dish); no Edit and no Delete for a freezer item (2); no Add,
Edit or Delete for a shelf food (3); no Add and no Not-safe for a safe dish
(2); no Edit for a resting dish (1); no list of the whole log (1).
