// Part 3: the zero-prep shelf, by how much energy a food asks for; "I ate this" logs it with Undo.

import { setCardState } from "/static/kp/js/card-state.js";
import { setSegmentedCounts, setSegmentedValues } from "/static/kp/js/segmented.js";
import { toast } from "/static/kp/js/overlays.js";
import { kitchenNow, reason } from "../../api.js";
import { h, $ } from "../../dom.js";
import { openRecordEditor, deleteRecord, itemLink, ateShelf } from "../../records/index.js";
import { t, textOf } from "../../i18n/index.js";

/** @typedef {import("../../api.js").Kitchen} Kitchen */
/** @typedef {import("../../api.js").Item} Item */

/** @param {import("./index.js").BadDaysCtx} ctx */
export function createShelf(ctx) {
  const { page, drawn } = ctx;
  const shelfCard = /** @type {HTMLElement} */ ($("#bd-shelf-card", page));
  const shelfList = /** @type {HTMLElement} */ ($("[data-bd-shelf]", page));
  const shelfLevel = /** @type {HTMLElement} */ ($("[data-bd-level]", page));
  const shelfReadout = /** @type {HTMLElement} */ ($("[data-bd-shelf-readout]", page));
  /** @type {Item[]} */
  let shelfItems = [];
  /** @type {"open" | "easy" | "any"} */
  let level = "any";
  const LEVELS = { open: ["open"], easy: ["open", "easy"], any: ["open", "easy", "any"] };

  function drawShelf() {
    const shown = shelfItems.filter((s) => LEVELS[level].includes(s.energy));
    if (!shelfItems.length) {
      const go = h("button", { type: "button", class: "kp-button kp-button--primary" }, t("bad.addFood"));
      go.addEventListener("click", () => openRecordEditor("shelf", null));
      setCardState(shelfCard, "empty", {
        title: t("bad.shelfEmpty"),
        text: t("bad.shelfEmptyText"),
        action: go,
      });
      return;
    }
    if (!shown.length) {
      const all = h("button", { type: "button", class: "kp-button kp-button--primary" }, t("bad.showAll"));
      all.addEventListener("click", () => setSegmentedValues(shelfLevel, ["any"]));
      setCardState(shelfCard, "empty", {
        title: t("bad.littleTitle"),
        text: t("bad.littleText"),
        action: all,
      });
      return;
    }
    shelfList.replaceChildren(
      ...shown.map((s) =>
        h(
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
        ),
      ),
    );
    setCardState(shelfCard, "ready");
  }

  /** @param {Kitchen} k */
  function renderShelf(k) {
    const signature = JSON.stringify(k.shelf.map((s) => [s.id, textOf(s.title), s.text, s.minutes, textOf(s.gear), s.energy]));
    if (signature === drawn.shelf) return;
    drawn.shelf = signature;
    shelfItems = [...k.shelf];
    const open = shelfItems.filter((s) => s.energy === "open").length;
    const easy = shelfItems.filter((s) => s.energy === "easy").length;
    setSegmentedCounts(shelfLevel, { open, easy: open + easy, any: shelfItems.length });
    drawShelf();
  }

  shelfLevel.addEventListener("kp-segmented-change", (event) => {
    const value = /** @type {CustomEvent} */ (event).detail.value;
    if (value !== "open" && value !== "easy" && value !== "any") return;
    level = value;
    drawShelf();
  });
  // I ate this writes a log line for today (Kenny, 24/10/2026 05:07), with Undo; the footer says what was logged.
  shelfList.addEventListener("click", async (event) => {
    const el = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest("[data-bd-pick], [data-bd-shelf-edit], [data-bd-shelf-delete]")) : null;
    if (!el || el.getAttribute("aria-disabled") === "true") return;
    const id = el.getAttribute("data-bd-pick") ?? el.getAttribute("data-bd-shelf-edit") ?? el.getAttribute("data-bd-shelf-delete");
    const item = kitchenNow()?.shelf.find((x) => x.id === id);
    if (!item) return;
    if (el.hasAttribute("data-bd-shelf-edit")) return openRecordEditor("shelf", item);
    if (el.hasAttribute("data-bd-shelf-delete")) return deleteRecord(el, "shelf", item);
    el.setAttribute("aria-disabled", "true");
    try {
      shelfReadout.textContent = await ateShelf(item);
    } catch (e) {
      toast(t("bad.notLogged", reason(e)), { live: "assertive", sticky: true });
    } finally {
      el.removeAttribute("aria-disabled");
    }
  });
  $("[data-bd-shelf-add]", page)?.addEventListener("click", () => openRecordEditor("shelf", null));
  shelfCard.addEventListener("kp-card-retry", ctx.reload);
  return {
    render: renderShelf,
    loading: () => setCardState(shelfCard, "loading"),
    /** @param {string} why */
    failed: (why) => setCardState(shelfCard, "error", { title: t("bad.shelfFailed"), text: `${why} ${t("bad.nothingChanged")}` }),
  };
}
