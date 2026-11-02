// What Kitchen hands the kit's offline data client (`chassisData.configure`, chassis-rs feat-offline-1). Config only:
// no fetch, no DOM. docs/agent/DATA.md "Offline copy" says what each value means for the kitchen's data.

/** The IndexedDB database the kit keeps the copy and the queue in: `chassis-data:kitchen`. */
export const OFFLINE_NAME = "kitchen";

/** The field of an item that carries its revision (docs/agent/DATA.md "Revisions and stale saves"). */
export const REV_FIELD = "rev";

/** The whole kitchen in one answer: every screen reads it (web/js/api.js `loadKitchen`). */
export const KITCHEN_PATH = "/data/kitchen";

/** One dish with its recipes (`GET /data/{list}/{id}`, feat-offline-recipe-1): an item route to the kit. */
export const DISH_ROUTE = "/data/dishes/:id";

/** The path of the dish with `id`, as the kit keeps it. @param {string} id */
export const dishPath = (id) => `/data/dishes/${encodeURIComponent(id)}`;

/** The ingredients list, and one ingredient (`GET /data/{list}/{id}`): the names every recipe line points at. */
export const INGREDIENTS_PATH = "/data/ingredients";
export const INGREDIENT_ROUTE = "/data/ingredients/:id";

/** The path of the ingredient with `id`, as the kit keeps it. @param {string} id */
export const ingredientPath = (id) => `/data/ingredients/${encodeURIComponent(id)}`;

/**
 * The GET answers the kit may keep a copy of (chassis-rs 8042dbe, trimmed keeping). With "keep everything" on the kit
 * stores every one whole; with it off it stores only kept items, and a list route only trimmed to its kept items:
 * - `/data/kitchen`, the whole kitchen every screen draws from. A list with no item route below it, so the kit stores
 *   it only while "keep everything" is on: keeping one recipe never keeps the kitchen.
 * - `/data/dishes/:id`, one dish with its recipes: what the recipe page's "Keep offline" keeps (a recipe lives in its
 *   dish).
 * - `/data/ingredients` with `/data/ingredients/:id`: the names a kept recipe's lines point at. The switch keeps each
 *   ingredient the dish uses, so the list is stored trimmed to those.
 * The settings (`/data/settings`, one object, no item route) are not kept per recipe: offline, a kept recipe's cook
 * mode uses the default timer sound.
 */
export const OFFLINE_ROUTES = Object.freeze([KITCHEN_PATH, DISH_ROUTE, INGREDIENTS_PATH, INGREDIENT_ROUTE]);

/**
 * The kit's own words (its connection-band toasts and its logout confirmation) in the page's language. Getters, so the
 * logout dialog, which reads them each time it opens, follows a language change; the band's toasts read them once
 * when the kit binds them, so they keep the language the page started in until the next load (a kit gap, docs/OPEN.md).
 * @param {(key: string, ...args: any[]) => string} t
 */
export function kitMessages(t) {
  return {
    get conflict() { return t("off.kitConflict"); },
    get conflictHeld() { return t("off.kitConflictHeld"); },
    get review() { return t("off.kitReview"); },
    nearCap: (/** @type {number} */ pct) => t("off.kitNearCap", pct),
    get full() { return t("off.kitFull"); },
    get refused() { return t("off.kitRefused"); },
    get expired() { return t("off.kitExpired"); },
    get title() { return t("off.logoutTitle"); },
    body: (/** @type {number} */ n) => t("off.logoutBody", n),
    get accept() { return t("off.logoutAccept"); },
    get stay() { return t("off.logoutStay"); },
  };
}

/**
 * The options for `chassisData.configure`. The size cap, its warning level and the retry timer are the kit's defaults
 * (50 MB, 80 %, 30 s): the whole kitchen is far below the cap, and the kit's numbers are documented in one place.
 * @param {(key: string, ...args: any[]) => string} t the page's words
 */
export function offlineOptions(t) {
  return { name: OFFLINE_NAME, rev: REV_FIELD, routes: [...OFFLINE_ROUTES], messages: kitMessages(t) };
}
