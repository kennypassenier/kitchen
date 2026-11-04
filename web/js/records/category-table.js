// The category tables of /dishes and /ingredients (Kenny, 01/11/2026 20:21, "In de tabel"): a category is edited where
// it stands. Both names are edited in their cell (the kit's in-cell edit: a press or Enter opens it, Enter saves, Esc
// cancels, an empty name is refused there), the order is changed by dragging a row by its handle (or Alt+Up / Alt+Down
// on it, the kit's row reorder), a new one is typed in the add row above the table, and Delete works at once with Undo.
// No drawer is left for a category. An item page's Edit (and the "missing name" badge) opens the cell in its table
// through `?edit=<id>` (records/editors.js).

import { h } from "../dom.js";
import { create, replace, kitchenNow } from "../api.js";
import { t, nameOf, lang } from "../i18n/index.js";
import { saveFailed, noticeIfStale } from "../api/stale-notice.js";
import { names } from "../dishes/names.js";
import { input, NAME_LIMIT } from "../ui/form-parts.js";
import { tableCard, tableIdOf } from "./table-card.js";
import { addLine } from "./add-line.js";
import { detailHref } from "./lists.js";
import { deleteRecord } from "./delete.js";
import { markInUse } from "./in-use.js";
import { byOrder, reordered, nextOrder } from "./order.js";

/** @typedef {"dish_categories" | "ingredient_categories"} CategoryList */
/** @typedef {Record<string, any>} Item */
/** @typedef {{ id: string, title: string, lede: string, plural: string, emptyTitle: string, emptyText: string, usedHead: string, used: (c: Item, k: import("../api.js").Kitchen) => { count: number, text: string } }} CategoryWords */

/** The table's Delete for one category: at once with Undo, off with its reason while in use. @param {CategoryList} list @param {Item} c */
function deleteButton(list, c) {
  const del = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--destructive", "aria-label": t("rec.deleteName", nameOf(c).text) }, t("common.delete"));
  del.addEventListener("click", () => deleteRecord(del, list, c));
  markInUse(del, list, c);
  return h("div", { class: "kp-row-actions" }, del);
}

/** One category row; the two name cells are the kit's edit cells, the drag handle is the kit's. @param {CategoryList} list @param {CategoryWords} w @param {Item} c @param {import("../api.js").Kitchen} k */
function row(list, w, c, k) {
  const n = names(c);
  const used = w.used(c, k);
  return h(
    "tr",
    { "data-kp-row-key": c.id, "data-kp-row-label": nameOf(c).text },
    h("td", { "data-label": t("rec.dutchName"), lang: "nl", "data-half": "nl" }, n.nl),
    h("td", { "data-label": t("rec.englishName"), "data-half": "en" }, n.en),
    h("td", { "data-label": w.usedHead, class: "kp-numeric" }, h("a", { href: detailHref(list, c.id), title: t("it.open", nameOf(c).text) }, used.text)),
    h("td", { "data-label": t("lg.actions") }, deleteButton(list, c)),
  );
}

/**
 * A name edited in its cell: saved at once; an empty half is refused in the cell. A save refused as stale (the category
 * was saved elsewhere since this page read it) shows the shared stale toast with Reload, as every other quick save does
 * (fix-cat-rename-stale-1); the cell still takes the refusal back and shows its words.
 * @param {CategoryList} list @param {CustomEvent} event
 */
function onEdit(list, event) {
  const d = event.detail;
  const half = /** @type {"nl" | "en"} */ (d.cell.dataset.half);
  const item = (kitchenNow()?.[list] ?? []).find((/** @type {Item} */ x) => x.id === d.key);
  const value = String(d.value ?? "").trim();
  if (!item || !half) return d.reject(t("rec.notSaved"));
  if (!value) return d.reject(t(half === "nl" ? "ip.needNl" : "ip.needEn"));
  d.waitUntil(renameSave(list, item, half, value));
}

/** The rename's save; a stale refusal also raises the shared notice, then the error goes on to the cell. @param {CategoryList} list @param {Item} item @param {"nl" | "en"} half @param {string} value */
async function renameSave(list, item, half, value) {
  try {
    return await replace(list, { ...item, name: { ...names(item), [half]: value } });
  } catch (e) {
    noticeIfStale(e);
    throw e;
  }
}

