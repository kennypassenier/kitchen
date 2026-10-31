// Part 2: the freezer table: rows, Take one portion with Undo, Edit and Delete.

import { dataTable, agoMoment, undoToast, toast } from "/static/kp/dist/kp-themes.min.js";
import { kitchenNow, takePortions, reason } from "../../api.js";
import { h, $ } from "../../dom.js";
import { openRecordEditor, deleteRecord, itemLink } from "../../records/index.js";
import { t, textOf } from "../../i18n/index.js";
import { DAY, OLD_AFTER_DAYS, UNDO_MS, frozenAt } from "./helpers.js";

/** @typedef {import("../../api.js").Kitchen} Kitchen */
/** @typedef {import("../../api.js").Item} Item */

/** The row's three buttons: Take one, Edit, Delete. @param {Item} item */
function rowButtons(item) {
  const dish = textOf(item.dish);
  return h(
    "div",
    { class: "kp-row-actions" },
    h("button", { type: "button", class: "kp-button kp-button--sm", "data-bd-take": item.id, "aria-label": t("bad.takeName", dish) }, t("bad.takeOne")),
    h("button", { type: "button", class: "kp-button kp-button--sm", "data-bd-edit": item.id, "aria-label": t("rec.editName", dish) }, t("common.edit")),
    h("button", { type: "button", class: "kp-button kp-button--sm kp-button--destructive", "data-bd-delete": item.id, "aria-label": t("rec.deleteName", dish) }, t("common.delete")),
  );
}

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
    h("td", null, h("span", old ? { class: "kp-badge bd-hint" } : { class: "kp-badge bd-hint bd-hint--none", "aria-hidden": "true" }, old ? t("bad.useNext") : t("bad.fine"))),
    h("td", null, rowButtons(item)),
  );
  return tr;
}

/** @typedef {{ ctx: import("./index.js").BadDaysCtx, freezerTable: HTMLElement, rows: HTMLElement }} FreezerParts */

/** @param {FreezerParts} f @param {Kitchen} k */
function renderFreezer({ ctx, freezerTable, rows }, k) {
  const items = k.freezer.filter((f) => f.portions > 0).sort((a, b) => frozenAt(a) - frozenAt(b));
  const signature = JSON.stringify(items.map((f) => [f.id, textOf(f.dish), f.portions, f.frozen_on]));
  if (signature === ctx.drawn.freezer) return;
  const first = ctx.drawn.freezer === null;
  ctx.drawn.freezer = signature;
  const tb = dataTable(freezerTable);
  // The table reconciles its own rows on refresh (kp-themes 6f9301bc): write the fresh rows, ask it to re-read them.
  rows.replaceChildren(...items.map(freezerRow));
  tb?.refresh({ keepPage: true });
  if (first) {
    tb?.state("ready");
    tb?.sort({ column: 2, direction: "ascending" });
  }
}

/** Edit and Delete of a freezer row: the shared drawer and the typed-name confirmation (js/records/). @param {Event} event */
function onEditOrDelete(event) {
  const el = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest("[data-bd-edit], [data-bd-delete]")) : null;
  if (!el) return;
  const id = el.getAttribute("data-bd-edit") ?? el.getAttribute("data-bd-delete");
  const item = kitchenNow()?.freezer.find((f) => f.id === id);
  if (!item) return;
  if (el.hasAttribute("data-bd-edit")) openRecordEditor("freezer", item);
  else deleteRecord(el, "freezer", item);
}

/** Take one portion; the toast offers the way back. @param {HTMLElement} button */
async function takeOne(button) {
  const id = button.getAttribute("data-bd-take") ?? "";
  const dish = textOf(kitchenNow()?.freezer.find((f) => f.id === id)?.dish) || t("bad.theDish");
  button.setAttribute("aria-disabled", "true");
  try {
    const after = await takePortions(id, 1);
    undoToast(after.portions < 1 ? t("bad.tookLast", dish) : t("bad.took", after.portions, dish), {
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
    });
  } catch (e) {
    toast(t("bad.takeFailed", dish, reason(e)), { live: "assertive", sticky: true });
  } finally {
    button.removeAttribute("aria-disabled");
  }
}

/** @param {FreezerParts} f */
function wireFreezer({ ctx, freezerTable, rows }) {
  rows.addEventListener("click", onEditOrDelete);
  rows.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest("[data-bd-take]")) : null;
    if (!button || button.getAttribute("aria-disabled") === "true") return;
    void takeOne(button);
  });
  // The empty freezer's one action: the add form below.
  freezerTable.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest("[data-bd-add]")) return;
    const field = /** @type {HTMLInputElement | null} */ ($("#bd-add-dish", ctx.page));
    field?.scrollIntoView({ block: "center" });
    field?.focus();
  });
  freezerTable.addEventListener("kp-datatable-retry", ctx.reload);
}

/** @param {import("./index.js").BadDaysCtx} ctx */
export function createFreezer(ctx) {
  const freezerTable = /** @type {HTMLElement} */ ($("#bd-freezer", ctx.page));
  const rows = /** @type {HTMLElement} */ ($("[data-bd-rows]", ctx.page));
  const f = { ctx, freezerTable, rows };
  wireFreezer(f);
  return {
    render: (/** @type {Kitchen} */ k) => renderFreezer(f, k),
    loading: () => {
      const tb = dataTable(freezerTable);
      tb?.busy({ text: t("bad.loadingFreezer"), since: Date.now(), overlay: true });
      tb?.state("loading");
    },
    /** @param {string} why */
    failed: (why) => dataTable(freezerTable)?.fail(`${t("bad.freezerFailed")} ${why} ${t("bad.stillCounted")}`),
  };
}
