// The ingredients screen, `/ingredients` (Kenny, 24/10/2026 05:15): the one list of ingredients every dish side and
// every recipe line points at, and the categories they sit in ("Vlees" / "Meat" → Steak, "Aardappelen" / "Potatoes"
// → Frieten). Two cards with the package's data table and its loading, empty and failed states; Add, Edit and
// Delete through js/records/, and every name opens its own page. An ingredient or a category still in use cannot
// be deleted; the refusal names what uses it.

import { h } from "../dom.js";
import { names, ordered } from "../dishes/editor.js";
import { tableCard, rowActions, itemLink, openRecordEditor, usersOf, missingBadge } from "../records/index.js";
import { pageHead, mountTables } from "../records/table-page.js";
import { t } from "../i18n/index.js";

/** @typedef {Record<string, any>} Item */

/** The two table cards: the ingredients and their categories. */
function buildCards() {
  const ings = tableCard({
    id: "ig-ings",
    title: t("ig.allTitle"),
    lede: t("ig.allLede"),
    noun: t("list.ingredients"),
    plural: t("ig.plural"),
    columns: [[t("rec.dutchName"), "text"], [t("rec.englishName"), "text"], [t("rec.category"), "text"], [t("ig.usedBy"), "number"], [t("lg.actions")]],
    add: t("list.ingredients.add"),
    emptyTitle: t("ig.empty"),
    emptyText: t("ig.emptyText"),
  });
  const cats = tableCard({
    id: "ig-cats",
    title: t("ig.catTitle"),
    lede: t("ig.catLede"),
    noun: t("list.ingredient_categories"),
    plural: t("ig.catPlural"),
    columns: [[t("it.position"), "number"], [t("rec.dutchName"), "text"], [t("rec.englishName"), "text"], [t("nav.ingredients"), "number"], [t("lg.actions")]],
    add: t("list.ingredient_categories.add"),
    emptyTitle: t("ig.catEmpty"),
    emptyText: t("ig.catEmptyText"),
  });
  return { ings, cats };
}

/** @param {Item} i @param {Item[]} catList */
function ingredientRow(i, catList) {
  const n = names(i);
  const cat = catList.find((c) => c.id === i.category);
  const used = usersOf("ingredients", i).length;
  return h(
    "tr",
    { "data-kp-row-key": i.id },
    h("td", { "data-label": t("rec.dutchName"), lang: "nl" }, n.nl ? itemLink("ingredients", i, n.nl) : missingBadge("ingredients", i) ?? "–"),
    h("td", { "data-label": t("rec.englishName") }, n.en ? itemLink("ingredients", i, n.en) : missingBadge("ingredients", i) ?? "–"),
    h("td", { "data-label": t("rec.category") }, cat ? itemLink("ingredient_categories", cat) : "–"),
    h("td", { "data-label": t("ig.usedBy"), class: "kp-numeric", "data-kp-sort-value": String(used) }, t("ig.used", used)),
    h("td", { "data-label": t("lg.actions") }, rowActions("ingredients", i)),
  );
}

/** @param {Item} c @param {number} at @param {Item[]} ingredients */
function categoryRow(c, at, ingredients) {
  const n = names(c);
  const count = ingredients.filter((i) => i.category === c.id).length;
  return h(
    "tr",
    { "data-kp-row-key": c.id },
    h("td", { "data-label": t("it.position"), class: "kp-numeric" }, String(at + 1)),
    h("td", { "data-label": t("rec.dutchName"), lang: "nl" }, n.nl ? itemLink("ingredient_categories", c, n.nl) : missingBadge("ingredient_categories", c) ?? "–"),
    h("td", { "data-label": t("rec.englishName") }, n.en ? itemLink("ingredient_categories", c, n.en) : missingBadge("ingredient_categories", c) ?? "–"),
    h("td", { "data-label": t("nav.ingredients"), class: "kp-numeric", "data-kp-sort-value": String(count) }, String(count)),
    h("td", { "data-label": t("lg.actions") }, rowActions("ingredient_categories", c)),
  );
}

/** @param {HTMLElement} root */
export function mount(root) {
  document.title = `${t("nav.ingredients")} · Kitchen`;
  const { ings, cats } = buildCards();
  const page = h("div", { class: "dl-page" }, pageHead({ title: t("nav.ingredients"), lede: t("ig.lede") }), ings.card, cats.card);
  for (const b of ings.addButtons) b.addEventListener("click", () => openRecordEditor("ingredients", null));
  for (const b of cats.addButtons) b.addEventListener("click", () => openRecordEditor("ingredient_categories", null));
  return mountTables({
    root,
    page,
    cards: [ings, cats],
    busyText: t("ig.reading"),
    fill: (k) => {
      const catList = k.ingredient_categories ?? [];
      ings.body.replaceChildren(...(k.ingredients ?? []).map((i) => ingredientRow(i, catList)));
      cats.body.replaceChildren(...ordered(catList).map((c, at) => categoryRow(c, at, k.ingredients ?? [])));
    },
  });
}
