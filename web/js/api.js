// The kitchen's JSON API (src/routes.rs) and the one copy of its data.
//
// The kitchen is READ from the kit's local database (`chassisData.db`, api/kitchen-read.js, feat-db-pages-1), which the
// kit keeps in step with the server and lays its waiting edits over. Writes that name a revision (PUT), the settings
// PATCH and a DELETE go through the kit's queue (api/kit-data.js): If-Match, and `queued` when the service cannot be
// reached; a queued edit is applied to the shared copy as it was sent. A POST (create, draft, import, restore) needs a
// connection (the server issues the ids); the freezer take is the one POST through the kit (api/quick-writes.js).
//
// Every screen reads the kitchen through `loadKitchen()` and changes it through the calls below; a change updates the
// shared copy and tells every listener; a pull the kit made by itself builds the copy again (offline/start.js). A
// failure is an `ApiError` whose message is fit to show as it is.

/** @typedef {Record<string, any>} Item */
/** @typedef {{ format: number, recipes: Item[], freezer: Item[], shelf: Item[], log: Item[], resting: Item[], dishes: Item[], dish_categories: Item[], ingredients: Item[], ingredient_categories: Item[], drafts?: Item[], recipe_sources?: Item[], settings: Record<string, any>, settings_rev?: number }} Kitchen */

import { onLang } from "./i18n/index.js";
import { ApiError, call } from "./api/http.js";
import { recipeBody, recipeView } from "./api/recipe-view.js";
import { deleteRevFor, ifMatchFor } from "./api/save.js";
import { kitData, writeJson } from "./api/kit-data.js";
import { readKitchen } from "./api/kitchen-read.js";
import { leftHere } from "./api/recipe-gone.js";
import { parkDeleted, unqueueDelete } from "./offline/undo.js";

export { ApiError, reason } from "./api/http.js";
export { recipeLabel } from "./api/recipe-view.js";
export { recipeById, daysSinceCooked, ingredientById, ingredientName, defaultRecipe } from "./api/lookups.js";

/** @type {Kitchen | null} */
let copy = null;
/** @type {Promise<Kitchen> | null} */
let pending = null;
/** @type {Set<(k: Kitchen) => void>} */
const listeners = new Set();

function tell() {
  if (!copy) return;
  copy.recipes = recipeView(copy);
  for (const fn of listeners) fn(copy);
}

// A recipe's name is its dish's name in the language shown: read it again when the language changes.
onLang(() => {
  if (copy) copy.recipes = recipeView(copy);
});

/**
 * The whole kitchen; read once and shared. `force` reads it again (Retry): the kit pulls the server's changes first.
 * `pull: false` (with `force`) builds it again from what the local database holds now, after the kit pulled by itself.
 * @param {{ force?: boolean, pull?: boolean }} [opts]
 * @returns {Promise<Kitchen>}
 */
export function loadKitchen({ force = false, pull = true } = {}) {
  // A read in flight is newer than the held copy, so it goes first.
  if (pending && !force) return pending;
  if (copy && !force) return Promise.resolve(copy);
  pending = readKitchen({ pull }).then(
    ({ kitchen: k }) => {
      copy = k;
      copy.recipes = recipeView(k);
      pending = null;
      tell();
      return k;
    },
    (e) => {
      pending = null;
      throw e;
    },
  );
  return pending;
}

/** The kitchen as last read, or null. */
export const kitchenNow = () => copy;

/**
 * @param {(k: Kitchen) => void} fn called after every change
 * @returns {() => void} stop listening
 */
