// Small link builders and shared facts for an item's page.

import { agoMoment } from "/static/kp/dist/kp-themes.min.js";
import { kitchenNow, ingredientName } from "../../api.js";
import { h } from "../../dom.js";
import { itemLink } from "../../records/index.js";
import { t } from "../../i18n/index.js";

/** @typedef {import("../../api.js").Kitchen} Kitchen */
/** @typedef {Record<string, any>} Item */

/** A link to an ingredient's page, or the words for one that is gone. @param {Kitchen} k @param {string} id */
export const ingLink = (k, id) => {
  const ing = k.ingredients.find((i) => i.id === id);
  return ing ? itemLink("ingredients", ing) : h("span", { class: "kp-kv__none" }, ingredientName(id));
};

/** A list of links, or the words for none. @param {HTMLElement[]} links @param {string} none */
export const linkList = (links, none) => (links.length ? h("ul", { class: "it-links" }, ...links.map((a) => h("li", null, a))) : h("span", { class: "kp-kv__none" }, none));
/** A link to a dish's page, or the words for one that is gone. @param {string | null | undefined} id */
export const dishLink = (id) => {
  const d = id ? kitchenNow()?.dishes.find((x) => x.id === id) : null;
  return d ? itemLink("dishes", d) : h("span", { class: "kp-kv__none" }, id ? t("rec.goneDish") : t("it.none"));
};
/** The created and updated moments, as dd/mm/yyyy HH:mm. @param {Item} item */
export const stamps = (item) =>
  /** @type {[string, Node | string][]} */ ([
    [t("it.added"), item.created ? agoMoment(Date.parse(item.created)) : "–"],
    [t("it.changed"), item.updated ? agoMoment(Date.parse(item.updated)) : t("it.notChanged")],
  ]);

/** Does one of a dish's recipes have a line with the ingredient? @param {Item} d @param {string} id */
export const inRecipe = (d, id) => (d.recipes ?? []).some((/** @type {Item} */ r) => (r.ingredients ?? []).some((/** @type {Item} */ l) => l.ingredient === id));

