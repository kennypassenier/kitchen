// What I ate (/log): every line of the kitchen's log, the recipes that were cooked and the shelf foods that were eaten
// (Kenny, 24/10/2026 05:07), newest first. One card with the package's data table and its loading, empty and failed
// states; a new line is typed in the add row on top (records/log-entry.js, Kenny 01/11/2026 20:21), Edit and Delete as on
// /dishes (js/records/), and each line opens its own page.

import { h } from "../dom.js";
import { tableCard, tableIdOf, rowActions, itemLink, logWhat, feelings } from "../records/index.js";
import { logEntry } from "../records/log-entry.js";
import { pageHead, mountTables } from "../records/table-page.js";
import { dmy } from "../format.js";
import { t } from "../i18n/index.js";

/** @typedef {Record<string, any>} Item */

const LOG_ID = "lg-log";

/** The log table card, with the add row on top. @param {HTMLElement} entry */
function buildCard(entry) {
  return tableCard({
    id: LOG_ID,
    title: t("lg.title"),
    lede: t("lg.cardLede"),
    noun: t("lg.noun"),
    plural: t("lg.plural"),
    columns: [[t("rec.day"), "number", undefined, { "data-kp-field": "day" }], [t("rec.what"), "text", undefined, { "data-kp-field": "what" }], [t("it.kind"), "text"], [t("lg.felt"), "text", undefined, { "data-kp-field": "felt" }], [t("rec.note"), undefined, undefined, { "data-kp-field": "note" }], [t("lg.actions")]],
    add: t("list.log.add"),
    emptyTitle: t("lg.emptyTitle"),
    emptyText: t("lg.emptyText"),
    entry,
  });
}

/** @param {Item} e */
function logRow(e) {
  return h(
    "tr",
    { "data-kp-row-key": e.id, "data-kp-row-label": `${logWhat(e)}, ${dmy(e.date)}` },
    h("td", { "data-label": t("rec.day"), "data-kp-sort-value": String(Date.parse(`${e.date}T12:00:00Z`)) }, itemLink("log", e, dmy(e.date))),
    h("td", { "data-label": t("rec.what") }, logWhat(e)),
    h("td", { "data-label": t("it.kind") }, t(e.shelf_id ? "lg.shelf" : "rec.dish")),
    h("td", { "data-label": t("lg.felt") }, e.feeling ? (feelings()[e.feeling] ?? e.feeling) : "–"),
    h("td", { "data-label": t("rec.note") }, e.note || "–"),
    h("td", { "data-label": t("lg.actions") }, rowActions("log", e)),
  );
}

/** @param {HTMLElement} root */
export function mount(root) {
  document.title = `${t("nav.log")} · Kitchen`;
  const entry = logEntry(tableIdOf(LOG_ID));
  const log = buildCard(entry.el);
  const page = h("div", { class: "dl-page" }, pageHead({ title: t("nav.log"), lede: t("lg.lede") }), log.card);
  for (const b of log.addButtons) b.addEventListener("click", entry.focus);
  const stop = mountTables({
    root,
    page,
    cards: [log],
    busyText: t("lg.reading"),
    fill: (k) => {
      const lines = [...k.log].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.created ?? "").localeCompare(String(a.created ?? "")));
      log.body.replaceChildren(...lines.map(logRow));
      entry.refresh();
    },
  });
  // The page is in the document now: the add row's date picker can attach.
  entry.start();
  return stop;
}
