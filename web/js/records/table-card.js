// One card with a data table, as /dishes and /log show their lists.

import { h } from "../dom.js";
import { t } from "../i18n/index.js";

/** One header cell: its words, how it sorts and filters, and any other attribute (`data-kp-edit` for an in-cell edit). @param {[string, string?, string?, Record<string, string>?]} column */
const headerCell = ([text, sort, filter, attrs]) => h("th", { scope: "col", ...(sort ? { "data-kp-sort": sort } : {}), ...(filter ? { "data-kp-filter": filter } : {}), ...(attrs ?? {}) }, text);

/** The id of a card's data table, which its add row names (`data-kp-addrow-for`). @param {string} id */
export const tableIdOf = (id) => `${id}-table`;

/**
 * One card with a data table: header, a sentence, the table and its own states. `entry` is an inline add row
 * (records/add-line.js) that stands between the sentence and the table and replaces the header's Add button; the empty
 * plate's Add then leads to it. `reorder` gives the rows the kit's drag handles (Alt+Up / Alt+Down from the keyboard).
 * @param {{ id: string, title: string, lede: string, noun: string, plural: string, columns: [string, string?, string?, Record<string, string>?][], add: string, emptyTitle: string, emptyText: string, entry?: HTMLElement, reorder?: boolean }} spec
 */
export function tableCard({ id, title, lede, noun, plural, columns, add, emptyTitle, emptyText, entry, reorder = false }) {
  const addButton = h("button", { type: "button", class: "kp-button kp-button--primary" }, add);
  const empty = h(
    "div",
    { class: "kp-empty", "data-kp-art": "none", "data-kp-datatable-empty": true, hidden: true },
    h("p", { class: "kp-empty__title", "data-kp-datatable-empty-none": true }, emptyTitle),
    h("p", { class: "kp-empty__body", "data-kp-datatable-empty-none": true }, emptyText),
    h("button", { type: "button", class: "kp-button kp-button--primary", "data-kp-datatable-empty-none": true, "data-dl-add": true }, add),
    h("p", { class: "kp-empty__title", "data-kp-datatable-empty-nomatch": true }, t("rec.noMatch", noun)),
    h("p", { class: "kp-empty__body", "data-kp-datatable-empty-nomatch": true }, t("rec.noMatchText")),
    h("button", { type: "button", class: "kp-button", "data-kp-datatable-empty-nomatch": true, "data-kp-datatable-clear": true }, t("rec.clearSearch")),
  );
  const body = h("tbody");
  const search = h("input", { class: "kp-field__input kp-datatable__search", type: "search", "data-kp-datatable-search": true, "aria-label": t("rec.search", plural), placeholder: t("rec.search", plural) });
  const table = h(
    "div",
    { id: tableIdOf(id), class: "kp-datatable", "data-kp-datatable": true, "data-kp-cards": true, "data-kp-state": "loading", "data-kp-page-size": "25", ...(reorder ? { "data-kp-rows-reorder": true } : {}) },
    h("div", { class: "kp-datatable__bar" }, search),
    h(
      "div",
      { class: "kp-table-wrap" },
      h(
        "table",
        { class: "kp-table" },
        h("caption", { class: "kp-sr-only" }, title),
        h("thead", null, h("tr", null, ...columns.map(headerCell))),
        body,
      ),
    ),
    empty,
    h("div", { class: "kp-alert kp-alert--destructive", "data-kp-datatable-failed": true, role: "alert", hidden: true }, h("p", { "data-kp-datatable-failed-reason": true }, t("rec.notRead", plural)), h("button", { type: "button", class: "kp-button", "data-kp-datatable-retry": true }, t("common.tryAgain"))),
    h("div", { class: "kp-datatable__bar" }, h("p", { class: "kp-datatable__status", "data-kp-datatable-status": true, role: "status", "aria-live": "polite" }), h("div", { class: "kp-datatable__pager", "data-kp-datatable-pager": true })),
  );
  const card = h(
    "section",
    { class: "kp-card dl-card", "aria-labelledby": `${id}-t` },
    h("div", { class: "kp-card__header" }, h("h2", { class: "kp-card__title", id: `${id}-t` }, title), entry ? null : h("div", { class: "kp-card__actions" }, addButton)),
    h("p", { class: "kp-lede" }, lede),
    entry ?? null,
    table,
  );
  const emptyAdd = /** @type {HTMLElement} */ (empty.querySelector("[data-dl-add]"));
  return { card, table, body, addButtons: entry ? [emptyAdd] : [addButton, emptyAdd] };
}