/** A row dragged to another place: every category saved with its new number. @param {CategoryList} list @param {CustomEvent} event */
async function onReorder(list, event) {
  try {
    const order = /** @type {string[]} */ (event.detail.order);
    for (const x of reordered(kitchenNow()?.[list] ?? [], order)) await replace(list, x);
  } catch (e) {
    // A category saved elsewhere since this page read it: the stale notice (fix-quick-rev-1).
    saveFailed(e, () => t("rec.orderNotSaved", e instanceof Error ? e.message : String(e)));
  }
}

/** The add row: a Dutch and an English name. @param {CategoryList} list @param {string} tableId */
function categoryEntry(list, tableId) {
  const nl = /** @type {HTMLInputElement} */ (input("", "text", { autocomplete: "off", lang: "nl", placeholder: list === "dish_categories" ? "Speciaal" : "Vlees", ...NAME_LIMIT }));
  const en = /** @type {HTMLInputElement} */ (input("", "text", { autocomplete: "off", placeholder: list === "dish_categories" ? "Special" : "Meat", ...NAME_LIMIT }));
  return addLine({
    tableId,
    // "Added <name>": the name in the page's language.
    named: lang() === "nl" ? "nl" : "en",
    label: t(`list.${list}.add`),
    submit: t("rec.addInRow"),
    fields: [
      { name: "nl", column: "nl", label: t("rec.dutchName"), control: nl },
      { name: "en", column: "en", label: t("rec.englishName"), control: en },
    ],
    check: () => (!nl.value.trim() ? { name: "nl", message: t("ip.needNl") } : !en.value.trim() ? { name: "en", message: t("ip.needEn") } : null),
    add: async () => void (await create(list, { name: { nl: nl.value.trim(), en: en.value.trim() }, order: nextOrder(kitchenNow()?.[list] ?? []) })),
  });
}

/**
 * The category card of a list page, with its add row and its own fill.
 * @param {CategoryList} list @param {CategoryWords} w
 */
export function categoryCard(list, w) {
  const entry = categoryEntry(list, tableIdOf(w.id));
  const card = tableCard({
    id: w.id,
    title: w.title,
    lede: w.lede,
    noun: t(`list.${list}`),
    plural: w.plural,
    columns: [[t("rec.dutchName"), undefined, undefined, { "data-kp-edit": "text", "data-kp-edit-required": "", "data-kp-field": "nl" }], [t("rec.englishName"), undefined, undefined, { "data-kp-edit": "text", "data-kp-edit-required": "", "data-kp-field": "en" }], [w.usedHead], [t("lg.actions")]],
    add: t(`list.${list}.add`),
    emptyTitle: w.emptyTitle,
    emptyText: w.emptyText,
    entry: entry.el,
    reorder: true,
  });
  for (const b of card.addButtons) b.addEventListener("click", entry.focus);
  card.table.addEventListener("kp-datatable-edit", (e) => onEdit(list, /** @type {CustomEvent} */ (e)));
  card.table.addEventListener("kp-datatable-reorder", (e) => void onReorder(list, /** @type {CustomEvent} */ (e)));
  return {
    ...card,
    /** @param {import("../api.js").Kitchen} k */
    fill: (k) => {
      const items = byOrder(k[list] ?? []);
      card.body.replaceChildren(...items.map((c) => row(list, w, c, k)));
    },
    /** After the table's first fill: open the cell `?edit=<id>` asks for. */
    openAsked: () => openAsked(card.table),
  };
}

/** Open the Dutch name cell of the row `?edit=<id>` names, once, and take the parameter off the address. @param {HTMLElement} table */
function openAsked(table) {
  const url = new URL(location.href);
  const id = url.searchParams.get("edit");
  if (!id) return;
  url.searchParams.delete("edit");
  history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  const rowEl = [...table.querySelectorAll("tr[data-kp-row-key]")].find((r) => r.getAttribute("data-kp-row-key") === id);
  rowEl?.scrollIntoView({ block: "center" });
  /** @type {HTMLElement | null | undefined} */ (rowEl?.querySelector("[data-kp-edit-cell]"))?.click();
}
