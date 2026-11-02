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

/**
 * What a recipe kept on its own needs besides its dish (feat-offline-recipe): the ingredient names (the recipe page,
 * the printable sheet and cook mode's mise en place name every line by its ingredient id) and the settings (cook
 * mode's timer sound). Both are list routes to the kit, so the kit keeps them as soon as one dish is kept; both are
 * small (tens of ingredients, a handful of settings).
 */
export const LOOKUP_PATHS = Object.freeze(["/data/ingredients", "/data/settings"]);

/**
 * Whether the per-recipe toggle "Offline bewaren" is live (Kenny 02/11/2026 17:25 and 19:12, option B). OFF while
 * Kitchen runs on chassis-rs 4.3.0: that kit keeps EVERY list route as soon as one item is kept ("a list is the way
 * to a kept item", chassis-rs docs/OFFLINE_DESIGN.md), and `/data/kitchen` is a list route, so keeping one recipe
 * would keep the whole kitchen while the toggle said "this recipe". Kitchen never claims what the kit does not do, so
 * the toggle, the per-recipe read and the settings count wait for the kit release with per-item keep (a list route
 * kept only by "keep everything"); the remaining wiring is the bump row in docs/OPEN.md.
 */
export const PER_RECIPE_KEEP = false;

/**
 * The GET answers the kit may keep a copy of. The whole kitchen first: every screen draws from it, so with "keep
 * everything" on, one copy serves every page offline. With per-recipe keeping live, also the dish item route and the
 * lookups a kept recipe needs. A route without `:id` is a list route to the kit.
 * @param {boolean} perRecipe {@link PER_RECIPE_KEEP}
 * @returns {string[]}
 */
export function offlineRoutes(perRecipe) {
  return perRecipe ? [KITCHEN_PATH, DISH_ROUTE, ...LOOKUP_PATHS] : [KITCHEN_PATH];
}

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
  return { name: OFFLINE_NAME, rev: REV_FIELD, routes: offlineRoutes(PER_RECIPE_KEEP), messages: kitMessages(t) };
}
