// The plan as lanes on the package's timeline (recipe/timeline.js, shared with cook mode).

import { h, $ } from "../../dom.js";
import { setCardState } from "/static/kp/dist/kp-themes.min.js";
import { mountTimeline, drawTimeline } from "../../recipe/timeline.js";
import { t } from "../../i18n/index.js";
import { cap } from "../../format.js";
import { MIN, hm } from "./plan.js";
import { words } from "./text.js";

/** @typedef {import("../../api.js").Item} Item */

/** What the timeline draws for a plan: a lane per track, a bar per step, a diamond where each track starts, the dinner zone. @param {import("./plan.js").Plan} p */
function timelineData(p) {
  return {
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
  };
}

/** The card's sentence: dinner, the total and where each track starts, and the tracks left out. @param {import("./index.js").TimingCtx} ctx @param {import("./plan.js").Plan} p */
function planSentence(ctx, p) {
  const tracks = /** @type {Item[]} */ (ctx.recipe?.tracks ?? []);
  const dropped = ctx.state.dropped.size > 0 ? ` ${t("timing.leftOutShort", [...ctx.state.dropped].map((id) => tracks.find((tr) => tr.id === id)?.name ?? id).join(", "))}` : "";
  return `${t("timing.countedBack", hm(p.serve), words(Math.round(p.total / MIN)))} ${p.lanes.map((l) => t("timing.sayAt", l.label, hm(l.start))).join(", ")}.${dropped}`;
}

/** The timeline and its readout, in the plan card. @param {import("./index.js").TimingCtx} ctx @param {HTMLElement} planCard @param {HTMLElement} planReadout */
function mountPlan(ctx, planCard, planReadout) {
  const data = /** @type {HTMLElement} */ ($("#tm-plan-card-data", ctx.root));
  const slot = h("div", { id: "tm-gantt-slot" });
  data.append(slot, planReadout);
  // The timeline setup is the one shared with cook mode (recipe/timeline.js).
  const line = mountTimeline(slot, { label: t("timing.ganttLabel"), loading: t("timing.loadingPlan"), redraw: () => ctx.recipe && drawPlan(ctx, line.el) });
  ctx.cleanups.push(line.detach);
  // A data area loads under the busy card, with the lane names and the axis beside it.
  setCardState(planCard, "ready");
  line.el.addEventListener("kp-gantt-open", (event) => {
    const { run, point } = /** @type {CustomEvent} */ (event).detail;
    if (run) planReadout.textContent = t("timing.runRead", cap(run.detail), hm(new Date(run.start).getTime()), hm(new Date(run.end).getTime()));
    else if (point) planReadout.textContent = t("timing.pointRead", point.label, hm(new Date(point.at).getTime()));
  });
  return line.el;
}

/** @param {import("./index.js").TimingCtx} ctx @param {HTMLElement | null} gantt */
function drawPlan(ctx, gantt) {
  const p = ctx.current();
  if (!p || !gantt || !ctx.recipe) return;
  drawTimeline(gantt, timelineData(p));
  /** @type {HTMLElement} */ ($("#tm-plan-card-body", ctx.root)).textContent = planSentence(ctx, p);
}

/** @param {import("./index.js").TimingCtx} ctx @param {HTMLElement} planCard */
export function createPlanView(ctx, planCard) {
  const planReadout = h("p", { class: "tm-readout", id: "tm-plan-readout", role: "status" }, t("timing.pressBar"));
  /** @type {HTMLElement | null} */
  const gantt = ctx.recipeId ? mountPlan(ctx, planCard, planReadout) : null;
  return { gantt, draw: () => drawPlan(ctx, gantt) };
}
