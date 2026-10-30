// An ingredient's page: the dishes and recipes that use it, with filters and a wheel.

import { attachDataTables, dataTable } from "/static/kp/js/datatable.js";
import { mountDishWheel } from "/eten/dishwheel.js";
import { attachSegmented, getSegmentedValues, SEGMENTED_EVENT } from "/static/kp/js/segmented.js";
import { attachSelects } from "/static/kp/js/combobox.js";
import { defaultRecipe } from "../../api.js";
import { h } from "../../dom.js";
import { LISTS, itemLink, openRecordEditor, tableCard, dishHas } from "../../records/index.js";
import { t } from "../../i18n/index.js";
import { ordered } from "../../dishes/editor.js";
import { inRecipe } from "./links.js";

/** @typedef {import("../../api.js").Kitchen} Kitchen */
/** @typedef {Record<string, any>} Item */

/**
 * An ingredient's dishes and recipes: one data table with a search and four filters (the dish's category, on the
 * parents' wheel, safe, has a recipe), and a wheel that picks only among the dishes with it.
 * @param {HTMLElement} pageEl @param {string} id
 */
export function usedBy(pageEl, id) {
  const table = tableCard({
    id: "it-used",
    title: t("it.usedTitle"),
    lede: t("it.usedLede"),
    noun: t("it.usedNoun"),
    plural: t("it.usedPlural"),
    columns: [[t("rec.name"), "text"], [t("it.kind"), "text"], [t("rec.category"), "text"], [t("it.parentsWheel"), "text"], [t("it.safe"), "text"], [t("rec.recipe")]],
    add: t("list.dishes.add"),
    emptyTitle: t("it.usedEmpty"),
    emptyText: t("it.usedEmptyText"),
  });
  table.addButtons.forEach((b) => b.addEventListener("click", () => openRecordEditor("dishes", null)));
  const cat = /** @type {HTMLSelectElement} */ (h("select", { class: "kp-field__input", "aria-label": t("it.dishCategory") }));
  const flags = h(
    "div",
    { class: "kp-segmented kp-segmented--chips", "data-kp-segmented": "multi", role: "group", "aria-label": t("it.showOnly") },
    ...[["parents", t("it.onParents")], ["safe", t("it.safe")], ["recipe", t("it.hasRecipe")]].map(([v, text]) =>
      h("button", { type: "button", class: "kp-segmented__item", "data-value": v, "aria-pressed": "false" }, h("span", { class: "kp-segmented__label" }, text)),
    ),
  );
  const filters = h("div", { class: "kp-formgrid kitchen-formgrid it-filters" }, h("div", { class: "kp-formgrid__row" }, h("span", { class: "kp-formgrid__label" }, t("rec.category")), h("div", { class: "kp-formgrid__control" }, cat)), h("div", { class: "kp-formgrid__row" }, h("span", { class: "kp-formgrid__label" }, t("it.showOnly")), h("div", { class: "kp-formgrid__control" }, flags)));
  table.card.querySelector(".kp-lede")?.after(filters);

  // The one wheel component (web/eten/dishwheel.js): one wheel among the dishes, no side wheel and no answer column; its own
  // answer card stands under it.
  const wheelHost = h("div", {});
  const wheels = mountDishWheel(wheelHost, { sides: false, answer: false, kiosk: true, cards: true, words: { dishLabel: t("it.wheelLabel"), dishEmpty: t("it.wheelEmpty") } });
  const wheelCard = h(
    "section",
    { class: "kp-card it-wheel", "aria-labelledby": "it-wheel-t" },
    h("div", { class: "kp-card__header" }, h("h2", { class: "kp-card__title", id: "it-wheel-t" }, t("it.wheelTitle"))),
    h("p", { class: "kp-card__body" }, t("it.wheelText")),
    wheelHost,
  );
  pageEl.append(table.card, wheelCard);
  const stops = [attachDataTables(table.card), attachSegmented(filters), attachSelects(filters), () => wheels.destroy()].filter((f) => typeof f === "function");
  const handle = dataTable(table.table);
  /** @type {Kitchen | null} */
  let kitchen = null;

  const draw = () => {
    const k = kitchen;
    if (!k) return;
    const on = new Set(getSegmentedValues(flags));
    // One row per dish that has it: fixed, in a side, or as a line of its recipe (the recipe belongs to the dish).
    /** @type {{ kind: string, item: Item, category: string | null, parents: boolean | null, safe: boolean, recipe: Item | null }[]} */
    const rows = k.dishes
      .filter((d) => dishHas(d, id) || inRecipe(d, id))
      .map((d) => ({
        kind: [dishHas(d, id) ? t("it.inDish") : "", inRecipe(d, id) ? t("it.inRecipe") : ""].filter(Boolean).join(", "),
        item: d,
        category: d.category ?? null,
        parents: d.parents === true,
        safe: defaultRecipe(d)?.safe === true,
        recipe: defaultRecipe(d),
      }))
      .filter((x) => (!cat.value || x.category === cat.value) && (!on.has("parents") || x.parents === true) && (!on.has("safe") || x.safe) && (!on.has("recipe") || x.recipe));
    table.body.replaceChildren(
      ...rows.map((x) => {
        const c = k.dish_categories.find((y) => y.id === x.category);
        return h(
          "tr",
          { "data-kp-row-key": x.item.id },
          h("td", { "data-label": t("rec.name") }, itemLink("dishes", x.item)),
          h("td", { "data-label": t("it.kind") }, x.kind),
          h("td", { "data-label": t("rec.category") }, c ? itemLink("dish_categories", c) : "–"),
          h("td", { "data-label": t("it.parentsWheel") }, x.parents === null ? "–" : t(x.parents ? "it.yes" : "it.no")),
          h("td", { "data-label": t("it.safe") }, t(x.safe ? "it.yes" : "it.no")),
          h("td", { "data-label": t("rec.recipe") }, x.recipe ? h("a", { href: `/recipe?id=${encodeURIComponent(x.recipe.id)}` }, t("it.openRecipe")) : "–"),
        );
      }),
    );
    handle?.refresh({ keepPage: true });
    handle?.state("ready");
    wheels.setDishes(k.dishes.filter((d) => dishHas(d, id) || inRecipe(d, id)).map((d) => ({ id: d.id, label: LISTS.dishes.name(d) })));
  };
  cat.addEventListener("change", draw);
  flags.addEventListener(SEGMENTED_EVENT, draw);
  handle?.busy({ text: t("it.readingDishes"), overlay: true });
  handle?.state("loading");
  return {
    /** @param {Kitchen} k */
    show(k) {
      kitchen = k;
      const was = cat.value;
      cat.replaceChildren(h("option", { value: "" }, t("it.everyCategory")), ...ordered(k.dish_categories).map((c) => h("option", { value: c.id }, LISTS.dish_categories.name(c))));
      cat.value = was;
      draw();
    },
    /** @param {string} why */
    fail(why) {
      handle?.fail(why);
    },
    stop() {
      for (const s of stops) s();
    },
  };
}
