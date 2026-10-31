// Part 3: the zero-prep shelf, by how much energy a food asks for; "I ate this" logs it with Undo.

import { setCardState, setSegmentedCounts, setSegmentedValues, toast } from "/static/kp/dist/kp-themes.min.js";
import { kitchenNow, reason } from "../../api.js";
import { h, $ } from "../../dom.js";
import { openRecordEditor, deleteRecord, itemLink, ateShelf } from "../../records/index.js";
import { t, textOf } from "../../i18n/index.js";

/** @typedef {import("../../api.js").Kitchen} Kitchen */
/** @typedef {import("../../api.js").Item} Item */

const LEVELS = { open: ["open"], easy: ["open", "easy"], any: ["open", "easy", "any"] };

/** One shelf food: minutes, name and what to do, and I ate this / Edit / Delete. @param {Item} s */
function shelfRow(s) {
  return h(
    "li",
    { "data-key": s.id },
    h("span", { class: "kp-action-list__lead" }, h("span", { class: "kp-badge" }, `${s.minutes} min`)),
    h(
      "div",
      { class: "kp-action-list__main" },
      h("strong", { class: "kp-action-list__title" }, itemLink("shelf", s)),
      h("span", { class: "kp-action-list__text" }, textOf(s.text)),
      h("span", { class: "kp-action-list__meta" }, h("span", null, textOf(s.gear))),
    ),
    h(
      "div",
      { class: "kp-row-actions" },
      h("button", { type: "button", class: "kp-button kp-button--sm kp-button--primary", "data-bd-pick": s.id, "aria-label": t("bad.ateName", textOf(s.title)) }, t("bad.ate")),
      h("button", { type: "button", class: "kp-button kp-button--sm", "data-bd-shelf-edit": s.id, "aria-label": t("rec.editName", textOf(s.title)) }, t("common.edit")),
      h("button", { type: "button", class: "kp-button kp-button--sm kp-button--destructive", "data-bd-shelf-delete": s.id, "aria-label": t("rec.deleteName", textOf(s.title)) }, t("common.delete")),
    ),
  );
}

/** An empty card with one primary button. @param {HTMLElement} card @param {string} title @param {string} text @param {string} label @param {() => void} onclick */
function emptyWith(card, title, text, label, onclick) {
  const button = h("button", { type: "button", class: "kp-button kp-button--primary" }, label);
  button.addEventListener("click", onclick);
  setCardState(card, "empty", { title, text, action: button });
}

/**
 * I ate this writes a log line for today (Kenny, 24/10/2026 05:07), with Undo; the footer says what was logged.
 * @param {Event} event @param {HTMLElement} readout
 */
async function onShelfClick(event, readout) {
  const el = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest("[data-bd-pick], [data-bd-shelf-edit], [data-bd-shelf-delete]")) : null;
  if (!el || el.getAttribute("aria-disabled") === "true") return;
  const id = el.getAttribute("data-bd-pick") ?? el.getAttribute("data-bd-shelf-edit") ?? el.getAttribute("data-bd-shelf-delete");
  const item = kitchenNow()?.shelf.find((x) => x.id === id);
  if (!item) return;
  if (el.hasAttribute("data-bd-shelf-edit")) return openRecordEditor("shelf", item);
  if (el.hasAttribute("data-bd-shelf-delete")) return deleteRecord(el, "shelf", item);
  el.setAttribute("aria-disabled", "true");
  try {
    readout.textContent = await ateShelf(item);
  } catch (e) {
    toast(t("bad.notLogged", reason(e)), { live: "assertive", sticky: true });
  } finally {
    el.removeAttribute("aria-disabled");
  }
}

/** @typedef {{ ctx: import("./index.js").BadDaysCtx, card: HTMLElement, list: HTMLElement, levelEl: HTMLElement, items: Item[], level: "open" | "easy" | "any" }} ShelfState */

/** @param {ShelfState} s */
function drawShelf(s) {
  const shown = s.items.filter((x) => LEVELS[s.level].includes(x.energy));
  if (!s.items.length) {
    emptyWith(s.card, t("bad.shelfEmpty"), t("bad.shelfEmptyText"), t("bad.addFood"), () => openRecordEditor("shelf", null));
    return;
  }
  if (!shown.length) {
    emptyWith(s.card, t("bad.littleTitle"), t("bad.littleText"), t("bad.showAll"), () => setSegmentedValues(s.levelEl, ["any"]));
    return;
  }
  s.list.replaceChildren(...shown.map(shelfRow));
  setCardState(s.card, "ready");
}

/** @param {ShelfState} s @param {Kitchen} k */
function renderShelf(s, k) {
  const { drawn } = s.ctx;
  const signature = JSON.stringify(k.shelf.map((x) => [x.id, textOf(x.title), x.text, x.minutes, textOf(x.gear), x.energy]));
  if (signature === drawn.shelf) return;
  drawn.shelf = signature;
  s.items = [...k.shelf];
  const open = s.items.filter((x) => x.energy === "open").length;
  const easy = s.items.filter((x) => x.energy === "easy").length;
  setSegmentedCounts(s.levelEl, { open, easy: open + easy, any: s.items.length });
  drawShelf(s);
}

/** @param {import("./index.js").BadDaysCtx} ctx */
export function createShelf(ctx) {
  const { page } = ctx;
  /** @type {ShelfState} */
  const s = {
    ctx,
    card: /** @type {HTMLElement} */ ($("#bd-shelf-card", page)),
    list: /** @type {HTMLElement} */ ($("[data-bd-shelf]", page)),
    levelEl: /** @type {HTMLElement} */ ($("[data-bd-level]", page)),
    items: [],
    level: "any",
  };
  const readout = /** @type {HTMLElement} */ ($("[data-bd-shelf-readout]", page));
  s.levelEl.addEventListener("kp-segmented-change", (event) => {
    const value = /** @type {CustomEvent} */ (event).detail.value;
    if (value !== "open" && value !== "easy" && value !== "any") return;
    s.level = value;
    drawShelf(s);
  });
  s.list.addEventListener("click", (event) => onShelfClick(event, readout));
  $("[data-bd-shelf-add]", page)?.addEventListener("click", () => openRecordEditor("shelf", null));
  s.card.addEventListener("kp-card-retry", ctx.reload);
  return {
    render: (/** @type {Kitchen} */ k) => renderShelf(s, k),
    loading: () => setCardState(s.card, "loading"),
    /** @param {string} why */
    failed: (why) => setCardState(s.card, "error", { title: t("bad.shelfFailed"), text: `${why} ${t("bad.nothingChanged")}` }),
  };
}
