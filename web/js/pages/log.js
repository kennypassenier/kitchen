// What I ate (/log): every line of the kitchen's log, the recipes that were cooked and the shelf foods that were eaten
// (Kenny, 24/10/2026 05:07), newest first. One card with the package's data table and its loading, empty and failed
// states; Add, Edit and Delete as on /dishes (js/records.js), and each line opens its own page.

import { attachDataTables, dataTable } from "/static/kp/js/datatable.js";
import { loadKitchen, onKitchen, kitchenNow } from "../api.js";
import { h } from "../dom.js";
import { tableCard, rowActions, itemLink, openRecordEditor, logWhat, dmy, FEELING } from "../records.js";

/** @typedef {import("../api.js").Kitchen} Kitchen */
/** @typedef {Record<string, any>} Item */

/** @param {HTMLElement} root */
export function mount(root) {
  document.title = "What I ate · Kitchen";
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
        h("h1", { class: "kp-page-header__title" }, "What I ate"),
        h("p", { class: "kp-page-header__description" }, "Every day a recipe was cooked or a food from the zero-prep shelf was eaten. The wheel reads it for “days since last cooked”; nothing here counts or judges."),
      ),
    ),
  );
  const log = tableCard({
    id: "lg-log",
    title: "The log",
    lede: "Cook mode and the recipe page add a line when you cook; the bad-days shelf adds one when you press I ate this.",
    noun: "line",
    plural: "lines",
    columns: [["Day", "number"], ["What", "text"], ["Kind", "text"], ["How it felt", "text"], ["Note"], ["Actions"]],
    add: "Add a line",
    emptyTitle: "Nothing logged yet",
    emptyText: "A line appears when you finish cooking a recipe or eat something from the zero-prep shelf.",
  });
  const page = h("div", { class: "dl-page" }, head, log.card);
  root.replaceChildren(page);
  const detach = attachDataTables(page);
  const handle = dataTable(log.table);
  for (const b of log.addButtons) b.addEventListener("click", () => openRecordEditor("log", null));

  const busy = () => {
    handle?.busy({ text: "Reading the log", overlay: true });
    handle?.state("loading");
  };

  /** @param {Kitchen} k */
  function show(k) {
    const lines = [...k.log].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.created ?? "").localeCompare(String(a.created ?? "")));
    log.body.replaceChildren(
      ...lines.map((e) =>
        h(
          "tr",
          { "data-kp-row-key": e.id },
          h("td", { "data-label": "Day", "data-kp-sort-value": String(Date.parse(`${e.date}T12:00:00Z`)) }, itemLink("log", e, dmy(e.date))),
          h("td", { "data-label": "What" }, logWhat(e)),
          h("td", { "data-label": "Kind" }, e.shelf_id ? "Zero-prep shelf" : "Recipe"),
          h("td", { "data-label": "How it felt" }, e.feeling ? (FEELING[e.feeling] ?? e.feeling) : "–"),
          h("td", { "data-label": "Note" }, e.note || "–"),
          h("td", { "data-label": "Actions" }, rowActions("log", e)),
        ),
      ),
    );
    handle?.refresh({ keepPage: true });
    handle?.state("ready");
  }

  /** @param {boolean} [force] */
  async function load(force = false) {
    if (force || !kitchenNow()) busy();
    try {
      const k = await loadKitchen({ force });
      if (alive) show(k);
    } catch (e) {
      if (alive) handle?.fail(e instanceof Error ? e.message : String(e));
    }
  }
  log.table.addEventListener("kp-datatable-retry", () => void load(true));
  const stop = onKitchen((k) => alive && show(k));
  void load();

  return () => {
    alive = false;
    stop();
    detach();
  };
}
