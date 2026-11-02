// The recipes this device keeps one by one (feat-offline-recipe, Kenny 02/11/2026 17:25 and 19:12: "zowel de hele
// keuken als per recept"). Pure: no fetch, no DOM, no kit, so scripts/offline-kept.test.mjs tests it.
//
// A recipe lives in its dish (api/recipe-view.js), so the kit keeps the DISH: its item route `/data/dishes/{id}`.
// Keeping one recipe therefore keeps every recipe of that dish; the toggle's line says so. What the kit keeps per item
// is its settings' `items`: the kept paths, which Kitchen writes for dishes and for the ingredients their recipe lines
// point at (the names the recipe page and cook mode show). An ingredient used by two kept dishes stays kept until
// neither is kept (`ingredientPlan`).

import { dishPath, ingredientPath } from "./config.js";

/** @typedef {import("../api.js").Kitchen} Kitchen */
/** @typedef {{ all: boolean, items: string[] }} KeepSettings the kit's `settings()` */
/** @typedef {"all" | "kept" | "not-kept"} KeepState */

const DISH_PATH = /^\/data\/dishes\/([^/?#]+)$/;

/**
 * The ids of the dishes kept one by one, in the order they were kept; any other kept path is left out.
 * @param {readonly string[]} items the kit's kept paths @returns {string[]}
 */
export function keptDishIds(items) {
  /** @type {string[]} */
  const ids = [];
  for (const path of items) {
    const m = DISH_PATH.exec(path);
    if (!m) continue;
    try {
      ids.push(decodeURIComponent(m[1]));
    } catch {
      console.warn("Kitchen: a kept offline path is not a dish path Kitchen wrote; it is skipped.", path);
    }
  }
  return ids;
}

/**
 * What the recipe page's toggle shows for a dish: "all" when "keep everything" is on (the toggle is hidden: everything
 * is kept), else whether this dish is kept.
 * @param {KeepSettings} settings @param {string} dishId @returns {KeepState}
 */
export function keepStateOf(settings, dishId) {
  if (settings.all) return "all";
  return settings.items.includes(dishPath(dishId)) ? "kept" : "not-kept";
}

/**
 * The ingredient ids a dish's recipes point at (every recipe of the dish: the dish is kept whole), in first-use order.
 * @param {Record<string, any> | null | undefined} dish @returns {string[]}
 */
export function dishIngredientIds(dish) {
  const ids = new Set();
  for (const r of Array.isArray(dish?.recipes) ? dish.recipes : []) {
    for (const line of Array.isArray(r.ingredients) ? r.ingredients : []) {
      if (typeof line?.ingredient === "string" && line.ingredient) ids.add(line.ingredient);
    }
  }
  return [...ids];
}

/**
 * Which ingredient paths to keep or let go when a dish is kept or no longer kept. Turning a dish off lets go only the
 * ingredients no other kept dish uses; a kept dish the kitchen no longer holds counts as using nothing.
 * @param {readonly Record<string, any>[]} dishes the kitchen's dishes @param {readonly string[]} items the kit's kept paths
 * @param {string} dishId @param {boolean} on @returns {string[]} ingredient paths to pass to `keepItem(path, on)`
 */
export function ingredientPlan(dishes, items, dishId, on) {
  const own = dishIngredientIds(dishes.find((d) => d.id === dishId));
  if (on) return own.map(ingredientPath);
  const others = new Set(keptDishIds(items).filter((id) => id !== dishId));
  const stillUsed = new Set(dishes.filter((d) => others.has(d.id)).flatMap(dishIngredientIds));
  return own.filter((id) => !stillUsed.has(id)).map(ingredientPath);
}

const INGREDIENT_PATH = /^\/data\/ingredients\/[^/?#]+$/;

/**
 * The kept ingredient paths no kept dish uses any more: what is left over after a kept dish was dropped because the
 * kitchen no longer holds it (its own recipe lines are no longer known, so this sweeps by what the remaining kept
 * dishes use instead of by the dropped dish). A kept dish missing from `dishes` would count as using nothing, so the
 * caller sweeps only when every kept dish is in `dishes`.
 * @param {readonly Record<string, any>[]} dishes the kitchen's dishes @param {readonly string[]} items the kit's kept paths
 * @returns {string[]} ingredient paths to pass to `keepItem(path, false)`
 */
export function orphanIngredientPaths(dishes, items) {
  const kept = new Set(keptDishIds(items));
  const used = new Set(dishes.filter((d) => kept.has(d.id)).flatMap(dishIngredientIds).map(ingredientPath));
  return items.filter((p) => INGREDIENT_PATH.test(p) && !used.has(p));
}

/**
 * How many recipes are kept one by one: every recipe of every kept dish that the kitchen still holds. A kept dish the
 * kitchen no longer has counts as nothing (it shows nothing either).
 * @param {readonly string[]} items the kit's kept paths @param {Pick<Kitchen, "dishes">} kitchen
 * @returns {{ recipes: number, dishes: number }}
 */
export function keptCount(items, kitchen) {
  const kept = new Set(keptDishIds(items));
  let recipes = 0;
  let dishes = 0;
  for (const d of kitchen.dishes ?? []) {
    if (!kept.has(d.id)) continue;
    dishes += 1;
    recipes += Array.isArray(d.recipes) ? d.recipes.length : 0;
  }
  return { recipes, dishes };
}

/**
 * A kitchen made of the kept dishes only, for a read without a connection and without a copy of the whole kitchen.
 * Every other list is empty (the log, the freezer, the shelf …: not kept) and the settings are empty (the pages use
 * their defaults); `partial` says so, so a page that needs more than the recipe can tell.
 * @param {{ dishes: Record<string, any>[], ingredients: Record<string, any>[] }} parts
 * @returns {Kitchen & { partial: true }}
 */
export function partialKitchen({ dishes, ingredients }) {
  return {
    format: 0,
    partial: true,
    recipes: [],
    freezer: [],
    shelf: [],
    log: [],
    resting: [],
    dishes,
    dish_categories: [],
    ingredients,
    ingredient_categories: [],
    settings: {},
  };
}

/**
 * What an online kitchen read asks of the kept recipes so their copies equal the server's answer (fix-offline-master-2,
 * Kenny 02/11/2026 19:43: the server is always the master). The kit copies a dish only when its item route is READ, and
 * `/data/kitchen` is not that route, so without this a kept dish's copy stayed as it was when it was kept.
 * - `dishIds`: the kept dishes the answer still lists, to read again (the kit stores each answer over its copy).
 * - `keep`: ingredient paths those dishes name now but the device does not keep yet (a line added since).
 * - `release`: kept ingredient paths no kept dish names any more; only when every kept dish is in the answer (a missing
 *   one is the gone check's business, and its lines are unknown here, so nothing is let go while one is missing).
 * @param {readonly Record<string, any>[]} serverDishes the dishes the kitchen just answered with
 * @param {readonly string[]} items the kit's kept paths
 * @returns {{ dishIds: string[], keep: string[], release: string[] }}
 */
export function keptRefreshPlan(serverDishes, items) {
  const kept = keptDishIds(items);
  const present = new Set(serverDishes.map((d) => d?.id));
  const dishIds = kept.filter((id) => present.has(id));
  const keptSet = new Set(items);
  const used = new Set(serverDishes.filter((d) => dishIds.includes(d.id)).flatMap(dishIngredientIds).map(ingredientPath));
  const keep = [...used].filter((p) => !keptSet.has(p));
  const release = dishIds.length === kept.length ? orphanIngredientPaths(serverDishes, items) : [];
  return { dishIds, keep, release };
}