export function onKitchen(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Put `item` in the shared copy's `list` (replacing the one with its id, or at the end) and tell every listener.
 * Exported for api/quick-writes.js. @param {string} list @param {Item} item
 */
export function put(list, item) {
  if (!copy) return;
  const arr = /** @type {Item[]} */ (copy[/** @type {keyof Kitchen} */ (list)]);
  const at = arr.findIndex((x) => x.id === item.id);
  if (at >= 0) arr[at] = item;
  else arr.push(item);
  tell();
}

/**
 * Put the settings (and, when known, their revision) in the shared copy and tell every listener. Exported for
 * api/quick-writes.js. @param {Record<string, unknown>} settings @param {number | null} rev
 */
export function putSettings(settings, rev) {
  if (!copy) return;
  copy.settings = settings;
  if (rev !== null) copy.settings_rev = rev;
  tell();
}

/** Add an item to a list; resolves to the item with its new id. @param {string} list @param {Item} body */
export async function create(list, body) {
  if (list === "recipes") {
    // A new recipe goes into a dish and never makes one silently (Kenny, 29/10/2026): `dish_id` is the dish it joins,
    // `new_dish` ({nl, en}, both halves) a dish made together with it; neither is an error. `label` is the recipe's own
    // label ({nl, en}; both halves or none).
    const at = body.dish_id ? copy?.dishes.find((d) => d.id === body.dish_id) : null;
    const id = crypto.randomUUID();
    const label = { nl: String(body.label?.nl ?? ""), en: String(body.label?.en ?? "") };
    if (at) {
      const list = Array.isArray(at.recipes) ? at.recipes : [];
      await replace("dishes", { ...at, recipes: [...list, { ...recipeBody(body), id, label, default: !list.some((r) => r.default === true) }] });
    } else if (body.new_dish?.nl && body.new_dish?.en) {
      await create("dishes", { name: { nl: String(body.new_dish.nl), en: String(body.new_dish.en) }, category: null, parents: false, ingredients: [], sides: [], recipes: [{ ...recipeBody(body), id, label, default: true }] });
    } else {
      throw new ApiError("A recipe belongs to a dish: pick one, or name a new one.", 400);
    }
    return copy?.recipes.find((r) => r.id === id) ?? { ...body, id };
  }
  const item = await call("POST", `/data/${list}`, body);
  put(list, item);
  return item;
}

/**
 * Replace an item whole. Every replace is checked against the revision the page read (fix-stale-save-1, fix-quick-rev-1):
 * `ifMatch` when the caller gives one (the recipe editor's `dish_rev`, the dish drawer's `rev`), else the revision the
 * body carries (api/save.js `ifMatchFor`). The server refuses a save made over someone else's with an ApiError of code
 * "stale" and changes nothing; a quick action shows that through api/stale-notice.js `saveFailed`.
 * @param {string} list @param {Item} item @param {{ ifMatch?: number }} [o]
 */
export async function replace(list, item, { ifMatch } = {}) {
  if (list === "recipes") {
    // A recipe saved is its dish saved. When `dish_id` names another dish the recipe MOVES (Kenny, 29/10/2026): it is
    // added to the new dish first (the default only when that dish had none), then taken off the old one, whose first
    // remaining recipe becomes the default when the moved one was it. `label` ({nl, en}) replaces the label when given.
    const dish = copy?.dishes.find((d) => (d.recipes ?? []).some((/** @type {Item} */ r) => r.id === item.id));
    if (!dish) throw new ApiError("That recipe does not exist (any more).", 404);
    // The dish's revision as the caller read it (the recipe view's `dish_rev`), not the copy's, which may be newer.
    const rev = ifMatchFor("recipes", item, { explicit: ifMatch, held: dish });
    const list = /** @type {Item[]} */ (dish.recipes);
    const old = /** @type {Item} */ (list.find((r) => r.id === item.id));
    const label = item.label ? { nl: String(item.label.nl ?? ""), en: String(item.label.en ?? "") } : { ...(old.label ?? { nl: "", en: "" }) };
    const target = item.dish_id && item.dish_id !== dish.id ? copy?.dishes.find((d) => d.id === item.dish_id) : null;
    if (item.dish_id && item.dish_id !== dish.id && !target) throw new ApiError("That dish does not exist (any more).", 404);
    if (target) {
      const there = Array.isArray(target.recipes) ? target.recipes : [];
      const moved = { ...recipeBody(item), id: item.id, label, default: !there.some((/** @type {Item} */ r) => r.default === true) };
      await replace("dishes", { ...target, recipes: [...there, moved] });
      const rest = list.filter((r) => r.id !== item.id);
      if (rest.length && !rest.some((r) => r.default === true)) rest[0] = { ...rest[0], default: true };
      try {
        await replace("dishes", { ...dish, recipes: rest }, { ifMatch: rev });
      } catch (e) {
        // Take the copy out of the target again (not in both dishes); if that fails too, say so where it can be found. The
        // target as saved a moment ago (its revision went up), so the take-back is not refused as stale.
        const added = copy?.dishes.find((d) => d.id === target.id) ?? target;
        await replace("dishes", { ...added, recipes: there }).catch((undo) => console.warn(`moving recipe ${item.id}: the copy in dish ${target.id} could not be taken back`, undo));
        throw e;
      }
    } else {
      await replace("dishes", { ...dish, recipes: list.map((r) => (r.id === item.id ? { ...recipeBody(item), id: item.id, label, default: old.default === true } : r)) }, { ifMatch: rev });
    }
    return copy?.recipes.find((r) => r.id === item.id) ?? item;
  }
  const held = /** @type {Item[] | undefined} */ (copy?.[/** @type {keyof Kitchen} */ (list)])?.find?.((x) => x.id === item.id);
  const rev = ifMatchFor(list, item, { explicit: ifMatch, held });
  const { data, queued } = await writeJson("PUT", `/data/${list}/${encodeURIComponent(item.id)}`, item, rev);
  // Queued: the copy shows the edit as sent; its revision stays the one it was read at, which the queued edit names.
  const saved = queued ? { ...item } : data;
  put(list, saved);
  return saved;
}

/**
 * Remove an item; resolves to what was removed (keep it for Undo). The delete names the revision the page holds, so one
 * made over a newer save elsewhere is refused with an ApiError of code "stale" (fix-offline-master-5).
 * @param {string} list @param {string} id
 */
export async function remove(list, id) {
  if (list === "recipes") {
    // Removing a recipe takes it off its dish; the dish stays, and its first other recipe becomes the default.
    const dish = copy?.dishes.find((d) => (d.recipes ?? []).some((/** @type {Item} */ r) => r.id === id));
    if (!dish) throw new ApiError("That recipe does not exist (any more).", 404);
    const was = copy?.recipes.find((r) => r.id === id);
    const rest = /** @type {Item[]} */ (dish.recipes).filter((r) => r.id !== id);
    if (rest.length && !rest.some((r) => r.default === true)) rest[0] = { ...rest[0], default: true };
    await replace("dishes", { ...dish, recipes: rest });
    return was;
  }
  const held = /** @type {Item[] | undefined} */ (copy?.[/** @type {keyof Kitchen} */ (list)])?.find?.((x) => x.id === id);
  // Checked against the revision this page read (fix-offline-master-5): a stale delete, sent now or replayed later, is
  // refused instead of removing a version saved elsewhere since.
  const { data, queued } = await writeJson("DELETE", `/data/${list}/${encodeURIComponent(id)}`, undefined, deleteRevFor(held));
  // Queued: what the page held is what will be removed, so Undo has it (and can take the waiting delete back).
  const gone = queued ? held : data;
  if (queued) parkDeleted(list, held);
  if (list === "dishes") leftHere(id); // its leaving the local database is this device's doing: no "gone" notice
  if (copy) {
    const arr = /** @type {Item[]} */ (copy[/** @type {keyof Kitchen} */ (list)]);
    const at = arr.findIndex((x) => x.id === id);
    if (at >= 0) arr.splice(at, 1);
    tell();
  }
  return gone;
}

/**
 * Undo of a delete (Kenny, 01/11/2026 20:21): the server puts the removed item back at its place under the same id,
 * within its undo window (src/store/undo.rs); `at` is where the shared copy held it. Resolves to the item. No If-Match
 * (fix-quick-rev-1, decided): a deleted item has no newer version to overwrite. The server puts back exactly what it
 * removed, with its `rev`, and answers 409 when the id is back already, so a restore can never silently replace a save.
 * (Undo of a recipe is a dish save, `replace`, and is checked like any other.)
 * @param {string} list @param {string} id @param {number} at
 */
export async function restore(list, id, at) {
  // A delete still waiting in the kit's queue is taken back there: the server never deleted the item (offline/undo.js),
  // and the item comes back as the local database holds it, which is the server's version (fix-offline-master-4).
  const kit = await kitData();
  const unsent = await unqueueDelete(kit, (l, key) => kit.db.collection(l).get(key), list, id);
  if (unsent.dropped && !unsent.item) return { id };
  const item = unsent.item ?? (await call("POST", `/data/restore/${list}/${encodeURIComponent(id)}`));
  if (copy) {
    const arr = /** @type {Item[]} */ (copy[/** @type {keyof Kitchen} */ (list)]);
    if (!arr.some((x) => x.id === id)) arr.splice(Math.min(Math.max(0, at), arr.length), 0, item);
    tell();
  }
  return item;
}

export { readDraft, readDrafts, saveDraft, deleteDraft } from "./api/drafts.js";
export { importRecipe, readWheelEnglish, readWheelDutch } from "./api/server-reads.js";

export { takePortions, patchSettings } from "./api/quick-writes.js";

/** Make a recipe its dish's default (the wheel's and Cook this's). @param {string} id */
export async function makeDefaultRecipe(id) {
  const dish = copy?.dishes.find((d) => (d.recipes ?? []).some((/** @type {Item} */ r) => r.id === id));
  if (!dish) throw new ApiError("That recipe does not exist (any more).", 404);
  await replace("dishes", { ...dish, recipes: dish.recipes.map((/** @type {Item} */ r) => ({ ...r, default: r.id === id })) });
}
