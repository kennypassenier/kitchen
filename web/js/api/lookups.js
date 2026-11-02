// Read-only lookups on the shared kitchen copy (moved out of api.js on 02/11/2026, feat-offline-kitchen, to keep api.js
// to the copy and its writes). No fetch: each reads what `loadKitchen()` last gave; api.js re-exports them, so the pages
// keep importing from "../api.js".

import { kitchenNow } from "../api.js";

/** @typedef {import("../api.js").Item} Item */
/** @typedef {import("../api.js").Kitchen} Kitchen */

/** A recipe by id from the shared copy. @param {string | null} id */
export const recipeById = (id) => kitchenNow()?.recipes.find((r) => r.id === id) ?? null;

/**
 * Days since a dish (or its recipe, which has the dish's id) was last cooked, from the log; Infinity when never.
 * @param {Kitchen} k @param {string} dishId @param {Date} [now]
 */
export function daysSinceCooked(k, dishId, now = new Date()) {
  let last = -Infinity;
  for (const e of k.log) if (e.dish_id === dishId) last = Math.max(last, Date.parse(e.date));
  if (last === -Infinity) return Infinity;
  return Math.floor((now.getTime() - last) / 86_400_000);
}

/** An ingredient by id (Kenny, 24/10/2026 05:15: sides and recipe lines point at one list). @param {string | null | undefined} id */
export const ingredientById = (id) => (id ? kitchenNow()?.ingredients?.find((i) => i.id === id) ?? null : null);

/**
 * An ingredient's name in `lang`, else its other half; an id that points at nothing says so.
 * @param {string | null | undefined} id @param {"en" | "nl"} [lang]
 */
export function ingredientName(id, lang = "en") {
  const i = ingredientById(id);
  if (!i) return lang === "nl" ? "(verwijderd ingrediënt)" : "(deleted ingredient)";
  const other = lang === "nl" ? "en" : "nl";
  return String(i.name?.[lang] || i.name?.[other] || "").trim() || "(no name)";
}

/** A dish's default recipe, or null when it has none. @param {Item | null | undefined} dish */
export const defaultRecipe = (dish) => {
  const list = Array.isArray(dish?.recipes) ? dish.recipes : [];
  return list.find((/** @type {Item} */ r) => r.default === true) ?? list[0] ?? null;
};
