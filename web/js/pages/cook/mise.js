// The mise en place: the recipe's ingredients by group, with the tools after the first group, as the checklist's items.

import { ingredientName } from "../../api.js";
import { t, lang } from "../../i18n/index.js";
import { wordsFor } from "../../recipe/words.js";

/** @typedef {Record<string, any>} Item */

/** "2 cloves", "400 g", "1" (a piece) or "" (no amount). @param {Item} ing */
export function amountOf(ing) {
  if (ing.amount === null || ing.amount === undefined) return "";
  const n = Math.round(ing.amount * 100) / 100;
  const forms = /** @type {Record<string, string[]>} */ (wordsFor(lang()).units)[ing.unit];
  const unit = ing.unit === "pc" ? "" : forms ? forms[n === 1 ? 0 : 1] : ing.unit || "";
  return `${n} ${unit}`.trim();
}

/** @param {Item} r @returns {Item[]} */
export function miseItems(r) {
  /** @type {Item[]} */
  const items = [];
  const MAIN = t("edit.groupMain");
  const TOOLS = t("edit.tools");
  const groups = [...new Set(r.ingredients.map((/** @type {Item} */ i) => i.group || MAIN))];
  const order = r.tools.length ? [groups[0], TOOLS, ...groups.slice(1)] : groups;
  for (const g of order) {
    if (g === TOOLS && r.tools.length) for (const tool of r.tools) items.push({ id: `tool-${tool.id}`, label: tool.name, detail: "", group: TOOLS });
    else for (const i of r.ingredients) if ((i.group || MAIN) === g) items.push({ id: i.id, label: ingredientName(i.ingredient, lang()), detail: amountOf(i), group: g });
  }
  return items;
}
