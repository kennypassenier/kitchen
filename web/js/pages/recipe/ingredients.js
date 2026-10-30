// The ingredient list of the recipe card, and the amounts that follow the portions.

import { h } from "../../dom.js";
import { ingredientName } from "../../api.js";
import { amountOf } from "../../recipe/amounts.js";
import { lang } from "../../i18n/index.js";

/** @typedef {Map<string, { amount: HTMLElement, unit: HTMLElement, ing: any }>} Cells The amount cells of the list, by ingredient id. */

/** One line: amount, unit, and the name that links to the ingredient's own page (Kenny, 24/10/2026 05:15). @param {any} ing @param {Cells} cells */
function ingredientLine(ing, cells) {
  const word = h("a", { class: "rp-ing__word", href: `/ingredients/${encodeURIComponent(ing.ingredient ?? "")}` }, ingredientName(ing.ingredient, lang()));
  const name = h("span", { class: "rp-ing__name" }, word);
  // The line's remark ("chopped", an import's brackets) is read on the page, not hidden in a hover (Kenny, 29/10/2026).
  if (ing.note) name.append(h("span", { class: "rp-ing__note" }, ing.note));
  const amount = h("span", { class: "rp-ing__amount" });
  const unit = h("span", { class: "rp-ing__unit" });
  cells.set(ing.id, { amount, unit, ing });
  return h("li", { class: "rp-ing" }, amount, unit, name);
}

/**
 * The list, grouped when the recipe has groups, and the cells to write the amounts into.
 * @param {import("./index.js").RecipeCtx} ctx @param {import("../../recipe/amounts.js").Ingredient[]} ingredients
 * @returns {{ list: HTMLElement, cells: Cells }}
 */
export function buildIngredients(ctx, ingredients) {
  /** @type {Cells} */
  const cells = new Map();
  const groups = [...new Set(ingredients.map((i) => i.group || ""))];
  const list = h("ul", { class: "rp-ings", "aria-label": ctx.words.ingredients(ctx.portions) });
  for (const group of groups) {
    if (groups.length > 1) list.append(h("li", { class: "rp-ings__group" }, h("h4", { class: "kp-fw-semibold" }, group)));
    for (const ing of ingredients.filter((i) => (i.group || "") === group)) list.append(ingredientLine(ing, cells));
  }
  if (ingredients.length === 0) list.append(h("li", { class: "rp-ings__none" }, ctx.words.noIngredients));
  return { list, cells };
}

/**
 * Write every amount for the chosen portions; a number that changed lights up for a moment.
 * @param {import("./index.js").RecipeCtx} ctx @param {Cells} cells @param {HTMLElement | null} list @param {boolean} lit
 */
export function paintAmounts(ctx, cells, list, lit) {
  if (!ctx.recipe) return;
  const factor = ctx.portions / (ctx.recipe.portions || ctx.portions || 1);
  for (const { amount, unit, ing } of cells.values()) {
    const next = amountOf(ing, factor, ctx.words);
    if (lit && amount.textContent !== next.text) {
      amount.removeAttribute("data-changed");
      void amount.offsetWidth;
      amount.setAttribute("data-changed", "");
    }
    amount.textContent = next.text;
    unit.textContent = next.unit;
  }
  list?.setAttribute("aria-label", ctx.words.ingredients(ctx.portions));
}
