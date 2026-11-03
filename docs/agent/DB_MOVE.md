# Moving the kitchen's data into databases (design note, open choices)

Kenny's standing rule, 02/11/2026 21:01: "ALLE info gaat vanaf nu in databases, geen aparte .json bestanden meer".
This note is the study and the open choices for moving `kitchen.json` into the app database (`kitchen.db`, the kit's
`AppDb`) and the pages onto the kit's local database (`chassisData.db`), on chassis-rs tag v4.5.0. Written 03/11/2026. **Kenny answered A to E on 03/11/2026 06:12** (section
"Decisions" right below); the server side is built ([feat-db-schema-1], [feat-db-sync-1], [feat-db-import-1],
[feat-db-store-1]), the page side too ([feat-db-pages-1], [feat-db-pages-2], [refactor-offline-kitdb-1], section
"Page side, as built" below). The option texts further down are kept as the record of what
was weighed.

Fixed by Kenny's rules, not open: the server is always the master; revisions and `If-Match` behave exactly as today
(docs/agent/DATA.md "Revisions and stale saves"); the domain stays behind the existing store port (`Store`'s methods,
which `routes.rs` and `parents/` call), only persistence changes; `kitchen.json` is backed up first and left untouched
until the new store is verified; no data loss; never two offline layers.

## Decisions (Kenny 03/11/2026 06:12) and how they were built

