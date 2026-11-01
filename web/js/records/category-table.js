// The category tables of /dishes and /ingredients (Kenny, 01/11/2026 20:21, "In de tabel"): a category is edited where
// it stands. Both names are edited in their cell (the kit's in-cell edit: a press or Enter opens it, Enter saves, Esc
// cancels, an empty name is refused there), the order is changed by dragging a row by its handle (or Alt+Up / Alt+Down
// on it, the kit's row reorder), a new one is typed in the add row above the table, and Delete works at once with Undo.
// No drawer is left for a category. An item page's Edit (and the "missing name" badge) opens the cell in its table
// through `?edit=<id>` (records/editors.js).

import { toast } from "/static/kp/dist/kp-themes.min.js";
import { h } from "../dom.js";
import { create, replace, kitchenNow } from "../api.js";
import { t, nameOf } from "../i18n/index.js";
import { names } from "../dishes/names.js";
import { input } from "../ui/form-parts.js";
import { tableCard } from "./table-card.js";
import { addRow } from "./add-row.js";
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

/**
 * The row keys: the kit names a row by its key in its edit line and its screen-reader words ("Speciaal: English name
 * changed …", kp-gaps/kitchen.md), so the key is the category's name as shown, made unique with a number; `ids` maps
 * the keys back to the categories.
 * @param {Item[]} items @returns {{ keys: string[], ids: Map<string, string> }}
 */
function rowKeys(items) {
  const ids = new Map();
  const keys = items.map((c) => {
    const base = nameOf(c).text || "–";
    let key = base;
    for (let n = 2; ids.has(key); n++) key = `${base} (${n})`;
    ids.set(key, c.id);
    return key;
  });
  return { keys, ids };
}

/** One category row; the two name cells are the kit's edit cells, the drag handle is the kit's. @param {CategoryList} list @param {CategoryWords} w @param {Item} c @param {string} key @param {import("../api.js").Kitchen} k */
function row(list, w, c, key, k) {
  const n = names(c);
  const used = w.used(c, k);
  return h(
    "tr",
    { "data-kp-row-key": key },
    h("td", { "data-label": t("rec.dutchName"), lang: "nl", "data-half": "nl" }, n.nl),
    h("td", { "data-label": t("rec.englishName"), "data-half": "en" }, n.en),
    h("td", { "data-label": w.usedHead, class: "kp-numeric" }, h("a", { href: detailHref(list, c.id), title: t("it.open", nameOf(c).text) }, used.text)),
    h("td", { "data-label": t("lg.actions") }, deleteButton(list, c)),
  );
}

/** A name edited in its cell: saved at once; an empty half is refused in the cell. @param {CategoryList} list @param {Map<string, string>} ids @param {CustomEvent} event */
function onEdit(list, ids, event) {
  const d = event.detail;
  const half = /** @type {"nl" | "en"} */ (d.cell.dataset.half);
  const item = (kitchenNow()?.[list] ?? []).find((/** @type {Item} */ x) => x.id === ids.get(d.key));
  const value = String(d.value ?? "").trim();
  if (!item || !half) return d.reject(t("rec.notSaved"));
  if (!value) return d.reject(t(half === "nl" ? "ip.needNl" : "ip.needEn"));
  d.waitUntil(replace(list, { ...item, name: { ...names(item), [half]: value } }));
}

/** A row dragged to another place: every category saved with its new number. @param {CategoryList} list @param {Map<string, string>} ids @param {CustomEvent} event */
async function onReorder(list, ids, event) {
  try {
    const order = /** @type {string[]} */ (event.detail.order).map((key) => ids.get(key) ?? key);
    for (const x of reordered(kitchenNow()?.[list] ?? [], order)) await replace(list, x);
  } catch (e) {
    toast(t("rec.orderNotSaved", e instanceof Error ? e.message : String(e)), { live: "assertive", sticky: true });
  }
}

/** The add row: a Dutch and an English name. @param {CategoryList} list */
function categoryEntry(list) {
  const nl = /** @type {HTMLInputElement} */ (input("", "text", { autocomplete: "off", lang: "nl", placeholder: list === "dish_categories" ? "Speciaal" : "Vlees" }));
  const en = /** @type {HTMLInputElement} */ (input("", "text", { autocomplete: "off", placeholder: list === "dish_categories" ? "Special" : "Meat" }));
  return addRow({
    label: t(`list.${list}.add`),
    submit: t("rec.addInRow"),
    fields: [
      { label: t("rec.dutchName"), control: nl, size: "wide" },
      { label: t("rec.englishName"), control: en, size: "wide" },
    ],
    reset: () => {
      nl.value = "";
      en.value = "";
    },
    check: () => (!nl.value.trim() ? { field: nl, message: t("ip.needNl") } : !en.value.trim() ? { field: en, message: t("ip.needEn") } : null),
    add: async () => {
      const made = await create(list, { name: { nl: nl.value.trim(), en: en.value.trim() }, order: nextOrder(kitchenNow()?.[list] ?? []) });
      return t("rec.addedName", nameOf(made).text);
    },
  });
}

/**
 * The category card of a list page, with its add row and its own fill.
 * @param {CategoryList} list @param {CategoryWords} w
 */
export function categoryCard(list, w) {
  const entry = categoryEntry(list);
  const card = tableCard({
    id: w.id,
    title: w.title,
    lede: w.lede,
    noun: t(`list.${list}`),
    plural: w.plural,
    columns: [[t("rec.dutchName"), undefined, undefined, { "data-kp-edit": "text", "data-kp-edit-required": "" }], [t("rec.englishName"), undefined, undefined, { "data-kp-edit": "text", "data-kp-edit-required": "" }], [w.usedHead], [t("lg.actions")]],
    add: t(`list.${list}.add`),
    emptyTitle: w.emptyTitle,
    emptyText: w.emptyText,
    entry: entry.el,
    reorder: true,
  });
  for (const b of card.addButtons) b.addEventListener("click", entry.focus);
  const stopEntry = entry.stop;
  /** The row keys of the last fill, back to the ids. @type {Map<string, string>} */
  let ids = new Map();
  card.table.addEventListener("kp-datatable-edit", (e) => onEdit(list, ids, /** @type {CustomEvent} */ (e)));
  card.table.addEventListener("kp-datatable-reorder", (e) => void onReorder(list, ids, /** @type {CustomEvent} */ (e)));
  return {
    ...card,
    /** @param {import("../api.js").Kitchen} k */
    fill: (k) => {
      const items = byOrder(k[list] ?? []);
      const made = rowKeys(items);
      ids = made.ids;
      card.body.replaceChildren(...items.map((c, at) => row(list, w, c, made.keys[at], k)));
    },
    /** After the table's first fill: open the cell `?edit=<id>` asks for. */
    openAsked: () => openAsked(card.table, ids),
    /** Take the add row's form wiring away. */
    stop: stopEntry,
  };
}

/** Open the Dutch name cell of the row `?edit=<id>` names, once, and take the parameter off the address. @param {HTMLElement} table @param {Map<string, string>} ids */
function openAsked(table, ids) {
  const url = new URL(location.href);
  const id = url.searchParams.get("edit");
  if (!id) return;
  url.searchParams.delete("edit");
  history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  const rowEl = [...table.querySelectorAll("tr[data-kp-row-key]")].find((r) => ids.get(r.getAttribute("data-kp-row-key") ?? "") === id);
  rowEl?.scrollIntoView({ block: "center" });
  /** @type {HTMLElement | null | undefined} */ (rowEl?.querySelector("[data-kp-edit-cell]"))?.click();
}
