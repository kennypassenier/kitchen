// One card with a data table, as /dishes and /log show their lists.

import { h } from "../dom.js";
import { t } from "../i18n/index.js";

/**
 * One card with a data table: header, a sentence, the table and its own states.
 * @param {{ id: string, title: string, lede: string, noun: string, plural: string, columns: [string, string?, string?][], add: string, emptyTitle: string, emptyText: string }} spec
 */
export function tableCard({ id, title, lede, noun, plural, columns, add, emptyTitle, emptyText }) {
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
    { class: "kp-datatable", "data-kp-datatable": true, "data-kp-cards": true, "data-kp-state": "loading", "data-kp-page-size": "25" },
    h("div", { class: "kp-datatable__bar" }, search),
    h(
      "div",
      { class: "kp-table-wrap" },
      h(
        "table",
        { class: "kp-table" },
        h("caption", { class: "kp-sr-only" }, title),
        h("thead", null, h("tr", null, ...columns.map(([text, sort, filter]) => h("th", { scope: "col", ...(sort ? { "data-kp-sort": sort } : {}), ...(filter ? { "data-kp-filter": filter } : {}) }, text)))),
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
    h("div", { class: "kp-card__header" }, h("h2", { class: "kp-card__title", id: `${id}-t` }, title), h("div", { class: "kp-card__actions" }, addButton)),
    h("p", { class: "kp-lede" }, lede),
    table,
  );
  return { card, table, body, addButtons: [addButton, /** @type {HTMLElement} */ (empty.querySelector("[data-dl-add]"))] };
}
