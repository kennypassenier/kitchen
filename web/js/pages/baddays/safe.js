// Part 1: the safe dishes, the ones that always work.

import { setCardState } from "/static/kp/js/card-state.js";
import { h, $ } from "../../dom.js";
import { openSafePicker, openRecipeEditor, unmarkSafe } from "../../records/index.js";
import { t } from "../../i18n/index.js";
import { dmy } from "../../format.js";
import { safeRecipes, firstSentence, lastMade } from "./helpers.js";

/** @typedef {import("../../api.js").Kitchen} Kitchen */

/** One safe dish: its link with the first sentence and when it was last made, and Edit / Not safe. @param {Kitchen} k @param {Record<string, any>} r */
function safeRow(k, r) {
  const made = lastMade(k, r.id);
  const text = r.summary ? firstSentence(String(r.summary)) : t("bad.takesAbout", r.minutes, r.gear);
  const edit = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": t("rec.editName", r.name) }, t("common.edit"));
  const unsafe = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": t("bad.notSafeName", r.name) }, t("bad.notSafe"));
  edit.addEventListener("click", () => openRecipeEditor(r));
  unsafe.addEventListener("click", () => unmarkSafe(r));
  return h(
    "li",
    { class: "bd-safe__item" },
    h(
      "a",
      { class: "kp-action", href: `/recipe?id=${encodeURIComponent(r.id)}` },
      h("strong", { class: "kp-action__title" }, r.name),
      h("span", { class: "kp-action__mark", "aria-hidden": "true" }),
      h("span", { class: "kp-action__text" }, text),
      h("span", { class: "kp-action__meta" }, h("span", null, `${r.minutes} min, ${r.gear}`), h("span", null, made ? t("bad.lastMade", dmy(made)) : t("bad.notMade"))),
    ),
    h("div", { class: "kp-row-actions" }, edit, unsafe),
  );
}

/** No safe dish yet: the card says so and offers the picker. @param {HTMLElement} card */
function showNoSafe(card) {
  const pick = h("button", { type: "button", class: "kp-button kp-button--primary" }, t("bad.addSafe"));
  pick.addEventListener("click", () => openSafePicker());
  setCardState(card, "empty", { title: t("bad.noSafe"), text: t("bad.noSafeText"), action: pick });
}

/** @param {import("./index.js").BadDaysCtx} ctx */
export function createSafe(ctx) {
  const { page, drawn } = ctx;
  const safeCard = /** @type {HTMLElement} */ ($("#bd-safe-card", page));
  const safeList = /** @type {HTMLElement} */ ($("[data-bd-safe]", page));
  const safeCount = /** @type {HTMLElement} */ ($("[data-bd-safe-count]", page));
  /** @param {Kitchen} k */
  function renderSafe(k) {
    const dishes = safeRecipes(k);
    const signature = JSON.stringify(dishes.map((r) => [r.id, r.name, r.summary, r.minutes, r.gear, lastMade(k, r.id)]));
    if (signature === drawn.safe) return;
    drawn.safe = signature;
    safeCount.textContent = t("bad.dishCount", dishes.length);
    if (!dishes.length) {
      showNoSafe(safeCard);
      return;
    }
    safeList.replaceChildren(...dishes.map((r) => safeRow(k, r)));
    setCardState(safeCard, "ready");
  }
  $("[data-bd-safe-add]", page)?.addEventListener("click", () => openSafePicker());
  safeCard.addEventListener("kp-card-retry", ctx.reload);
  return {
    render: renderSafe,
    loading: () => setCardState(safeCard, "loading"),
    /** @param {string} why */
    failed: (why) => setCardState(safeCard, "error", { title: t("bad.safeFailed"), text: `${why} ${t("bad.stillSaved")}` }),
  };
}
