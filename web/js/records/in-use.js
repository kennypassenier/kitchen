// What still uses an item, and the Delete that is off while it does (Kenny, 01/11/2026 20:21, "Knop uit"): a dish
// category with dishes, an ingredient in a dish or a recipe, an ingredient category with ingredients cannot go, and its
// Delete says so before it is pressed: the button is disabled and the kit's disabled reason ("Used by 6 dishes") is its
// tooltip and its description for a screen reader. The page attaches the kit's reasons (attachDisabledReasons).

import { kitchenNow, ingredientName } from "../api.js";
import { t, nameOf } from "../i18n/index.js";
import { LISTS, dishHas } from "./lists.js";

/** @typedef {import("./lists.js").List} List */
/** @typedef {import("./lists.js").Item} Item */

/** The dishes, recipes and ingredients that point at an item. @param {List} list @param {Item} item */
function users(list, item) {
  const k = kitchenNow();
  const none = { dishes: /** @type {Item[]} */ ([]), recipes: /** @type {Item[]} */ ([]), ingredients: /** @type {Item[]} */ ([]) };
  if (list === "dish_categories") return { ...none, dishes: (k?.dishes ?? []).filter((d) => d.category === item.id) };
  if (list === "ingredient_categories") return { ...none, ingredients: (k?.ingredients ?? []).filter((i) => i.category === item.id) };
  if (list !== "ingredients") return none;
  return {
    ...none,
    dishes: (k?.dishes ?? []).filter((d) => dishHas(d, item.id)),
    recipes: (k?.recipes ?? []).filter((r) => (r.ingredients ?? []).some((/** @type {Item} */ l) => l.ingredient === item.id)),
  };
}

/** What still points at an item, by name: a category's dishes, an ingredient's dishes and recipes, an ingredient category's ingredients. @param {List} list @param {Item} item */
export function usersOf(list, item) {
  const u = users(list, item);
  if (list === "dish_categories") return u.dishes.map((d) => nameOf(d).text);
  if (list === "ingredient_categories") return u.ingredients.map((i) => ingredientName(i.id));
  return [...u.dishes.map((d) => t("rec.userDish", nameOf(d).text)), ...u.recipes.map((r) => t("rec.userRecipe", r.name))];
}

/** Is `item` still in use so it cannot go? Returns the sentence that says so, naming every user. @param {List} list @param {Item} item */
export function inUse(list, item) {
  const named = usersOf(list, item);
  if (!named.length) return null;
  return t(`list.${list}.inUse`, LISTS[list].name(item), named.length, named.join(", "));
}

/** What uses an item, counted: "2 dishes and 4 recipes"; null when nothing does. @param {List} list @param {Item} item */
export function usageWords(list, item) {
  const u = users(list, item);
  const parts = [
    ...(u.dishes.length ? [t("rec.nDishes", u.dishes.length)] : []),
    ...(u.recipes.length ? [t("rec.nRecipes", u.recipes.length)] : []),
    ...(u.ingredients.length ? [t("rec.nIngredients", u.ingredients.length)] : []),
  ];
  return parts.length ? parts.join(` ${t("common.and")} `) : null;
}

/** The short reason a Delete is off: "Used by 2 dishes and 4 recipes"; null when nothing uses the item. @param {List} list @param {Item} item */
export function inUseReason(list, item) {
  const words = usageWords(list, item);
  return words ? t("rec.usedBy", words) : null;
}

/**
 * Turn a Delete off with its reason while the item is in use, and on again when it is not.
 * @param {HTMLElement} button @param {List} list @param {Item} item
 */
export function markInUse(button, list, item) {
  const why = inUseReason(list, item);
  /** @type {HTMLButtonElement} */ (button).disabled = why !== null;
  if (why) button.setAttribute("data-kp-disabled-reason", why);
  else button.removeAttribute("data-kp-disabled-reason");
}
