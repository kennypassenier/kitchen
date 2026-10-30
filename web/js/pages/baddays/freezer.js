// Part 2: the freezer table: rows, Take one portion with Undo, Edit and Delete.

import { dataTable } from "/static/kp/js/datatable.js";
import { agoMoment } from "/static/kp/js/freshness.js";
import { undoToast } from "/static/kp/js/undo-toast.js";
import { toast } from "/static/kp/js/overlays.js";
import { kitchenNow, takePortions, reason } from "../../api.js";
import { h, $ } from "../../dom.js";
import { openRecordEditor, deleteRecord, itemLink } from "../../records/index.js";
import { t, textOf } from "../../i18n/index.js";
import { DAY, OLD_AFTER_DAYS, UNDO_MS, frozenAt } from "./helpers.js";

/** @typedef {import("../../api.js").Kitchen} Kitchen */
/** @typedef {import("../../api.js").Item} Item */

/** @param {import("./index.js").BadDaysCtx} ctx */
export function createFreezer(ctx) {
  const { page, drawn } = ctx;
  const freezerTable = /** @type {HTMLElement} */ ($("#bd-freezer", page));
  const rows = /** @type {HTMLElement} */ ($("[data-bd-rows]", page));
  const table = () => dataTable(freezerTable);

  /** @param {Item} item */
  function freezerRow(item) {
    const at = frozenAt(item);
    const old = (Date.now() - at) / DAY >= OLD_AFTER_DAYS;
    const tr = h("tr", { "data-key": item.id });
    tr.append(
      h("td", null, h("strong", null, itemLink("freezer", item))),
      h("td", { "data-kp-sort-value": String(item.portions) }, String(item.portions)),
      h("td", { "data-kp-sort-value": String(at) }, agoMoment(at).slice(0, 10)),
      h("td", null, h("time", { class: "kp-ago", "data-kp-ago": "", "data-kp-ago-verb": t("bad.frozenVerb"), datetime: new Date(at).toISOString() }, "")),
      h(
        "td",
        null,
        h(
          "span",
          old ? { class: "kp-badge bd-hint" } : { class: "kp-badge bd-hint bd-hint--none", "aria-hidden": "true" },
          old ? t("bad.useNext") : t("bad.fine"),
        ),
      ),
      h(
        "td",
        null,
        h(
          "div",
          { class: "kp-row-actions" },
          h(
            "button",
            { type: "button", class: "kp-button kp-button--sm", "data-bd-take": item.id, "aria-label": t("bad.takeName", textOf(item.dish)) },
            t("bad.takeOne"),
          ),
          h("button", { type: "button", class: "kp-button kp-button--sm", "data-bd-edit": item.id, "aria-label": t("rec.editName", textOf(item.dish)) }, t("common.edit")),
          h("button", { type: "button", class: "kp-button kp-button--sm kp-button--destructive", "data-bd-delete": item.id, "aria-label": t("rec.deleteName", textOf(item.dish)) }, t("common.delete")),
        ),
      ),
    );
    return tr;
  }

  /** @param {Kitchen} k */
  function renderFreezer(k) {
    const items = k.freezer.filter((f) => f.portions > 0).sort((a, b) => frozenAt(a) - frozenAt(b));
    const signature = JSON.stringify(items.map((f) => [f.id, textOf(f.dish), f.portions, f.frozen_on]));
    if (signature === drawn.freezer) return;
    const first = drawn.freezer === null;
    drawn.freezer = signature;
    const tb = table();
    // The table reconciles its own rows on refresh (kp-themes 6f9301bc): write the fresh rows, ask it to re-read them.
    rows.replaceChildren(...items.map(freezerRow));
    tb?.refresh({ keepPage: true });
    if (first) {
      tb?.state("ready");
      tb?.sort({ column: 2, direction: "ascending" });
    }
  }

  // Edit and Delete of a freezer row: the shared drawer and the typed-name confirmation (js/records/).
  rows.addEventListener("click", (event) => {
    const el = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest("[data-bd-edit], [data-bd-delete]")) : null;
    if (!el) return;
    const id = el.getAttribute("data-bd-edit") ?? el.getAttribute("data-bd-delete");
    const item = kitchenNow()?.freezer.find((f) => f.id === id);
    if (!item) return;
    if (el.hasAttribute("data-bd-edit")) openRecordEditor("freezer", item);
    else deleteRecord(el, "freezer", item);
  });
  rows.addEventListener("click", async (event) => {
    const button = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest("[data-bd-take]")) : null;
    if (!button || button.getAttribute("aria-disabled") === "true") return;
    const id = button.getAttribute("data-bd-take") ?? "";
    const dish = textOf(kitchenNow()?.freezer.find((f) => f.id === id)?.dish) || t("bad.theDish");
    button.setAttribute("aria-disabled", "true");
    try {
      const after = await takePortions(id, 1);
      undoToast(
        after.portions < 1 ? t("bad.tookLast", dish) : t("bad.took", after.portions, dish),
        {
          mode: "revert",
          ms: UNDO_MS,
          clock: "ring",
          max: 2,
          undo: async () => {
            try {
              await takePortions(id, -1);
            } catch (e) {
              toast(t("rec.notBack", reason(e)), { live: "assertive", sticky: true });
            }
          },
        },
      );
    } catch (e) {
      toast(t("bad.takeFailed", dish, reason(e)), { live: "assertive", sticky: true });
    } finally {
      button.removeAttribute("aria-disabled");
    }
  });

  // The empty freezer's one action: the add form below.
  freezerTable.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest("[data-bd-add]")) return;
    const field = /** @type {HTMLInputElement | null} */ ($("#bd-add-dish", page));
    field?.scrollIntoView({ block: "center" });
    field?.focus();
  });
  freezerTable.addEventListener("kp-datatable-retry", ctx.reload);
  return {
    render: renderFreezer,
    loading: () => {
      const tb = table();
      tb?.busy({ text: t("bad.loadingFreezer"), since: Date.now(), overlay: true });
      tb?.state("loading");
    },
    /** @param {string} why */
    failed: (why) => table()?.fail(`${t("bad.freezerFailed")} ${why} ${t("bad.stillCounted")}`),
  };
}
