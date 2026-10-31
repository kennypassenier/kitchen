// The loading and failed states of every data component on the screen, set together.

import { setChecklistState, setFocusStepsState, setTimersState, setCardState } from "/static/kp/dist/kp-themes.min.js";
import { setTimelineState } from "../../recipe/timeline.js";
import { t } from "../../i18n/index.js";

/** @param {import("./index.js").CookCtx} ctx */
export function showLoading(ctx) {
  const { beginCard, mise, steps, timers, discCard, line } = ctx.el;
  setCardState(beginCard, "loading");
  setChecklistState(mise, "loading");
  setFocusStepsState(steps, "loading");
  setTimersState(timers, "loading");
  setCardState(discCard, "loading");
  setTimelineState(line.el, "loading");
}

/** @param {import("./index.js").CookCtx} ctx @param {string} message */
export function showError(ctx, message) {
  const { beginCard, mise, steps, timers, discCard, line } = ctx.el;
  setCardState(beginCard, "error", { title: t("cook.recipeFailed"), text: message });
  setChecklistState(mise, "error", message);
  setFocusStepsState(steps, "error", message);
  setTimersState(timers, "error");
  setCardState(discCard, "error", { title: t("cook.timersFailed"), text: message });
  setTimelineState(line.el, "error", t("cook.timelineFailed"), { text: message });
}
