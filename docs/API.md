# Kitchen API: which resources a page reads

Kenny's API rule (04/11/2026): (1) every resource has its own `GET`; (2) a page that reads several resources also gets
ONE merged endpoint; (3) the browser loads through the merged endpoint and falls back to the individual ones when the
merged call fails. The routes themselves are the table in `src/routes.rs`; this file is the page-level view.

## Kitchen's merged read: `GET /data/kitchen`

Kitchen's own shell read (every screen needs nearly all of it). It is not the kit's read-through: pages read the kit's
local database (`web/js/api/kitchen-read.js`), and only with "keep everything" off do they call this route.

### Parts of /data/kitchen

Each part is the body of its own endpoint, built from the same store (`src/store/`); `routes_parts_tests.rs` asserts
equal bodies, and that the kitchen holds no part without an endpoint.

| Part of `/data/kitchen` | Own endpoint |
|---|---|
| `freezer`, `shelf`, `log`, `resting`, `dishes`, `dish_categories`, `ingredients`, `ingredient_categories`, `drafts`, `recipe_sources` | `GET /data/{list}` (one item: `GET /data/{list}/{id}`) |
| `settings` | `GET /data/settings` (the plain object; `ETag` = `settings_rev`) |
| `settings_rev` | `rev` of `GET /data/settings/kitchen` (`{id, rev, ..keys}`) |
| `format` | none: a constant of the build (`web/js/offline/assemble.js` `FORMAT`) |

`recipes` is a view over the dishes, filled by the browser. The answered take keys are the server's bookkeeping and
stay out.

### Fallback (browser)

When `GET /data/kitchen` fails on the server (a 5xx, or a 2xx that is no kitchen) `web/js/api/snapshot-parts.js`
assembles the same object from the parts above (pure, tested in `scripts/snapshot-parts.test.mjs`). Offline (status 0)
and signed out (401) do not fall back: the parts would fail the same way. A failed fallback throws its own error and the
page shows its failed state with it. With "keep everything" on the pages read the local database, which already pulls
each collection by itself.

## Merged page endpoints: none

A merged `GET /data/pages/{name}` exists only for a page that reads more than one resource besides the kitchen. No
Kitchen page does, so there is none (a name there would be a 404 anyway).

| Page | Reads besides the kitchen |
|---|---|
| `/`, `/cook`, `/timing`, `/bad-days`, `/recipe`, `/recipes`, `/dishes`, `/log`, `/sources`, `/ingredients`, `/<word>/<id>` | nothing |
| `/recipe/edit` | `GET /data/drafts` (one resource; also a part of the kitchen) |
| `/settings` | nothing (the settings are part of the kitchen; the offline row reads the kit's own usage) |
| `/parents` | `GET /data/wheel/en` (one resource, no kitchen) |
| `/eten` (public, Dutch) | `GET /eten/data` (one resource, no kitchen, no login) |
| Photos, import | `GET /data/photos/{id}` image bytes; `POST /data/import*` writes |

Add a merged endpoint (and a test like `routes_parts_tests.rs`) when a page starts to read two resources besides the
kitchen.
