// The dishes screen, `/dishes` (Kenny, 22/10/2026): what lands on a plate, the dishes the parents' wheel picks from.
// Two cards, each the package's data table with its own loading, empty and failed states: the dishes, each with its
// own sides (Kenny, 24/10/2026 05:03), and the categories ("Everyday", "Special", …). Add and Edit open the drawer
// (js/dishes/editor.js); Delete asks for the typed name. A category a dish still uses cannot be deleted, so no dish
// ever points at nothing.

import { ingredientName } from "../api.js";
import { h } from "../dom.js";
import { names, languages, ordered } from "../dishes/editor.js";
import { tableCard, rowActions, itemLink, openRecordEditor, sideName, missingBadge } from "../records/index.js";
import { pageHead, mountTables } from "../records/table-page.js";
import { t, lang } from "../i18n/index.js";

/** @typedef {import("../api.js").Kitchen} Kitchen */
/** @typedef {Record<string, any>} Item */

/** The two table cards: the dishes and their categories. */
function buildCards() {
  const dishes = tableCard({
    id: "dl-dishes",
    title: t("dl.allTitle"),
    lede: t("dl.allLede"),
    noun: t("list.dishes"),
    plural: t("dl.plural"),
    columns: [[t("rec.dutchName"), "text"], [t("rec.englishName"), "text"], [t("rec.category"), "text"], [t("dl.wheel"), "text"], [t("it.sides")], [t("lg.actions")]],
    add: t("list.dishes.add"),
    emptyTitle: t("dl.empty"),
    emptyText: t("dl.emptyText"),
  });
  const cats = tableCard({
    id: "dl-cats",
    title: t("dl.catTitle"),
    lede: t("dl.catLede"),
    noun: t("list.dish_categories"),
    plural: t("dl.catPlural"),
    columns: [[t("it.position"), "number"], [t("rec.dutchName"), "text"], [t("rec.englishName"), "text"], [t("ig.usedBy"), "number"], [t("lg.actions")]],
    add: t("list.dish_categories.add"),
    emptyTitle: t("dl.catEmpty"),
    emptyText: t("dl.catEmptyText"),
  });
  return { dishes, cats };
}

/** "Choice of fries and mayonnaise or croquettes; with salad": the small wheel's sides first, then what always comes along. @param {Item} d */
function sidesSaid(d) {
  const pick = /** @type {Item[]} */ (d.sides ?? []).map((x) => sideName(x));
  const always = /** @type {string[]} */ (d.ingredients ?? []).map((id) => ingredientName(id, lang()));
  return [pick.length > 1 ? t("dl.choiceOf", pick) : pick.length ? t("dl.with", pick[0]) : "", always.length ? t(pick.length ? "dl.andWith" : "dl.with", always.join(", ")) : ""].filter(Boolean).join("; ");
}

/** The badge that says which wheels a dish is on. @param {Item} d */
function wheelBadge(d) {
  const only = languages(d);
  if (d.parents !== true) return h("span", { class: "kp-badge" }, t("it.wheelOff"));
  if (only === "both") return h("span", { class: "kp-badge kp-badge--success" }, t("dl.bothWheels"));
  return h("span", { class: "kp-badge kp-badge--warning" }, t(only === "nl" ? "dl.nlOnly" : "dl.enOnly"));
}

/** @param {Item} d @param {Item[]} catList */
function dishRow(d, catList) {
  const n = names(d);
  const cat = catList.find((c) => c.id === d.category);
  return h(
    "tr",
    { "data-kp-row-key": d.id },
    h("td", { "data-label": t("rec.dutchName"), lang: "nl" }, n.nl ? itemLink("dishes", d, n.nl) : missingBadge("dishes", d) ?? "–"),
    h("td", { "data-label": t("rec.englishName") }, n.en ? itemLink("dishes", d, n.en) : missingBadge("dishes", d) ?? "–"),
    h("td", { "data-label": t("rec.category") }, cat ? itemLink("dish_categories", cat) : "–"),
    h("td", { "data-label": t("dl.wheel") }, wheelBadge(d)),
    h("td", { "data-label": t("it.sides") }, sidesSaid(d) || t("it.noSides")),
    h("td", { "data-label": t("lg.actions") }, rowActions("dishes", d)),
  );
}

/** @param {Item} c @param {number} i @param {Item[]} dishList */
function categoryRow(c, i, dishList) {
  const n = names(c);
  const used = dishList.filter((d) => d.category === c.id).length;
  return h(
    "tr",
    { "data-kp-row-key": c.id },
    h("td", { "data-label": t("it.position"), class: "kp-numeric" }, String(i + 1)),
    h("td", { "data-label": t("rec.dutchName"), lang: "nl" }, n.nl ? itemLink("dish_categories", c, n.nl) : missingBadge("dish_categories", c) ?? "–"),
    h("td", { "data-label": t("rec.englishName") }, n.en ? itemLink("dish_categories", c, n.en) : missingBadge("dish_categories", c) ?? "–"),
    h("td", { "data-label": t("ig.usedBy"), class: "kp-numeric", "data-kp-sort-value": String(used) }, t("dl.used", used)),
    h("td", { "data-label": t("lg.actions") }, rowActions("dish_categories", c)),
  );
}

/** @param {HTMLElement} root */
export function mount(root) {
  document.title = `${t("nav.dishes")} · Kitchen`;
  const { dishes, cats } = buildCards();
  const openParents = h("a", { class: "kp-button", href: "/parents", title: t("dl.parentsTitle") }, t("dl.openParents"));
  const page = h("div", { class: "dl-page" }, pageHead({ title: t("nav.dishes"), lede: t("dl.lede"), actions: [openParents] }), dishes.card, cats.card);
  for (const b of dishes.addButtons) b.addEventListener("click", () => openRecordEditor("dishes", null));
  for (const b of cats.addButtons) b.addEventListener("click", () => openRecordEditor("dish_categories", null));
  return mountTables({
    root,
    page,
    cards: [dishes, cats],
    busyText: t("it.readingDishes"),
    busyAtOnce: true,
    fill: (k) => {
      const catList = k.dish_categories ?? [];
      const dishList = k.dishes ?? [];
      dishes.body.replaceChildren(...dishList.map((d) => dishRow(d, catList)));
      cats.body.replaceChildren(...ordered(catList).map((c, i) => categoryRow(c, i, dishList)));
    },
  });
}
