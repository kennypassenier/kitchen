// The timeline (Kenny, 24/10/2026 05:16) is the timing page's gantt, set up by recipe/timeline.js: the tracks as rows, a bar
// per step, the package's line for now, the step the cook is on as its running bar and the steps passed as finished bars. It
// follows the real progress: what is still to do is planned from this moment (logic.js), so a step ended early or late shifts
// the rest. Its 10 s ticker is torn down with the page.

import { getStepIndex, getStepsPassed } from "/static/kp/js/focus-steps.js";
import { mountTimeline, drawTimeline, setTimelineState } from "../../recipe/timeline.js";
import { lanesOf as scheduleLanes } from "../../recipe/schedule.js";
import { t } from "../../i18n/index.js";
import { MIN, markSteps, firstOf, planRuns, laneCounts } from "./logic.js";

const TIMELINE_EVERY_MS = 10000;

/** The plan's sentences (planRuns itself knows no words). */
const planText = {
  how: (/** @type {number} */ mins, /** @type {boolean} */ active) => t("cook.how", mins, active),
  done: (/** @type {string} */ how) => t("cook.howDone", how),
  onIt: (/** @type {string} */ how) => t("cook.howOnIt", how),
  todo: (/** @type {string} */ how) => t("cook.howToDo", how),
  todoAt: (/** @type {string} */ how, /** @type {string} */ at, /** @type {number} */ waits) => t("cook.howToDoAt", how, at, waits),
};

/**
 * Where the cook is, as focus-steps tells it: the step in hand and the steps passed (`getStepsPassed`, kp-themes 11.3.0;
 * before it this read the remembered progress, kp-gaps wish "focus-steps: no getter for the steps passed").
 * @param {import("./index.js").CookCtx} ctx @returns {{ active: number, done: Set<number> }}
 */
function progressNow(ctx) {
  if (ctx.finished) return { active: -1, done: new Set(ctx.shown.map((_, i) => i)) };
  const active = Math.max(0, Math.min(ctx.shown.length - 1, getStepIndex(ctx.el.steps) || 0));
  return { active, done: new Set(getStepsPassed(ctx.el.steps).indexes) };
}

/** The recipe's rows (recipe/schedule.js: one per track that has a step here, else one for the whole recipe; a step with no track is in every row). @param {import("./index.js").CookCtx} ctx */
function lanesOf(ctx) {
  const { lanes: found, rowsOf } = scheduleLanes(ctx.shown, ctx.recipe?.tracks ?? []);
  const lanes = found.map((l) => ({ id: l.id, label: l.name ?? String(ctx.recipe?.name ?? ""), series: l.series }));
  return { lanes, rowsOf };
}

/** Draw the plan from this moment: passed steps where they really were, the one in hand growing, the rest counted on from now. @param {import("./index.js").CookCtx} ctx @param {{ el: HTMLElement }} line */
function paintTimeline(ctx, line) {
  if (!ctx.recipe) return;
  if (!ctx.shown.length) {
    setTimelineState(line.el, "empty", t("cook.noSteps"), { text: t("cook.noStepsText") });
    return;
  }
  const now = Date.now();
  const { active, done } = progressNow(ctx);
  const marks = (ctx.memo.marks ??= {});
  markSteps(marks, ctx.shown, active, done, now);
  ctx.keep();
  const { lanes, rowsOf } = lanesOf(ctx);
  const first = firstOf(marks, now);
  const { runs, last } = planRuns({ shown: ctx.shown, lanes, rowsOf, marks, active, done, now, first }, planText);
  drawTimeline(line.el, {
    lanes: lanes.map((l) => ({ ...l, sub: t("cook.nOfMDone", ...laneCounts(ctx.shown, rowsOf, l.id, done)) })),
    runs,
    from: first - MIN,
    to: last + 3 * MIN,
  });
}

/** Mount the timeline into its slot and keep it drawn. @param {import("./index.js").CookCtx} ctx */
export function createTimeline(ctx) {
  // `line` is read by `paint` only once a recipe is shown, which is after this call has returned.
  /** @type {{ el: HTMLElement, detach: () => void }} */
  let line = /** @type {any} */ (null);
  line = mountTimeline(ctx.el.timelineSlot, {
    label: t("cook.ganttLabel"),
    loading: t("cook.loadingSteps"),
    strings: { ganttOk: t("cook.ganttOk"), ganttRunning: t("cook.ganttNow"), ganttPlanned: t("cook.ganttPlanned") },
    redraw: () => paint(),
  });
  ctx.cleanups.push(line.detach);
  function paint() {
    paintTimeline(ctx, line);
  }
  // The place changes after the package has written it down: look a moment later.
  const followProgress = () => window.setTimeout(() => ctx.alive && (paint(), ctx.view.paintPhotos()), 0);
  const { steps } = ctx.el;
  for (const type of ["kp-focus-steps-change", "kp-focus-steps-track", "kp-focus-steps-resume"]) steps.addEventListener(type, followProgress);
  steps.addEventListener("kp-focus-steps-done", () => {
    ctx.finished = true;
    followProgress();
  });
  // The plan counts on from the real now, so it is looked at again while a step runs over its time.
  const tick = window.setInterval(paint, TIMELINE_EVERY_MS);
  ctx.cleanups.push(() => clearInterval(tick));
  return { line, paint };
}
