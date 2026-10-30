// A card's state follows the data and the model: loading, failed, nothing on the wheel (with the buttons that fix it) or
// ready. The two cards (the wheel and the list) share this; each keeps the key of what it last drew so nothing flickers.

import { h } from "../../dom.js";
import { setCardState, CARD_RETRY_EVENT } from "/static/kp/js/card-state.js";
import { attachArt } from "/static/kp/js/art.js";
import { t } from "../../i18n/index.js";
import { loadingWords } from "./labels.js";
import { blockText, filterCount } from "./model.js";
import { loosenOne } from "./actions.js";
import { clearFilters, reload } from "./filters.js";

/** The empty and failed notes carry the package's drawing. @param {import("./index.js").WheelCtx} ctx @param {HTMLElement} cardEl */
function drawArt(ctx, cardEl) {
  const box = cardEl.querySelector(".kp-card__empty:not([data-kp-art]), .kp-card__failure:not([data-kp-art])");
  if (!box) return;
  box.setAttribute("data-kp-art", box.classList.contains("kp-card__failure") ? "error" : "nomatch");
  ctx.cleanups.push(attachArt(cardEl));
}

/** Nothing on the wheel: no dishes at all (go and add some), or the filters hold every one back (loosen or clear). @param {import("./index.js").WheelCtx} ctx @param {HTMLElement} cardEl @param {(text: string) => void} say */
function showNothing(ctx, cardEl, say) {
  /** @type {HTMLElement[]} */
  const action = [];
  if (!ctx.dishes.length) {
    action.push(h("a", { class: "kp-button kp-button--primary kp-stateplate__action", href: "/dishes", title: t("wheel.openDishesTitle") }, t("wheel.openDishes")));
    setCardState(cardEl, "empty", { title: t("wheel.noDishes"), text: t("wheel.noDishesText"), action });
    return;
  }
  action.push(h("button", { type: "button", class: "kp-button kp-button--primary kp-stateplate__action", title: t("wheel.loosenTitle"), onclick: () => void loosenOne(ctx, say) }, t("wheel.loosen")));
  if (filterCount(ctx, ctx.M)) action.push(h("button", { type: "button", class: "kp-button kp-stateplate__action", title: t("wheel.clearTitle"), onclick: () => clearFilters(ctx) }, t("wheel.clearAll")));
  setCardState(cardEl, "empty", { title: t("wheel.noMatch"), text: `${blockText(ctx, ctx.M)} ${t("wheel.loosenAndBack")}`, action });
}

/**
 * @param {import("./index.js").WheelCtx} ctx @param {HTMLElement} cardEl @param {"wheel" | "list"} kind @param {(text: string) => void} say
 * @returns {(n: number) => void} the function that syncs the card for `n` dishes on the wheel
 */
export function createCardSync(ctx, cardEl, kind, say) {
  const badge = /** @type {HTMLElement} */ (cardEl.querySelector(".kp-badge"));
  let cardKey = "";
  cardEl.addEventListener(CARD_RETRY_EVENT, () => void reload(ctx));
  return (n) => {
    const { status, dishes, failure } = ctx;
    badge.textContent = status !== "ready" ? "" : kind === "list" ? t("wheel.nOfM", n, dishes.length) : t("wheel.dishCount", n);
    const none = status === "ready" && n === 0;
    const key = status === "ready" ? (none ? `empty:${dishes.length}:${blockText(ctx, ctx.M)}:${filterCount(ctx, ctx.M)}` : "ready") : `${status}:${failure}`;
    if (key === cardKey) return;
    cardKey = key;
    if (status === "loading") setCardState(cardEl, "loading", { words: loadingWords() });
    else if (status === "error") setCardState(cardEl, "error", { title: t("wheel.failedTitle"), text: failure });
    else if (none) showNothing(ctx, cardEl, say);
    else setCardState(cardEl, "ready");
    drawArt(ctx, cardEl);
  };
}
