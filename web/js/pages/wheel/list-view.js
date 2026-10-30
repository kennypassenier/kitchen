// The "dishes that fit" card: one row per dish on the wheel, with when it was last cooked and a badge when its slice is bigger.

import { h } from "../../dom.js";
import { t } from "../../i18n/index.js";
import { cap } from "../../format.js";
import * as L from "./logic.js";
import { mealLabels, minutesText } from "./labels.js";
import { byId, bigger, onWheel } from "./model.js";
import { badgeOf } from "./answer.js";
import { createCardSync } from "./card-sync.js";

/** One row's second line: meals and time, then when it was last cooked. @param {L.Dish} d */
function metaOf(d) {
  const made = d.recipe ? `${d.meals.map((m) => mealLabels()[m] ?? cap(m)).join(", ")} · ${minutesText(d.minutes)}` : t("wheel.noRecipeBadge");
  const last = Number.isFinite(d.days) ? t("wheel.lastCookedShort", L.lastCookedDate(d.days)) : t("wheel.notCookedShort");
  return `${made} · ${last}`;
}

/** @param {import("./index.js").WheelCtx} ctx @param {HTMLElement} cardEl */
export function createListView(ctx, cardEl) {
  const data = /** @type {HTMLElement} */ (cardEl.querySelector(".kp-card__data"));
  data.innerHTML = '<ul class="wl-fits" data-wl="list"></ul>';
  const list = /** @type {HTMLElement} */ (data.querySelector('[data-wl="list"]'));
  const say = (/** @type {string} */ text) => {
    ctx.el.filtersLive.textContent = text;
  };
  const sync = createCardSync(ctx, cardEl, "list", say);

  const refresh = () => {
    const items = (ctx.status === "ready" ? onWheel(ctx, ctx.M) : []).map((d) => d.id);
    sync(items.length);
    list.replaceChildren(
      ...items.map((id) => {
        const d = /** @type {L.Dish} */ (byId(ctx, id));
        return h("li", { class: "wl-fit" }, h("span", { class: "wl-fit__text" }, h("b", null, d.label), h("span", null, metaOf(d))), h("span", { class: "wl-fit__tags" }, bigger(ctx, d) ? badgeOf(t("wheel.biggerSlice"), "warning") : null));
      }),
    );
  };
  return { refresh, say, cardEl };
}
