// "No energy today": the switch, the kinds it counts as easy and the line that says what is on the wheel now. Calm mode comes
// on with the switch, is not remembered, and goes off again only if the switch turned it on.

import { setCalm, isCalm } from "/static/kp/dist/js/calm.js";
import { setSegmentedCounts, setSegmentedValues, SEGMENTED_EVENT } from "/static/kp/dist/js/segmented.js";
import { t } from "../../i18n/index.js";
import { track, onWheel } from "./model.js";
import { isKind, KINDS } from "./logic.js";

/** @param {import("./index.js").WheelCtx} ctx */
export function paintEasy(ctx) {
  const { el, M, status } = ctx;
  const ready = status === "ready";
  el.switchEl.disabled = !ready;
  el.switchEl.checked = M.easy;
  if (ready) setSegmentedCounts(el.kindsEl, Object.fromEntries(KINDS.map((k) => [k, ctx.dishes.filter((d) => isKind(d, k)).length])));
  setSegmentedValues(el.kindsEl, M.kinds);
  // The group, not each chip, is off until the switch is on: a wrapper per chip would take them out of the group.
  // The line "Right now" (aria-describedby) says why.
  el.kindsEl.setAttribute("aria-disabled", String(!ready || !M.easy));
  const n = onWheel(ctx, M).length;
  el.easyLive.textContent = status === "loading" ? t("wheel.loadingDot") : status === "error" ? t("wheel.failedDot") : M.easy ? t("wheel.easyOn", n) : t("wheel.easyOff");
}

/** Put calm mode back as it was, if the switch is the one that turned it on. @param {import("./index.js").WheelCtx} ctx */
export function releaseCalm(ctx) {
  if (ctx.calmByUs) setCalm(false, { remember: false, announce: false });
}

/** @param {import("./index.js").WheelCtx} ctx */
export function wireEasy(ctx) {
  const { switchEl, kindsEl } = ctx.el;
  const onSwitch = () => {
    ctx.M.easy = switchEl.checked;
    if (ctx.M.easy && !isCalm()) {
      setCalm(true, { remember: false, announce: false });
      ctx.calmByUs = true;
    } else if (!ctx.M.easy && ctx.calmByUs) {
      setCalm(false, { remember: false, announce: false });
      ctx.calmByUs = false;
    }
    ctx.view.paintAll();
  };
  const onKinds = (/** @type {Event} */ event) => {
    ctx.M.kinds = new Set(/** @type {CustomEvent} */ (event).detail.values);
    for (const k of KINDS) track(ctx, `kind:${k}`, !ctx.M.kinds.has(k));
    ctx.view.paintAll();
  };
  switchEl.addEventListener("change", onSwitch);
  kindsEl.addEventListener(SEGMENTED_EVENT, onKinds);
  ctx.cleanups.push(() => switchEl.removeEventListener("change", onSwitch), () => kindsEl.removeEventListener(SEGMENTED_EVENT, onKinds));
}
