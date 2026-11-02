// The recipes this device keeps one by one (feat-offline-recipe, Kenny 02/11/2026 17:25 and 19:12: "zowel de hele
// keuken als per recept"). Pure: no fetch, no DOM, no kit, so scripts/offline-kept.test.mjs tests it.
//
// A recipe lives in its dish (api/recipe-view.js), so the kit keeps the DISH: its item route `/data/dishes/{id}`.
// Keeping one recipe therefore keeps every recipe of that dish; the toggle's line says so. What the kit keeps per item
// is its settings' `items`: the kept paths, of which Kitchen only ever writes dish paths.

import { dishPath } from "./config.js";

/** @typedef {import("../api.js").Kitchen} Kitchen */
/** @typedef {{ all: boolean, items: string[] }} KeepSettings the kit's `settings()` */
/** @typedef {"hidden" | "all" | "kept" | "not-kept"} KeepState */

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
 * What the recipe page's toggle shows for a dish: "hidden" while per-recipe keeping is not live (config.js
 * PER_RECIPE_KEEP), "all" when "keep everything" is on (the toggle is hidden: everything is kept), else whether this
 * dish is kept.
 * @param {KeepSettings} settings @param {string} dishId @param {boolean} perRecipe @returns {KeepState}
 */
export function keepStateOf(settings, dishId, perRecipe) {
  if (!perRecipe) return "hidden";
  if (settings.all) return "all";
  return settings.items.includes(dishPath(dishId)) ? "kept" : "not-kept";
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
 * Every other list is empty (the log, the freezer, the shelf …: not kept), and `partial` says so, so a page that needs
 * more than the recipe can tell.
 * @param {{ dishes: Record<string, any>[], ingredients: Record<string, any>[], settings: Record<string, any> }} parts
 * @returns {Kitchen & { partial: true }}
 */
export function partialKitchen({ dishes, ingredients, settings }) {
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
    settings,
  };
}
