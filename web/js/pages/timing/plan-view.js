// The plan as lanes on the package's timeline (recipe/timeline.js, shared with cook mode).

import { h, $ } from "../../dom.js";
import { setCardState } from "/static/kp/js/card-state.js";
import { mountTimeline, drawTimeline } from "../../recipe/timeline.js";
import { t } from "../../i18n/index.js";
import { cap } from "../../format.js";
import { MIN, hm } from "./plan.js";
import { words } from "./text.js";

/** @typedef {import("../../api.js").Item} Item */

/** @param {import("./index.js").TimingCtx} ctx @param {HTMLElement} planCard */
export function createPlanView(ctx, planCard) {
  const { root, recipeId, cleanups, state, current } = ctx;
  // ---- the plan's frame -----------------------------------------------------------------------------------------
  /** @type {HTMLElement | null} */
  let gantt = null;
  const planReadout = h("p", { class: "tm-readout", id: "tm-plan-readout", role: "status" }, t("timing.pressBar"));
  if (recipeId) {
    const data = /** @type {HTMLElement} */ ($("#tm-plan-card-data", root));
    const slot = h("div", { id: "tm-gantt-slot" });
    data.append(slot, planReadout);
    // The timeline setup is the one shared with cook mode (recipe/timeline.js).
    const line = mountTimeline(slot, { label: t("timing.ganttLabel"), loading: t("timing.loadingPlan"), redraw: () => ctx.recipe && drawPlan() });
    gantt = line.el;
    cleanups.push(line.detach);
    // A data area loads under the busy card, with the lane names and the axis beside it.
    setCardState(planCard, "ready");
    gantt.addEventListener("kp-gantt-open", (event) => {
      const { run, point } = /** @type {CustomEvent} */ (event).detail;
      if (run) planReadout.textContent = t("timing.runRead", cap(run.detail), hm(new Date(run.start).getTime()), hm(new Date(run.end).getTime()));
      else if (point) planReadout.textContent = t("timing.pointRead", point.label, hm(new Date(point.at).getTime()));
    });
  }

  function drawPlan() {
    const p = current();
    if (!p || !gantt || !ctx.recipe) return;
    drawTimeline(gantt, {
      lanes: p.lanes.map((l) => ({ id: l.id, label: l.label, sub: t("timing.startAt", hm(l.start)), series: l.series })),
      runs: p.lanes.flatMap((l) =>
        l.steps.map((s) => ({
          id: s.id,
          lane: l.id,
          label: s.label,
          start: s.start,
          end: s.end,
          state: /** @type {const} */ ("planned"),
          series: l.series,
          detail: t("timing.stepDetail", s.say, s.mins, s.active),
        })),
      ),
      points: p.lanes.map((l) => ({ id: `${l.id}-start`, lane: l.id, at: l.start, kind: "start", label: t("timing.startColon", l.steps[0].say), planned: true })),
      kinds: [{ kind: "start", label: t("timing.whereStarts"), shape: "diamond", tone: "info" }],
      // The window holds the plan, not the whole day up to the real now: ten minutes before the first start to a quarter hour after dinner.
      from: p.start - 10 * MIN,
      to: p.serve + 15 * MIN,
      zones: [{ id: "eat", from: p.serve, to: p.serve + 12 * MIN, label: t("timing.weEatAt", hm(p.serve)), tone: "info" }],
    });
    const dropped = state.dropped.size > 0 ? ` ${t("timing.leftOutShort", [...state.dropped].map((id) => /** @type {Item[]} */ (ctx.recipe?.tracks ?? []).find((tr) => tr.id === id)?.name ?? id).join(", "))}` : "";
    /** @type {HTMLElement} */ ($("#tm-plan-card-body", root)).textContent =
      `${t("timing.countedBack", hm(p.serve), words(Math.round(p.total / MIN)))} ${p.lanes.map((l) => t("timing.sayAt", l.label, hm(l.start))).join(", ")}.${dropped}`;
  }
  return { gantt, draw: drawPlan };
}
