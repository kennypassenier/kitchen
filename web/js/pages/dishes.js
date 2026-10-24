// The dishes screen, `/dishes` (Kenny, 22/10/2026): what lands on a plate, the dishes the parents' wheel picks from.
// Two cards, each the package's data table with its own loading, empty and failed states: the dishes, each with its
// own sides (Kenny, 24/10/2026 05:03), and the categories ("Everyday", "Special", …). Add and Edit open the drawer
// (js/dishes/editor.js); Delete asks for the typed name. A category a dish still uses cannot be deleted, so no dish
// ever points at nothing.

import { loadKitchen, onKitchen, kitchenNow, ingredientName } from "../api.js";
import { h } from "../dom.js";
import { attachDataTables, dataTable } from "/static/kp/js/datatable.js";
import { names, label, languages, ordered } from "../dishes/editor.js";
import { tableCard, rowActions, itemLink, openRecordEditor, sideName } from "../records.js";

/** @typedef {import("../api.js").Kitchen} Kitchen */
/** @typedef {Record<string, any>} Item */

/** @param {HTMLElement} root */
export function mount(root) {
  document.title = "Dishes · Kitchen";
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
        h("h1", { class: "kp-page-header__title" }, "Dishes"),
        h("p", { class: "kp-page-header__description" }, "What lands on a plate, with its Dutch and English name and the sides that come with it. The parents' wheel picks from the dishes marked for it."),
      ),
      h("div", { class: "kp-page-header__actions" }, h("a", { class: "kp-button", href: "/parents", title: "The wheel as Kenny's parents see it, in English" }, "Open the parents' wheel")),
    ),
  );

  const dishes = tableCard({
    id: "dl-dishes",
    title: "All dishes",
    lede: "A dish shows on the Dutch wheel with a Dutch name and on the English wheel with an English name; the Wheel column says which.",
    noun: "dish",
    plural: "dishes",
    columns: [["Dutch name", "text"], ["English name", "text"], ["Category", "text"], ["Wheel", "text"], ["Sides"], ["Actions"]],
    add: "Add a dish",
    emptyTitle: "No dishes yet",
    emptyText: "The parents' wheel has nothing to pick from until you add one.",
  });
  const cats = tableCard({
    id: "dl-cats",
    title: "Categories",
    lede: "Kinds of food, such as everyday or special; the parents' page can narrow its wheel to one.",
    noun: "category",
    plural: "categories",
    columns: [["Position", "number"], ["Dutch name", "text"], ["English name", "text"], ["Used by", "number"], ["Actions"]],
    add: "Add a category",
    emptyTitle: "No categories yet",
    emptyText: "Without them the parents' page shows all its dishes on one wheel.",
  });

  const page = h("div", { class: "dl-page" }, head, dishes.card, cats.card);
  root.replaceChildren(page);
  const detach = attachDataTables(page);
  const handles = [dishes, cats].map((c) => dataTable(c.table));

  const busy = () => {
    for (const handle of handles) {
      handle?.busy({ text: "Reading the dishes", overlay: true });
      handle?.state("loading");
    }
  };
  busy();

  for (const b of dishes.addButtons) b.addEventListener("click", () => openRecordEditor("dishes", null));
  for (const b of cats.addButtons) b.addEventListener("click", () => openRecordEditor("dish_categories", null));

  /** @param {Kitchen} k */
  function show(k) {
    const catList = k.dish_categories ?? [];
    const dishList = k.dishes ?? [];
    dishes.body.replaceChildren(
      ...dishList.map((d) => {
        const n = names(d);
        const only = languages(d);
        const cat = catList.find((c) => c.id === d.category);
        // "Choice of fries and mayonnaise or croquettes; with salad": the small wheel's sides first, then what always
        // comes along.
        const pick = /** @type {Item[]} */ (d.sides ?? []).map((x) => sideName(x));
        const always = /** @type {string[]} */ (d.ingredients ?? []).map((id) => ingredientName(id));
        const said = [pick.length > 1 ? `Choice of ${pick.join(" or ")}` : pick.length ? `With ${pick[0]}` : "", always.length ? `${pick.length ? "with" : "With"} ${always.join(", ")}` : ""].filter(Boolean).join("; ");
        const wheel =
          d.parents !== true
            ? h("span", { class: "kp-badge" }, "Not on the wheel")
            : only === "both"
              ? h("span", { class: "kp-badge kp-badge--success" }, "Both wheels")
              : h("span", { class: "kp-badge kp-badge--warning" }, only === "nl" ? "Dutch wheel only" : "English wheel only");
        return h(
          "tr",
          { "data-kp-row-key": d.id },
          h("td", { "data-label": "Dutch name", lang: "nl" }, n.nl ? itemLink("dishes", d, n.nl) : "–"),
          h("td", { "data-label": "English name" }, n.en ? itemLink("dishes", d, n.en) : "–"),
          h("td", { "data-label": "Category" }, cat ? itemLink("dish_categories", cat) : "–"),
          h("td", { "data-label": "Wheel" }, wheel),
          h("td", { "data-label": "Sides" }, said || "No sides"),
          h("td", { "data-label": "Actions" }, rowActions("dishes", d)),
        );
      }),
    );
    cats.body.replaceChildren(
      ...ordered(catList).map((c, i) => {
        const n = names(c);
        const used = dishList.filter((d) => d.category === c.id).length;
        return h(
          "tr",
          { "data-kp-row-key": c.id },
          h("td", { "data-label": "Position", class: "kp-numeric" }, String(i + 1)),
          h("td", { "data-label": "Dutch name", lang: "nl" }, n.nl ? itemLink("dish_categories", c, n.nl) : "–"),
          h("td", { "data-label": "English name" }, n.en ? itemLink("dish_categories", c, n.en) : "–"),
          h("td", { "data-label": "Used by", class: "kp-numeric", "data-kp-sort-value": String(used) }, `${used} ${used === 1 ? "dish" : "dishes"}`),
          h("td", { "data-label": "Actions" }, rowActions("dish_categories", c)),
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
  for (const c of [dishes, cats]) c.table.addEventListener("kp-datatable-retry", () => void load(true));
  const stop = onKitchen((k) => alive && show(k));
  void load();

  return () => {
    alive = false;
    stop();
    detach();
  };
}
