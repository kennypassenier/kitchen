// The recipes screen's static parts: the page header, the table with its slots, the list card and the editor drawer.

import { h } from "../../dom.js";
import { t } from "../../i18n/index.js";
import { prepLabels } from "./rows.js";

/** The package draws this slot as its state plate (centred, the table's full height); the page only supplies the words. */
function emptySlot() {
  return h(
    "div",
    { class: "kp-empty", "data-kp-datatable-empty": true, hidden: true },
    h("p", { class: "kp-empty__title", "data-kp-datatable-empty-none": true }, t("recs.noneTitle")),
    h("p", { class: "kp-empty__body", "data-kp-datatable-empty-none": true }, t("recs.noneText")),
    h("button", { type: "button", class: "kp-button kp-button--primary", "data-kp-datatable-empty-none": true, "data-rl-add": true }, t("list.recipes.add")),
    h("p", { class: "kp-empty__title", "data-kp-datatable-empty-nomatch": true }, t("recs.noMatch")),
    h("p", { class: "kp-empty__body", "data-kp-datatable-empty-nomatch": true }, t("recs.noMatchText")),
    h("button", { type: "button", class: "kp-button", "data-kp-datatable-empty-nomatch": true, "data-kp-datatable-clear": true }, t("rec.clearSearch")),
  );
}

/** The table's header row. */
function headRow() {
  return h(
    "tr",
    null,
    h("th", { scope: "col", "data-kp-sort": "text" }, t("recs.colName")),
    h("th", { scope: "col", class: "kp-col-low" }, t("recs.colMeals")),
    h("th", { scope: "col", "data-kp-sort": "number" }, t("recs.colMinutes")),
    h("th", { scope: "col", "data-kp-sort": "text", "data-kp-sort-order": Object.values(prepLabels()).join(",") }, t("recs.colPrep")),
    h("th", { scope: "col", "data-kp-sort": "text" }, t("recs.colSafe")),
    h("th", { scope: "col", "data-kp-sort": "number" }, t("recs.colLast")),
    h("th", { scope: "col" }, t("recs.colActions")),
  );
}

/** @returns {{ table: HTMLElement, body: HTMLElement, empty: HTMLElement }} */
function tableOf() {
  const empty = emptySlot();
  const body = h("tbody");
  const search = h("input", { class: "kp-field__input kp-datatable__search", type: "search", "data-kp-datatable-search": true, "aria-label": t("recs.search"), placeholder: t("recs.search") });
  const table = h(
    "div",
    { class: "kp-datatable rl-datatable", "data-kp-datatable": true, "data-kp-cards": true, "data-kp-state": "loading", "data-kp-page-size": "25" },
    h("div", { class: "kp-datatable__bar" }, search),
    h("div", { class: "kp-table-wrap" }, h("table", { class: "kp-table" }, h("caption", { class: "kp-sr-only" }, t("nav.recipes")), h("thead", null, headRow()), body)),
    empty,
    h("div", { class: "kp-datatable__bar" }, h("p", { class: "kp-datatable__status", "data-kp-datatable-status": true, role: "status", "aria-live": "polite" }), h("div", { class: "kp-datatable__pager", "data-kp-datatable-pager": true })),
  );
  return { table, body, empty };
}

/** The whole page (not yet in the document) with the nodes the behaviour needs. */
export function buildPage() {
  const add = h("button", { type: "button", class: "kp-button kp-button--primary" }, t("list.recipes.add"));
  const importer = h("button", { type: "button", class: "kp-button" }, t("imp.button"));
  const head = h(
    "header",
    { class: "kp-page-header" },
    h(
      "div",
      { class: "kp-page-header__inner" },
      h("div", null, h("h1", { class: "kp-page-header__title" }, t("nav.recipes")), h("p", { class: "kp-page-header__description" }, t("recs.intro"))),
      h("div", { class: "kp-page-header__actions" }, importer, add),
    ),
  );
  const { table, body, empty } = tableOf();
  const list = h(
    "section",
    { class: "kp-card rl-list", "aria-labelledby": "rl-list-t" },
    h("div", { class: "kp-card__header" }, h("h2", { class: "kp-card__title", id: "rl-list-t" }, t("recs.all"))),
    h("p", { class: "kp-lede" }, t("recs.lede")),
    table,
  );
  const editor = h("dialog", { class: "kp-drawer kp-dialog rl-editor", "aria-labelledby": "rl-editor-t" });
  const page = h("div", { class: "rl-page" }, head, list);
  return { add, importer, table, body, empty, editor, page };
}