| Choice | Kenny's answer | Built as |
|---|---|---|
| A, tables | **"Echte kolommen"** (A3): real columns per list, not one JSON body per row; index what Kitchen queries | `src/store/db/schema_v1/*.sql` (four parts by area) (kit migration 1), described as data in `spec.rs`, `tables.rs`, `recipe_tables.rs` and written/read by one generic codec (`codec/`). A column per known field (`{nl, en}` names as `<key>_nl`/`<key>_en`, a step's `text`/`note` as plain or pair columns, numbers in `ANY` columns so `2` and `2.0` stay apart); nested lists are child tables with `ON DELETE CASCADE`, the parent keeps `n_<key>` (count; NULL = absent). Lossless: a value that does not fit its column and any key no column knows go to the row's `k_extra` JSON object, so the routes keep accepting any page field as before; a draft's `data` (editor state) is one JSON column. Indexes: `id` (unique), `k_pos`, `category` (dishes, ingredients), `order` (both category lists), `dish_id` (freezer, log, resting), `shelf_id` and `date` (log), `energy` (shelf), `key` (drafts), the ingredient ids of dish ingredients, side ingredients and recipe lines, every child table by `(k_parent, k_pos)` |
| B, recipes | **"Binnen het gerecht"** (B1) | recipes and their steps, lines, tools, tracks (and a step's timer, uses, photos) are child tables of the dish; the dish is the synced unit, its `rev` covers its recipes, `dish_rev` unchanged |
| C, revisions | **"Behouden"** (C1) | item `rev` kept (absent → `"rev": 0` written on import); the settings are the one-item collection `settings` (key `kitchen`, rev = `settings_rev`) at `/data/settings/kitchen` (GET, PATCH; `id`/`rev` in a PATCH body are ignored); `GET`/`PATCH /data/settings` stay as they are for the pages until the page helper moves them |
| D, pages | **"Nu ook de pagina's"** (D1) | server: a `SyncCollection` per list (routes `/data/<list>`, `/data/<list>/:id`, shared, indexes) plus `settings`; `KitchenLoad` serves each body as the item route answers it; every write records `tx.sync_upsert`/`sync_delete` in its own transaction. Every existing `/data/*` route answers the same shapes. Pages: section "Page side, as built" |
| E, failed import | **"Geen terugval"** (E2-like, no file adapter) | first start copies `kitchen.json` → `kitchen.json.pre-db` (first attempt only), imports in the kit's transaction, reads everything back and compares value for value; any failure rolls back, `kitchen.json` stays, and Kitchen logs what failed and exits 1 at start (`boot.rs`), so no Kitchen without data runs. Until the store has loaded, every store route answers 503 |

Built differently from the "Not open" list below: the store keeps the whole kitchen in memory as before and persists
each change as the before/after difference (`plan.rs`); the import accepts files from 4.1.0, 5.0.0 and 6.0.0 (live is
4.1.0, measured on CT 121 by the coordinator 03/11/2026). Not built (asked): creating items offline under device-made ids
(`client_key` / `check_create`), so a create stays online-only as today; the feed carries no list order (see the
page-side notes in docs/OPEN.md, release check 16).

## Page side, as built (feat-db-pages-1, feat-db-pages-2, refactor-offline-kitdb-1; 03/11/2026, nothing run)

`chassisData.configure({ name: "kitchen", rev: "rev", routes: [], db: true })`. Details in docs/agent/DATA.md "Offline copy".

| Kitchen's adapter before | Now |
|---|---|
| `/data/kitchen` whole in the kit's response cache, `applyQueued` over every read (`offline/apply.js`) | the kitchen built from the collections (`offline/assemble.js`, `api/kitchen-read.js`); the kit's overlay lays the queued PUT/PATCH/DELETE over its records |
| reread after a replay (`offline/sync.js`), after a page change or reconnect (`refreshIfOffline`) | the kit pulls (start, reconnect, focus, hints, 5 min, after a replay that sent); every collection change rebuilds the kitchen (`wireRebuild`, `offline/start.js`); a sent write pulls its collection |
| per-recipe `keepItem(dishPath)` + ingredient paths, a reread of kept dishes after every read (`kept-refresh.js`) | `collection("dishes").keep(id)` + `collection("ingredients").keep(id)` (`api/recipe-keep.js`, `offline/keep-plan.js`); the feed keeps kept records current; `fillKeptGaps` fetches a dish kept while offline and a newly named ingredient |
| the gone check: a 404 on the kept dish's item route (`offline/gone.js`) | the kit applies the feed's delete; Kitchen only notices a kept dish that left without its own doing and says so (`api/recipe-gone.js`) |
| settings `PATCH /data/settings`, not kept per recipe | `PATCH /data/settings/kitchen` with the item's rev; the item is always kept |
| kept as it was | `keepAll` default on; the freezer take as `chassisData.post` with `Idempotency-Key` plus `applyTakes`; Undo (a waiting delete dropped from the queue, the record comes back from the database); creates online-only; the kit's failed list and band |

Not the collection's own writes: `put`/`patch`/`delete` name the record's NEWEST revision, so after a background pull a
save made over another device's newer version would go through. Kitchen keeps `writeJson` (`chassisData.put/patch/
delete` on the same item paths, the revision the page read); the kit's overlay still shows them (it reads the queue by
path). Filed as a kit wish: an explicit `rev` option on the collection writes. The take stays a POST (a `patch` of
`portions` refuses the second of two offline takes, D3).

"Keep everything" off has no counterpart in the kit's design for ONLINE reads (the database holds only the kept keys):
Kitchen reads `GET /data/kitchen` straight from the service there and lays the kept items' waiting edits over it
(`overServer`); offline the kept items are the kitchen. Asked in docs/OPEN.md release check 16 "Held" (3).

## What the kit offers (v4.5.0)

- **App database**: `App::app_db(AppDbSpec::new(migrations).with_import(hook))`. Kitchen already opens `kitchen.db`
  (no migrations, only the kit's synced-preferences table). The file opens at `App::run` start, not before: today
  `Store::open` runs before `run`, so the store must take the `AppDb` handle and use it from the first request on.
  Writes are `app_db.write(|tx| ..)` (`BEGIN IMMEDIATE`, one writer), reads `app_db.read(|conn| ..)`.
- **One-time import**: the hook runs once after the migrations, in ONE transaction, with `ImportContext::read_json`.
  `ImportReport::from_stores(vec![ImportStore::new("dishes", expected, imported).moved(files)])` checks each count; a
  mismatch or an error rolls everything back, `app_db.import_state()` is `Failed { why }`, a Storage problem is shown,
  the next start retries. Only files of stores marked `moved` are renamed `*.migrated` after the commit.
- **Change log + feed**: `app.sync_collection(SyncCollection::new("dishes").key("id").rev("rev").index(..)
  .routes("/data/dishes", "/data/dishes/:id").shared())`, `app.sync_load(impl SyncLoad)` (current bodies by key),
  and in every write transaction `tx.sync_upsert("dishes", &id, rev)` / `tx.sync_delete(..)`. The kit serves
  `GET /api/sync` and `GET /api/sync/<name>?since=` behind the login, with tombstones kept 30 days.
- **Device-made ids**: `client_key(&body.id)` and `check_create(held, sent_key, recorded_key)` (`Create`, `Replay`,
  409 `exists`); the app stores the idempotency key with the item.
- **Page**: `chassisData.configure({ name, db: true })`; `chassisData.db.collection(name)` with `get`, `all`,
  `where(index).equals/between/startsWith`, `sortBy`, `limit`, `count`, `watch`, `create`, `put`, `patch`, `delete`,
  `keep(key, on)`, `sync`. Writes ride chassisData's existing queue, failed list and band, with `If-Match` = the
  stored record's rev; queued writes are an overlay on reads; after a sent write the collection is pulled. "Keep
  everything" is the kit's existing `keepAll`; with it off only `keep`-ed keys are stored.

## Decision A: the table layout

Today every list is an ordered array of free-form JSON objects; the server checks names, limits and ids, the shape
belongs to the pages (`store/mod.rs` doc). Undo puts an item back at its old place, so order matters.

- **A1, one table per list, same shape** (`dishes`, `dish_categories`, `ingredients`, `ingredient_categories`,
  `freezer`, `shelf`, `log`, `resting`, `drafts`, `recipe_sources`), each `(id TEXT PRIMARY KEY, pos INTEGER NOT NULL,
  rev INTEGER NOT NULL, body TEXT NOT NULL)`, made by one migration from the fixed list `COLLECTIONS`. Plus `settings`
  (one row) and `answered` (idempotency keys).
  ```rust
  // migrations: one statement per list, names only from the compile-time COLLECTIONS list, never from a request
  "CREATE TABLE dishes (id TEXT PRIMARY KEY, pos INTEGER NOT NULL, rev INTEGER NOT NULL, body TEXT NOT NULL)"
  app.storage_kind(DataKind::new("dishes", "Dishes").table("dishes"));   // a row per list on the Storage page
  ```
  Pro: the Storage page shows each list with its own count; matches LOCAL_DB_DESIGN "What each app changes";
  a broken list stays in its own table. Con: ten near-identical tables; the SQL takes the table name from a whitelist.
- **A2, one document table** `items(list TEXT, id TEXT, pos INTEGER, rev INTEGER, body TEXT, PRIMARY KEY(list, id))`.
  ```rust
  tx.execute("UPDATE items SET body = ?3, rev = ?4 WHERE list = ?1 AND id = ?2", params![list, id, body, rev])?;
  ```
  Pro: one migration, one set of statements, closest to today's generic `Data::collection(name)`. Con: one Storage
  page row for everything; every query carries `list`.
- **A3, real columns per field** (a `recipes`, `steps`, `ingredient_lines` table ...). Pro: SQL can query inside a
  recipe. Con: the server would own the recipe shape the pages own today, a much larger migration (every nested list
  becomes a table), every page field addition becomes a schema migration. Not recommended.

**Recommendation: A1.** Same generic code as A2 (the table name is the list name, checked against `COLLECTIONS`), but
each list visible and countable on the Storage page. Cost: low migration risk (the body is today's object byte for
byte, as `serde_json`), `pos` keeps the array order and Undo's place.

## Decision B: recipes inside their dish, or a collection of their own

Today a recipe is one entry of `dish.recipes`; saving a recipe is a `PUT` of its dish with the dish's `rev`
(`dish_rev` on the recipe view).

- **B1, keep recipes embedded** (one synced collection `dishes`). The recipe view stays a page-side view over the
  dish (`web/js/api/recipe-view.js`), the editor keeps sending `dish_rev`, the stale toast and "Keep my version as a
  draft" are untouched. Per-recipe keeping keeps the dish, as today.
  ```js
  const dish = await db.collection("dishes").get(dishId);           // recipes ride along
  await db.collection("dishes").put(dishId, { ...dish, recipes });  // If-Match = the dish's rev, as today
  ```
- **B2, a `recipes` collection** keyed by recipe id with `dish_id`, its own `rev`. Pro: a local `where("meals")`
  query, a recipe saved without touching its siblings. Con: a domain change (rev per recipe instead of per dish,
  the parents' wheel and photo GC read across two lists, a dish delete must cascade), a data migration that splits
  every dish, and the "rev identical" rule broken by definition.

**Recommendation: B1.** It is the only option that keeps revisions identical and the domain untouched; Kitchen has
tens of recipes, so filtering in page code after `all()` costs nothing.

## Decision C: item `rev` and `settings_rev` on the kit's revision

The kit's feed carries `rev` per key (`u64`), the page sends it back as `If-Match`; Kitchen's `rev` is "absent = 0,
every replace +1", checked by `chassis::core::revision::check` (also on delete), and the settings have one
`settings_rev` for all keys.

- **C1, items as they are, settings as a one-item collection.** The `rev` column holds `rev_of(item)` (absent = 0);
  the import writes `"rev": 0` into the body of an item that had none, so body and feed always agree (the page reads
  `rev` from `data`). Settings become a synced collection `settings` with one item `{id: "kitchen", rev:
  settings_rev, ..keys}`, item route `/data/settings/:id` (PATCH merges, `null` removes, `If-Match` = settings_rev);
  `GET`/`PATCH /data/settings` stay for compatibility.
  ```rust
  SyncCollection::new("settings").routes("/data/settings", "/data/settings/:id").shared()
  ```
  ```js
  await db.collection("settings").patch("kitchen", { pace: "slow" });  // If-Match = settings_rev
  ```
  Pro: one road for everything; a recipe kept alone also has its settings offline (today it falls back to the
  default timer sound). Con: a new route, and the settings object gains `id`/`rev` fields on that route only.
- **C2, items as C1, settings stay on chassisData's response cache** (`/data/settings` in `routes`, as
  LOCAL_DB_DESIGN says "Drafts and settings become tables too, outside the sync manifest"). Pro: no new route.
  Con: two kinds of kit storage on one page (both the kit's, so not two layers, but two code paths in Kitchen).
- **C3, renumber on import** (every item and the settings start at rev 1). Pro: no zero revisions. Con: changes the
  stored revisions; no gain, since `revision::check` treats 0 like any number. Not recommended.

**Recommendation: C1.** No live device holds queued edits with old revisions (live 5.0.0 has no offline queue; 6.0.0
was never deployed), so nothing in flight can be invalidated by the move either way.

## Decision D: what the kit's local database replaces on the page

Kitchen's adapter today (`web/js/offline/`, `web/js/api/kit-data.js`): `/data/kitchen` whole in the kit's response
cache; `keepAll` default on; per-recipe `keepItem(dishPath)` plus the ingredients the dish names; a "gone" check for
kept dishes; a re-read of kept dishes after every online kitchen read; `applyQueued` laying queued PUT/DELETE/PATCH and
freezer takes over every read; the freezer take as `chassisData.post` with an `Idempotency-Key`; the kit's failed list.

- **D1, full move this release.** Every screen gets the kitchen from collections: `loadKitchen` builds today's
  kitchen object from `all()` of each collection (sorted by `pos`) and the settings item, so the screens do not change.
  ```js
  const lists = await Promise.all(LISTS.map((n) => db.collection(n).all()));
  const kitchen = assemble(lists, await db.collection("settings").get("kitchen"));  // same shape as GET /data/kitchen
  ```
  Goes: the `/data/kitchen` cache route, `applyQueued` for PUT/DELETE/PATCH (the kit's overlay does it), the gone
  check (the feed's tombstones delete), `kept-refresh.js` (the feed keeps kept items current), `keepItem` (becomes
  `collection("dishes").keep(id)` and `collection("ingredients").keep(..)`). Stays: `keepAll` default on, the kit's
  failed list and band, the freezer take as `chassisData.post` with `Idempotency-Key` plus Kitchen's small `takeFrom`
  overlay (the kit's overlay covers only collection writes; filed gap), `api/save.js`'s choice of revision. New:
  creates work offline (device UUIDs, server `client_key` / `check_create`). Con: the largest page change; every
  offline e2e scenario is re-run.
- **D2, server now, pages next release.** This release moves only persistence (and serves the feeds); the pages keep
  today's adapter on `/data/kitchen` unchanged. Pro: the data move and the page move each fail alone; the move itself
  is invisible to the pages. Con: two releases; offline creates and the per-recipe settings wait.
- **D3, freezer take as a collection patch** (an option inside D1): `collection("freezer").patch(id, {portions: n - 1})`
  with `If-Match`. Pro: no Kitchen overlay at all. Con: a behaviour change: two devices that each take one portion
  offline today both succeed while portions remain; under D3 the second is refused as stale. Not recommended.

**Recommendation: D2, then D1 (with the take kept as a POST).** The data move is the risky part (Kenny's rule: no data
loss); doing it with the pages unchanged means the existing offline tests and e2e scenarios check that nothing moved
for the pages. The feed costs nothing while no page pulls it.

## Decision E: when the import fails

The kit rolls a failed import back and "the app keeps running on its old files" until the next start. Kitchen must say
what that means.

- **E1, keep the file adapter for one release**: `Store` picks its persistence at start from
  `app_db.import_state()`: `Done` uses the database; `Failed` keeps reading and writing `kitchen.json` exactly as
  today (the existing, tested code), with the kit's Storage problem showing; the next start retries from the file as
  it then is. Removed in the release after.
- **E2, refuse to serve data**: the data routes answer 503 with the problem's words until the import succeeds.
  Pro: one persistence path. Con: Kitchen is down until someone fixes the file.

**Recommendation: E1.** It is the kit's documented contract and loses nothing; the file adapter is today's code.

## Not open: the import, backup, verification and rollback (code after A to E are answered)

1. **Both start states, one step**: live 5.0.0 (`kitchen.json` FORMAT 5 without `rev`, `settings_rev`, `answered`;
   `kitchen-kit.db` at kit schema 2) and 6.0.0 (optional `rev`, `settings_rev`, `answered`; kit schema 3) both go
   straight to the next release. The hook parses `Data` as today (every new field is `serde(default)`), runs
   `migrate` when `format < 5`, fills `recipe_sources` from the seed when absent, then inserts.
2. **Backup first**: before parsing, the hook copies `kitchen.json` to `kitchen.json.pre-db` (copy + fsync, only when
   that name does not exist yet, so a retried import never overwrites the first copy). `kitchen-kit.db` and
   `kitchen.db` are covered by the kit's pre-update copy and by the manual backup in the deploy note.
3. **Verify inside the transaction**: after the inserts the hook reads every table back in the same transaction,
   rebuilds `Data` and compares it with the parsed file value for value (each list in order, settings, settings_rev,
   answered); one difference is an error and the whole import rolls back. Counts go per list through
   `ImportStore::new(name, expected, imported)`. Only then is the file marked moved, so the kit renames it
   `kitchen.json.migrated` (never deleted) after the commit.
4. **Undo state**: it lives in memory today and stays in memory; a restart (which the update is) drops it, as today.
   A restore re-inserts at the stored `pos` and records `sync_upsert`; a delete records `sync_delete`.
5. **Rollback**: stop the service; save `GET /data/kitchen` of the new version as `kitchen.json` (the same FORMAT 5
   shape, so edits made after the move are kept) or, if the new version does not start, rename
   `kitchen.json.migrated` back (or copy `kitchen.json.pre-db`); restore `kitchen-kit.db` and `kitchen.db` from the
   backup taken before the update; install the previous binary. Written into CHANGELOG Migration with the build.
6. **Idempotency keys**: `answered(key TEXT PRIMARY KEY, answer TEXT, at INTEGER)`, the newest 200 kept, written in the
   take's transaction, as today.

## Fixtures (committed)

`tests/fixtures/db_move/kitchen-4.1.0.json` (4.1.0 shape: no `drafts`, no `recipe_sources`, no recipe `source` or
`*_override`, no step `start`/`with`; derived from the 5.0.0 fixture), `kitchen-5.0.0.json` and `kitchen-6.0.0.json` (revs on some items only,
`settings_rev` 4, two answered keys): every FORMAT 5 part (dishes with two recipes, tracks, timers, `with`, `start`,
step and cover photos, bilingual notes; both category lists, ingredients, freezer incl. an item at 0 portions, shelf,
log with a dish and a shelf line, resting, two drafts, recipe sources with and without a note, all settings keys).

## Tolerant import (coordinator 03/11/2026)

The import accepts any FORMAT 5 `kitchen.json` whichever Kitchen version wrote it (4.1.0, 5.0.0, 6.0.0 shapes): every
list and field that version did not know is absent and defaults (lists empty, `rev` 0, `settings_rev` 0, no answered
keys). Any older kit DB (`kitchen-kit.db`) schema the kit migrates itself is left to the kit; the import reads only
`kitchen.json`. Which version runs live on CT 121 is not measured here (asked the coordinator for the homelab thread).

## Note on the deploy state

Measured 03/11/2026 (coordinator, CT 121 `/healthz`): live is **4.1.0**. The import takes a FORMAT 5 file from 4.1.0,
5.0.0 or 6.0.0 alike; the kit migrates its own `kitchen-kit.db` from whatever schema it finds.
