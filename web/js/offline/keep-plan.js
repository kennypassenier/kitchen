// What "Offline bewaren" on one recipe means for the kit's local database (feat-offline-recipe, Kenny 02/11/2026 17:25
// and 19:12; on `chassisData.db` since feat-db-pages-2). Pure: no fetch, no DOM, no kit, so
// scripts/offline-keep-plan.test.mjs tests it.
//
// A recipe lives in its dish, so the kept key is the DISH (`collection("dishes").keep(id)`); keeping one recipe keeps
// every recipe of that dish, and the toggle's line says so. The ingredients its recipe lines name are kept with it
// (`collection("ingredients").keep(id)`), so the recipe page and cook mode show their names offline. With "keep
// everything" off the local database holds exactly the kept items, so the dishes and ingredients it holds ARE the kept
// ones: an ingredient is let go only when no dish the database still holds names it.

/** @typedef {Record<string, any>} Item */
/** @typedef {"all" | "kept" | "not-kept"} KeepState */

/** What the recipe page's toggle shows: hidden ("all") while everything is kept, else this dish's mark. @param {boolean} all @param {boolean} kept @returns {KeepState} */
export const keepStateOf = (all, kept) => (all ? "all" : kept ? "kept" : "not-kept");

/**
 * The ingredient ids a dish's recipes name (every recipe of the dish: the dish is kept whole), in first-use order.
 * @param {Item | null | undefined} dish @returns {string[]}
 */
export function dishIngredientIds(dish) {
  const ids = new Set();
  for (const r of Array.isArray(dish?.recipes) ? dish.recipes : []) {
    for (const line of Array.isArray(r?.ingredients) ? r.ingredients : []) {
      if (typeof line?.ingredient === "string" && line.ingredient) ids.add(line.ingredient);
    }
  }
  return [...ids];
}

/**
 * The ingredients to let go when `dishId` is no longer kept: its own, minus those another kept dish (one the local
 * database still holds) names. @param {readonly Item[]} keptDishes the dishes the local database holds
 * @param {Item | null | undefined} dish the dish let go @returns {string[]}
 */
export function releasePlan(keptDishes, dish) {
  const used = new Set(keptDishes.filter((d) => d.id !== dish?.id).flatMap(dishIngredientIds));
  return dishIngredientIds(dish).filter((id) => !used.has(id));
}

/**
 * The kept ingredients no kept dish names any more (after a kept dish was deleted on the server, or a line removed):
 * every ingredient the local database holds that no dish it holds names.
 * @param {readonly Item[]} keptDishes @param {readonly Item[]} keptIngredients @returns {string[]}
 */
export function orphanIngredientIds(keptDishes, keptIngredients) {
  const used = new Set(keptDishes.flatMap(dishIngredientIds));
  return keptIngredients.map((i) => i.id).filter((id) => typeof id === "string" && !used.has(id));
}

/**
 * The ingredients the kept dishes name that the device does not hold yet (a line added on another device since the
 * dish was kept): to keep, so their names show offline. @param {readonly Item[]} keptDishes
 * @param {readonly Item[]} keptIngredients @returns {string[]}
 */
export function missingIngredientIds(keptDishes, keptIngredients) {
  const held = new Set(keptIngredients.map((i) => i.id));
  return [...new Set(keptDishes.flatMap(dishIngredientIds))].filter((id) => !held.has(id));
}

/** How many recipes (and dishes) are kept one by one: every recipe of every dish the local database holds. @param {readonly Item[]} keptDishes */
export function keptCount(keptDishes) {
  const recipes = keptDishes.reduce((n, d) => n + (Array.isArray(d.recipes) ? d.recipes.length : 0), 0);
  return { recipes, dishes: keptDishes.length };
}

/**
 * The kept dishes the server deleted (feat-offline-gone, Kenny 02/11/2026 19:43, "Uit kopie halen"): held before a pull,
 * gone after it, and not deleted by this device (a delete made here, sent or still waiting, is the person's own and
 * gets no notice). The kit applies the feed's delete itself; Kitchen only says so.
 * @param {ReadonlySet<string>} before the dish ids the local database held @param {ReadonlySet<string>} after
 * @param {ReadonlySet<string>} ownDeletes dish ids this device deleted @returns {string[]}
 */
export function goneDishIds(before, after, ownDeletes) {
  return [...before].filter((id) => !after.has(id) && !ownDeletes.has(id));
}

/**
 * Remembers which dishes already got the notice, so a dish is announced once even when several pulls overlap.
 * @returns {{ claim: (dishId: string) => boolean }} `claim` is true the first time for a dish, false after
 */
export function createNoticeOnce() {
  const told = new Set();
  return {
    claim(dishId) {
      if (told.has(dishId)) return false;
      told.add(dishId);
      return true;
    },
  };
}
