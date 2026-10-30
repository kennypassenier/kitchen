// The wheel card: the one wheel component (web/eten/dishwheel.js, Kenny, 24/10/2026 10:27: the same wheel everywhere; this
// page gives it the dishes and fills its answer column). The view keeps what the wheel did (the chosen dish, whether it is
// turning) and gives the dishes to the component again only when the list or the slice sizes changed.

import { mountDishWheel } from "/eten/dishwheel.js";
import { attachDisabledReasons } from "/static/kp/js/reason.js";
import { sideName } from "../../records/index.js";
import { t } from "../../i18n/index.js";
import { answerHtml } from "./answer-html.js";
import { paintAnswer } from "./answer.js";
import { createCardSync } from "./card-sync.js";
import { byId, onWheel, weight } from "./model.js";
import { setAside, bringBack } from "./actions.js";

/** The dish's sides by name, each one entry of the small wheel (records/lists.js sideName). @param {import("./logic.js").Dish} d */
const sidesOf = (d) => d.sides.map((s) => sideName(s)).filter(Boolean);

/**
 * What the wheels did (the one component's events). The small wheel waits for the big one to stop on a dish with two or
 * more sides; the component does that, this says it in the answer column.
 * @param {import("./index.js").WheelCtx} ctx @param {import("./answer.js").AnswerState} vs @param {() => void} repaint @param {(text: string) => void} say
 * @param {import("/eten/dishwheel.js").DishChange} change
 */
function onWheelChange(ctx, vs, repaint, say, change) {
  const { part } = vs;
  if (change.phase === "turning") {
    vs.spinning = true;
    vs.chosen = null;
    part.sideline.textContent = "";
    repaint();
  } else if (change.phase === "dish" || change.phase === "side-turning" || change.phase === "side") {
    if (change.phase === "dish") {
      vs.spinning = false;
      vs.chosen = change.dish?.id ?? null;
      repaint();
      say(t("wheel.wheelChose", byId(ctx, /** @type {string} */ (vs.chosen))?.label));
    }
    part.sideline.textContent = change.side ? t("wheel.withSide", change.side) : change.sides.length > 1 ? t("wheel.sideTurning") : "";
  }
}

/** Mount the one wheel component into the card and fill its answer column. @param {import("./index.js").WheelCtx} ctx @param {HTMLElement} cardEl @param {import("./answer.js").AnswerState} vs @param {(change: import("/eten/dishwheel.js").DishChange) => void} onChange */
function mountWheel(ctx, cardEl, vs, onChange) {
  const data = /** @type {HTMLElement} */ (cardEl.querySelector(".kp-card__data"));
  data.innerHTML = '\n        <div class="wl-screen" data-wl="screen"></div>';
  const screen = /** @type {HTMLElement} */ (data.querySelector('[data-wl="screen"]'));
  const wheels = mountDishWheel(screen, {
    words: { dishKicker: t("wheel.tonightsWheel"), sideKicker: t("wheel.sideKicker"), sideFirst: t("wheel.sideFirst"), nothing: () => "", oneSide: (_d, side) => t("wheel.withSide", side) },
    onChange,
  });
  /** @type {HTMLElement} */ (wheels.answer).innerHTML = answerHtml();
  for (const el of data.querySelectorAll("[data-wl]")) vs.part[/** @type {HTMLElement} */ (el).dataset.wl ?? ""] = /** @type {HTMLElement} */ (el);
  ctx.cleanups.push(() => wheels.destroy(), attachDisabledReasons(cardEl));
  return wheels;
}

/** @param {import("./index.js").WheelCtx} ctx @param {HTMLElement} cardEl */
export function createWheelView(ctx, cardEl) {
  /** @type {import("./answer.js").AnswerState} */
  const vs = { chosen: null, spinning: false, items: [], part: {} };
  let shownKey = "";
  const say = (/** @type {string} */ text) => {
    vs.part.live.textContent = text;
  };
  const sync = createCardSync(ctx, cardEl, "wheel", say);
  const repaint = () => paintAnswer(ctx, vs, (item, name) => void bringBack(ctx, item, name, repaint, say));
  const wheels = mountWheel(ctx, cardEl, vs, (change) => onWheelChange(ctx, vs, repaint, say, change));

  vs.part.yes.addEventListener("click", () => {
    // The dish's recipe opens in cook mode; a dish without a recipe opens its own page, where the recipe is added.
    const d = vs.chosen ? byId(ctx, vs.chosen) : null;
    if (d) ctx.navigate(d.cookId ? `/cook?id=${encodeURIComponent(d.cookId)}&fresh=1` : `/dishes/${encodeURIComponent(d.id)}`);
  });
  vs.part.again.addEventListener("click", () => void wheels.spin());
  vs.part.skip.addEventListener("click", () => void setAside(ctx, vs.chosen, repaint, say));

  const refresh = () => {
    const list = ctx.status === "ready" ? onWheel(ctx, ctx.M) : [];
    vs.items = list.map((d) => d.id);
    sync(vs.items.length);
    if (ctx.status === "ready") {
      const next = list.map((d) => ({ id: d.id, label: d.short, weight: weight(ctx, d), sides: sidesOf(d) }));
      const key = JSON.stringify(next);
      if (key !== shownKey) {
        shownKey = key;
        vs.chosen = null;
        wheels.setDishes(next);
      }
    }
    repaint();
  };
  return { refresh, say, cardEl };
}
