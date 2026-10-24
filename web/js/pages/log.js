// What I ate (/log): every line of the kitchen's log, the recipes that were cooked and the shelf foods that were eaten
// (Kenny, 24/10/2026 05:07), newest first. One card with the package's data table and its loading, empty and failed
// states; Add, Edit and Delete as on /dishes (js/records.js), and each line opens its own page.

import { attachDataTables, dataTable } from "/static/kp/js/datatable.js";
import { loadKitchen, onKitchen, kitchenNow } from "../api.js";
import { h } from "../dom.js";
import { tableCard, rowActions, itemLink, openRecordEditor, logWhat, dmy, feelings } from "../records.js";
import { t } from "../i18n/index.js";

/** @typedef {import("../api.js").Kitchen} Kitchen */
/** @typedef {Record<string, any>} Item */

/** @param {HTMLElement} root */
export function mount(root) {
  document.title = `${t("nav.log")} · Kitchen`;
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
        h("h1", { class: "kp-page-header__title" }, t("nav.log")),
        h("p", { class: "kp-page-header__description" }, t("lg.lede")),
      ),
    ),
  );
  const log = tableCard({
    id: "lg-log",
    title: t("lg.title"),
    lede: t("lg.cardLede"),
    noun: t("lg.noun"),
    plural: t("lg.plural"),
    columns: [[t("rec.day"), "number"], [t("rec.what"), "text"], [t("it.kind"), "text"], [t("lg.felt"), "text"], [t("rec.note")], [t("lg.actions")]],
    add: t("list.log.add"),
    emptyTitle: t("lg.emptyTitle"),
    emptyText: t("lg.emptyText"),
  });
  const page = h("div", { class: "dl-page" }, head, log.card);
  root.replaceChildren(page);
  const detach = attachDataTables(page);
  const handle = dataTable(log.table);
  for (const b of log.addButtons) b.addEventListener("click", () => openRecordEditor("log", null));

  const busy = () => {
    handle?.busy({ text: t("lg.reading"), overlay: true });
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
          h("td", { "data-label": t("rec.day"), "data-kp-sort-value": String(Date.parse(`${e.date}T12:00:00Z`)) }, itemLink("log", e, dmy(e.date))),
          h("td", { "data-label": t("rec.what") }, logWhat(e)),
          h("td", { "data-label": t("it.kind") }, t(e.shelf_id ? "lg.shelf" : "rec.dish")),
          h("td", { "data-label": t("lg.felt") }, e.feeling ? (feelings()[e.feeling] ?? e.feeling) : "–"),
          h("td", { "data-label": t("rec.note") }, e.note || "–"),
          h("td", { "data-label": t("lg.actions") }, rowActions("log", e)),
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
