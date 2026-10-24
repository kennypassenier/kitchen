// The ingredients screen, `/ingredients` (Kenny, 24/10/2026 05:15): the one list of ingredients every dish side and
// every recipe line points at, and the categories they sit in ("Vlees" / "Meat" → Steak, "Aardappelen" / "Potatoes"
// → Frieten). Two cards with the package's data table and its loading, empty and failed states; Add, Edit and
// Delete through js/records.js, and every name opens its own page. An ingredient or a category still in use cannot
// be deleted; the refusal names what uses it.

import { attachDataTables, dataTable } from "/static/kp/js/datatable.js";
import { loadKitchen, onKitchen, kitchenNow } from "../api.js";
import { h } from "../dom.js";
import { names, ordered, label } from "../dishes/editor.js";
import { tableCard, rowActions, itemLink, openRecordEditor, usersOf } from "../records.js";

/** @typedef {import("../api.js").Kitchen} Kitchen */

/** @param {HTMLElement} root */
export function mount(root) {
  document.title = "Ingredients · Kitchen";
  let alive = true;

  const head = h(
    "header",
    { class: "kp-page-header" },
    h(
      "div",
      { class: "kp-page-header__inner" },
      h(
        "div",
        null,
        h("h1", { class: "kp-page-header__title" }, "Ingredients"),
        h("p", { class: "kp-page-header__description" }, "One list for the whole kitchen: a dish takes its sides from it and a recipe its lines. Open an ingredient to see every dish and recipe with it, and a wheel that picks among them."),
      ),
    ),
  );
  const ings = tableCard({
    id: "ig-ings",
    title: "All ingredients",
    lede: "An ingredient shows in each language it has a name in; the category keeps the list in order.",
    noun: "ingredient",
    plural: "ingredients",
    columns: [["Dutch name", "text"], ["English name", "text"], ["Category", "text"], ["Used by", "number"], ["Actions"]],
    add: "Add an ingredient",
    emptyTitle: "No ingredients yet",
    emptyText: "Add one here, or type a new one while you add a side to a dish or a line to a recipe.",
  });
  const cats = tableCard({
    id: "ig-cats",
    title: "Ingredient categories",
    lede: "Meat, potatoes, vegetables, …: the groups the ingredients sit in.",
    noun: "category",
    plural: "ingredient categories",
    columns: [["Position", "number"], ["Dutch name", "text"], ["English name", "text"], ["Ingredients", "number"], ["Actions"]],
    add: "Add a category",
    emptyTitle: "No ingredient categories yet",
    emptyText: "A new ingredient needs one; “Andere” / “Other” is the usual first.",
  });
  const page = h("div", { class: "dl-page" }, head, ings.card, cats.card);
  root.replaceChildren(page);
  const detach = attachDataTables(page);
  const handles = [ings, cats].map((c) => dataTable(c.table));
  for (const b of ings.addButtons) b.addEventListener("click", () => openRecordEditor("ingredients", null));
  for (const b of cats.addButtons) b.addEventListener("click", () => openRecordEditor("ingredient_categories", null));

  const busy = () => {
    for (const handle of handles) {
      handle?.busy({ text: "Reading the ingredients", overlay: true });
      handle?.state("loading");
    }
  };

  /** @param {Kitchen} k */
  function show(k) {
    const catList = k.ingredient_categories ?? [];
    ings.body.replaceChildren(
      ...(k.ingredients ?? []).map((i) => {
        const n = names(i);
        const cat = catList.find((c) => c.id === i.category);
        const used = usersOf("ingredients", i).length;
        return h(
          "tr",
          { "data-kp-row-key": i.id },
          h("td", { "data-label": "Dutch name", lang: "nl" }, n.nl ? itemLink("ingredients", i, n.nl) : "–"),
          h("td", { "data-label": "English name" }, n.en ? itemLink("ingredients", i, n.en) : "–"),
          h("td", { "data-label": "Category" }, cat ? itemLink("ingredient_categories", cat) : "–"),
          h("td", { "data-label": "Used by", class: "kp-numeric", "data-kp-sort-value": String(used) }, `${used} ${used === 1 ? "dish or recipe" : "dishes and recipes"}`),
          h("td", { "data-label": "Actions" }, rowActions("ingredients", i)),
        );
      }),
    );
    cats.body.replaceChildren(
      ...ordered(catList).map((c, at) => {
        const n = names(c);
        const count = (k.ingredients ?? []).filter((i) => i.category === c.id).length;
        return h(
          "tr",
          { "data-kp-row-key": c.id },
          h("td", { "data-label": "Position", class: "kp-numeric" }, String(at + 1)),
          h("td", { "data-label": "Dutch name", lang: "nl" }, n.nl ? itemLink("ingredient_categories", c, n.nl) : "–"),
          h("td", { "data-label": "English name" }, n.en ? itemLink("ingredient_categories", c, n.en) : label(c)),
          h("td", { "data-label": "Ingredients", class: "kp-numeric", "data-kp-sort-value": String(count) }, String(count)),
          h("td", { "data-label": "Actions" }, rowActions("ingredient_categories", c)),
        );
      }),
    );
    for (const handle of handles) {
      handle?.refresh({ keepPage: true });
      handle?.state("ready");
    }
  }

  /** @param {boolean} [force] */
  async function load(force = false) {
    if (force || !kitchenNow()) busy();
    try {
      const k = await loadKitchen({ force });
      if (alive) show(k);
    } catch (e) {
      if (alive) for (const handle of handles) handle?.fail(e instanceof Error ? e.message : String(e));
    }
  }
  for (const c of [ings, cats]) c.table.addEventListener("kp-datatable-retry", () => void load(true));
  const stop = onKitchen((k) => alive && show(k));
  void load();

  return () => {
    alive = false;
    stop();
    detach();
  };
}
