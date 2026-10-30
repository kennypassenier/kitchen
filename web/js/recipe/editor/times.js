// The time, portions and preparation section. The two times are computed from the steps and shown live.

import { getQuantity, setQuantity } from "/static/kp/js/quantity.js";
import { h } from "../../dom.js";
import { t } from "../../i18n/index.js";
import { row, input, stepper, toggle, on, segmented } from "../../ui/form-parts.js";
import { effective } from "../schedule.js";
import { timeOverride, timesOf } from "./logic.js";
import { prepItems } from "./consts.js";

/** A time row: the stepper, the Override switch under it, and a live sentence in the value track. @param {string} label @param {HTMLElement} q @param {HTMLElement} over @param {HTMLElement} hint */
function timeRow(label, q, over, hint) {
  const el = row(label, h("div", { class: "rl-time" }, q, over), "");
  el.append(hint);
  return el;
}

/** The two times are computed from the steps (Kenny, 29/10/2026; recipe/schedule.js) and shown live: the figure is the stepper itself, unreachable until the Override switch lets a typed value win. @param {Record<string, any>} r */
function buildTimes(r) {
  const was = effective(r);
  return {
    minutes: stepper(was.minutes, { max: 1440, unit: "min", label: t("edit.totalMinutes") }),
    hands: stepper(was.hands_on, { max: 1440, unit: "min", label: t("edit.handsMinutes") }),
    minutesOver: toggle(t("edit.overrideSwitch"), timeOverride(r.minutes_override, was.total, Number(r.minutes) || 0)),
    handsOver: toggle(t("edit.overrideSwitch"), timeOverride(r.hands_on_override, was.handsOn, Number(r.hands_on) || 0)),
    minutesHint: h("p", { class: "kp-formgrid__value", role: "status" }),
    handsHint: h("p", { class: "kp-formgrid__value", role: "status" }),
  };
}

/** @param {Record<string, any>} r the recipe as it was */
function buildOthers(r) {
  return {
    portions: stepper(r.portions ?? 2, { min: 1, max: 24, unit: t("bad.unitMany"), one: t("bad.unitOne"), label: t("bad.colPortions") }),
    prep: segmented(prepItems(), [r.prep ?? "light"], "single", t("edit.preparing")),
    safe: toggle(t("edit.safeSwitch"), Boolean(r.safe)),
    gear: input(r.gear ?? "", "text", { placeholder: t("edit.gearPh") }),
  };
}

/**
 * @param {Record<string, any>} r the recipe as it was
 * @param {{ steps: () => Record<string, any>[], trackList: () => Record<string, any>[] }} live the live steps (with text) and the track rows
 */
export function timeFields(r, live) {
  const tm = buildTimes(r);
  const { minutes, hands, minutesOver, handsOver, minutesHint, handsHint } = tm;
  const { portions, prep, safe, gear } = buildOthers(r);
  const facts = h(
    "div",
    { class: "kp-formgrid" },
    timeRow(t("edit.totalTime"), minutes, minutesOver, minutesHint),
    timeRow(t("edit.handsTime"), hands, handsOver, handsHint),
    row(t("bad.colPortions"), portions, t("edit.portionsHint")),
    row(t("edit.preparing"), prep, t("edit.prepHint")),
    row(t("edit.safeFav"), safe, t("edit.safeHint")),
    row(t("edit.gear"), gear, t("edit.gearHint")),
  );
  /** The two times from the steps as they stand, and what is stored: a typed override wins. */
  const timesNow = () => {
    const typed = (/** @type {HTMLElement} */ sw, /** @type {HTMLElement} */ q) => (on(sw) ? getQuantity(q) : null);
    return timesOf(r, live.steps(), live.trackList(), { minutes: typed(minutesOver, minutes), hands: typed(handsOver, hands) });
  };
  const refreshTimes = () => {
    const now = timesNow();
    for (const [sw, q, computed] of /** @type {[HTMLElement, HTMLElement, number][]} */ ([[minutesOver, minutes, now.minutes], [handsOver, hands, now.hands_on]])) {
      if (on(sw)) q.removeAttribute("data-kp-quantity-disabled");
      else q.setAttribute("data-kp-quantity-disabled", "");
      setQuantity(q, on(sw) ? getQuantity(q) : computed);
    }
    minutesHint.textContent = on(minutesOver) ? t("edit.totalTyped", now.total) : t("edit.totalComputed", now.total);
    handsHint.textContent = on(handsOver) ? t("edit.handsTyped", now.handsOn) : t("edit.handsComputed", now.handsOn);
  };
  return { el: facts, portions, prep, safe, gear, timesNow, refreshTimes };
}
