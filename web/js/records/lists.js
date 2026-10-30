// Add, view, edit and delete for every list the kitchen keeps (Kenny, 24/10/2026 05:07, 05:08: "everything that is
// entered or read out has full CRUD", and every item has its own page). One place knows, per list, its name, its
// detail page, its editor and how it is deleted, so the screens that show an item (/bad-days, /dishes, /log, the
// wheel's resting list, the detail page) all offer the same four actions in the same words.
//
// The editors are the dishes' drawer (js/dishes/editor.js) on `.kp-formgrid`; a delete that loses something a person
// typed asks for the typed name (the package's confirmation), a log line or a resting mark is taken back with Undo.
// docs/agent/CRUD.md lists what each screen offers.

// Per-list registry: names, detail pages and the name/link helpers every screen shares.

import { h } from "../dom.js";
import { kitchenNow, ingredientName } from "../api.js";
import { t, lang, nameOf, textOf } from "../i18n/index.js";
import { dmy } from "../format.js";
import { openRecordEditor } from "./editors.js";
export { externalLink, hostOf } from "../links.js";

/** @typedef {Record<string, any>} Item */
/** @typedef {"recipes" | "dishes" | "dish_categories" | "ingredients" | "ingredient_categories" | "freezer" | "shelf" | "log" | "resting" | "recipe_sources"} List */

/** What a shelf item asks of a person. */
export const energies = () => /** @type {Record<string, string>} */ ({ open: t("rec.energyOpen"), easy: t("rec.energyEasy"), any: t("rec.energyAny") });
/** A log line's feeling, as the recipe page names it. */
export const feelings = () => /** @type {Record<string, string>} */ ({ easy: t("rec.feelEasy"), fine: t("rec.feelFine"), heavy: t("rec.feelHeavy") });

/** @param {string} id */
export const dish = (id) => (id ? kitchenNow()?.dishes.find((d) => d.id === id) ?? null : null);
/** @param {string} id */
export const shelfItem = (id) => kitchenNow()?.shelf.find((s) => s.id === id) ?? null;

/**
 * Per list: the page the list lives on (its path and the bar's page id) and the item's own name. The nouns and the
 * sentences that name a list are words (`list.<list>.*` in js/i18n).
 * @type {Record<List, { home: [string, string], name: (item: Item) => string }>}
 */
const PLACES = {
  recipes: { home: ["/recipes", "recipes"], name: (r) => String(r.name || t("rec.aRecipe")) },
  dishes: { home: ["/dishes", "dishes"], name: (d) => nameOf(d).text },
  dish_categories: { home: ["/dishes", "dishes"], name: (c) => nameOf(c).text },
  ingredients: { home: ["/ingredients", "ingredients"], name: (i) => ingredientName(i.id, lang()) },
  ingredient_categories: { home: ["/ingredients", "ingredients"], name: (c) => nameOf(c).text },
  freezer: { home: ["/bad-days#freezer", "baddays"], name: (f) => textOf(f.dish) || t("rec.aDish") },
  shelf: { home: ["/bad-days#zero-prep", "baddays"], name: (s) => textOf(s.title) || t("rec.aFood") },
  log: { home: ["/log", "log"], name: (e) => `${logWhat(e)}, ${dmy(e.date)}` },
  recipe_sources: { home: ["/sources", "sources"], name: (s) => String(s.name || t("list.recipe_sources")) },
  resting: { home: ["/", "wheel"], name: (r) => t("rec.resting", dish(r.dish_id) ? nameOf(dish(r.dish_id)).text : t("rec.aDish")) },
};

/**
 * Per list: its noun in the current language, the page it lives on ([path, the bar's word]) and an item's name.
 * @type {Record<List, { readonly noun: string, readonly the: string, readonly this: string, readonly home: [string, string], name: (item: Item) => string }>}
 */
export const LISTS = /** @type {any} */ (
  Object.fromEntries(
    Object.entries(PLACES).map(([list, p]) => [
      list,
      {
        get noun() {
          return t(`list.${list}`);
        },
        /** "the dish" / "het gerecht" */
        get the() {
          return t(`list.${list}.the`);
        },
        /** "this dish" / "dit gerecht", "deze categorie" */
        get this() {
          return t(`list.${list}.this`);
        },
        get home() {
          return [p.home[0], t(`nav.${p.home[1]}`)];
        },
        name: p.name,
      },
    ]),
  )
);

/** Where an item's own page is. @param {List} list @param {string} id */
export function detailHref(list, id) {
  const e = encodeURIComponent(id);
  return list === "recipes" ? `/recipe?id=${e}` : `/${DETAIL_BASE[list]}/${e}`;
}
/** The path word of each list's detail page; js/main.js routes `/<word>/<id>` to pages/item/index.js. */
export const DETAIL_BASE = /** @type {Record<Exclude<List, "recipes">, string>} */ ({
  dishes: "dishes",
  dish_categories: "categories",
  ingredients: "ingredients",
  ingredient_categories: "ingredient-categories",
  freezer: "freezer",
  shelf: "shelf",
  log: "log",
  resting: "resting",
  recipe_sources: "sources",
});

/** What a log line is about: the recipe or the shelf food, by name. @param {Item} e */
export function logWhat(e) {
  if (e.shelf_id) return textOf(shelfItem(e.shelf_id)?.title) || t("rec.goneShelf");
  return dish(e.dish_id) ? nameOf(dish(e.dish_id)).text : t("rec.goneDish");
}

/** "Fries and mayonnaise", or the side's own label: one entry of the small wheel, in the current language. @param {Item} side */
export function sideName(side) {
  const other = lang() === "nl" ? "en" : "nl";
  const label = String(side.label?.[lang()] || side.label?.[other] || "").trim();
  if (label) return label;
  const parts = /** @type {string[]} */ (side.ingredients ?? []).map((id, i) => {
    const n = ingredientName(id, lang());
    return i ? n.charAt(0).toLowerCase() + n.slice(1) : n;
  });
  return parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} ${t("common.and")} ${parts.at(-1)}`;
}

/** Does a dish have the ingredient, fixed or in one of its sides? @param {Item} d @param {string} id */
export const dishHas = (d, id) => (d.ingredients ?? []).includes(id) || (d.sides ?? []).some((/** @type {Item} */ s) => (s.ingredients ?? []).includes(id));

/**
 * For an item stored before every name needed both halves (Kenny, 24/10/2026 10:04): a badge that says which half is
 * missing and opens its editor; null when both are there.
 * @param {List} list @param {Item} item
 */
export function missingBadge(list, item) {
  const nl = String(item?.name?.nl ?? "").trim();
  const en = String(item?.name?.en ?? "").trim();
  if (nl && en) return null;
  const b = h("button", { type: "button", class: "kp-badge kp-badge--warning it-missing", title: t("rec.fixName") }, t(nl ? "rec.missingEn" : "rec.missingNl"));
  b.addEventListener("click", () => openRecordEditor(list, item));
  return b;
}

/** A link to an item's own page. @param {List} list @param {Item} item @param {string} [text] */
export const itemLink = (list, item, text) => h("a", { href: detailHref(list, item.id) }, text ?? LISTS[list].name(item));
