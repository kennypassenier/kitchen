// The recipes as a view over the dishes (no state: api.js passes the kitchen in).

import { nameOf, lang, t } from "../i18n/index.js";

/** @typedef {Record<string, any>} Item */
/** @typedef {import("../api.js").Kitchen} Kitchen */

// The recipes are a view (Kenny, 24/10/2026 09:18, 09:27: "the recipe belongs to the dish", and a dish may have
// several): the store keeps them in their dish (`dish.recipes`, one `default`); every screen that reads `k.recipes`
// sees all of them, each with its own id, its dish (`dish_id`) and a name made of the dish's name and, when the dish
// has more than one or it has a label, its label ("Stoofvlees · Oven"). A create, replace or remove on "recipes"
// goes to the dish.

/** The recipe fields a dish keeps for it; the view's name, dish and dates are not stored. @param {Item} r */
export function recipeBody(r) {
  const { name, created, updated, isNew, dish_id, dishName, new_dish, ...body } = r;
  return body;
}

/** A recipe's own label in the language shown, else its other half, else "Recipe n". @param {Item} r @param {number} i */
export function recipeLabel(r, i) {
  const own = String(r.label?.[lang()] || r.label?.[lang() === "nl" ? "en" : "nl"] || "").trim();
  return own || t("recipes.numbered", i + 1);
}

/** All recipes of all dishes, as recipes. @param {Kitchen} k */
export function recipeView(k) {
  return (k.dishes ?? []).flatMap((d) => {
    const list = Array.isArray(d.recipes) ? d.recipes : [];
    const dish = nameOf(d).text;
    return list.map((r, i) => {
      const own = String(r.label?.[lang()] || r.label?.[lang() === "nl" ? "en" : "nl"] || "").trim();
      return { ...r, dish_id: d.id, dishName: dish, name: list.length > 1 || own ? `${dish} · ${recipeLabel(r, i)}` : dish, created: d.created, updated: d.updated };
    });
  });
}
