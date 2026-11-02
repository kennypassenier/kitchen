// Cook mode: /cook?id=<recipe id>[&mini=1].
//
// A full-viewport stage (Kenny, 01/11/2026 20:21, "Volledig scherm"): the step in hand large, Back and Next pinned at the
// bottom, the running timers pinned at the top, an attention band when one ends, and, when the last step is done, the offer
// to log tonight's dinner. Everything else (Begin with the mise en place, the explanations, the timeline, the timer discs,
// the calm switch, the links) is in one More sheet (more.js). stage-state.js decides what the stage shows per state.
// Everything is the package's own component with its standard behaviour; this file gives them the recipe.
//
// The place in the recipe (active step, every track, the steps done) is kept by focus-steps itself (data-kp-remember). The
// page keeps only what the package does not cover (memo.js): the running timers, whether Begin was pressed, when each step
// really started and ended, and whether the last step was done (the package forgets the place then).
//
// Split on 30/10/2026 (docs/agent/MODULARITY.md): this file joins the parts. The page's state is one `ctx` object that every
// part reads (the recipe, the steps shown, the elements, the memory); the parts call each other through `ctx.view`, and the
// live things (the package's attachments, the 10 s ticker, the discs, listeners on the document) are all taken down by the
// functions in `ctx.cleanups`. logic.js is the pure part (scripts/cook.test.mjs).

import { attachChecklists, setChecklistState } from "/static/kp/dist/js/checklist.js";
import { attachFocusSteps, setFocusStepsState } from "/static/kp/dist/js/focus-steps.js";
import { attachTimers, setTimersState } from "/static/kp/dist/js/timer.js";
import { attachAttention } from "/static/kp/dist/js/attention.js";
import { attachCardStates } from "/static/kp/dist/js/card-state.js";
import { attachCalm } from "/static/kp/dist/js/calm.js";
import { memoryFor } from "/static/kp/dist/js/remember.js";
import { h } from "../../dom.js";
import { t } from "../../i18n/index.js";
import { buildHeader, plateScreen } from "./parts.js";
import { openMemo, storeKeyOf } from "./memo.js";
import { buildStage } from "./stage.js";
import { buildBegin, wireBegin } from "./begin.js";
import { buildCalm, wireCalm } from "./calm.js";
import { buildDone, wireDone } from "./done.js";
import { createTimers } from "./timers.js";
import { createTimeline } from "./timeline.js";
import { paintPhotos } from "./fill.js";
import { buildMore, wireMore } from "./more.js";
import { wireStage } from "./stage-view.js";
import { startLoading } from "./load.js";

/**
 * @typedef {object} CookCtx
 * @property {HTMLElement} root
 * @property {string} recipeId
 * @property {boolean} mini
 * @property {string} storeKey
 * @property {(href: string) => void} navigate
 * @property {(() => void)[]} cleanups
 * @property {boolean} alive false once the page is left
 * @property {number} seq the newest load; an older answer is dropped
 * @property {import("./memo.js").Memo} memo
 * @property {() => void} keep
 * @property {Record<string, any> | null} recipe
 * @property {Record<string, any>[]} shown the steps the cook sees
 * @property {boolean} finished the last step is done
 * @property {boolean} logging a dinner is being logged
 * @property {Record<string, any>} el the elements of every section
 * @property {{ paintTimeline: () => void, paintPhotos: () => void, refreshBand: () => void, paintStart: () => void, addDisc: (tm: any) => void, paintDiscCard: () => void, paintStage: () => void }} view
 */

/** "Yes, cook this" and every "Cook it" arrive with `fresh=1` (Kenny, 29/10/2026): cooking starts at step 1 with no old
 * timers or marks. The mark is taken off the address at once, so a reload of this page keeps the progress made since. @param {boolean} fresh */
function dropFreshMark(fresh) {
  if (!fresh) return;
  const clean = new URL(location.href);
  clean.searchParams.delete("fresh");
  history.replaceState(history.state, "", `${clean.pathname}${clean.search}${clean.hash}`);
}

/** @param {HTMLElement} root @param {{ params: URLSearchParams, navigate: (href: string) => void }} page */
function newCtx(root, { params, navigate }) {
  const recipeId = params.get("id") ?? "";
  const mini = params.get("mini") === "1";
  const fresh = params.get("fresh") === "1";
  dropFreshMark(fresh);
  const storeKey = storeKeyOf(recipeId, mini);
  const { memo, keep } = openMemo(storeKey, fresh);
  /** @type {CookCtx} */
  const ctx = {
    root, recipeId, mini, storeKey, navigate, cleanups: [], alive: true, seq: 0, memo, keep, recipe: null, shown: [], finished: false, logging: false, el: {},
    view: { paintTimeline: () => {}, paintPhotos: () => {}, refreshBand: () => {}, paintStart: () => {}, addDisc: () => {}, paintDiscCard: () => {}, paintStage: () => {} },
  };
  return { ctx, fresh };
}

/** Build the stage and the More sheet, loading from the first frame, and put them on the page. @param {CookCtx} ctx */
function buildScreen(ctx) {
  const stage = buildStage(ctx);
  const head = buildHeader(stage.wakeBadge);
  const begin = buildBegin();
  const calm = buildCalm();
  const done = buildDone();
  const more = buildMore([begin.beginSection, stage.timelineSection, stage.discSection, calm.calmSection]);
  head.actions.append(more.gatherBtn, more.moreBtn);
  const screen = h("div", { class: "ck-screen" }, head.header, stage.pinned, stage.cook, done.doneSection);
  Object.assign(ctx.el, head, stage, begin, calm, done, more, { screen });
  ctx.root.replaceChildren(screen, more.sheet);
}

/** Give the package its components and take them off again with the page. @param {CookCtx} ctx @param {boolean} fresh */
function attachPackage(ctx, fresh) {
  const { steps } = ctx.el;
  // The place the package remembered is forgotten before the steps are given, so they open on step 1.
  if (fresh) memoryFor(steps, "focus-steps")?.forget("progress");
  ctx.cleanups.push(attachCardStates(ctx.root), attachChecklists(ctx.root), attachFocusSteps(ctx.root), attachTimers(ctx.root), attachAttention(ctx.root), attachCalm(ctx.root));
}

/** @param {HTMLElement} root @param {{ params: URLSearchParams, navigate: (href: string) => void }} page */
export function mount(root, page) {
  const { ctx, fresh } = newCtx(root, page);
  document.title = `${t("cook.title")} · Kitchen`;
  if (!ctx.recipeId) {
    plateScreen(ctx, t("cook.notHere"), t("cook.noId"), t("shell.openWheel"), "/");
    return () => {};
  }
  buildScreen(ctx);
  attachPackage(ctx, fresh);
  const timeline = createTimeline(ctx);
  ctx.el.line = timeline.line;
  ctx.view.paintTimeline = timeline.paint;
  ctx.view.paintPhotos = () => paintPhotos(ctx);
  setChecklistState(ctx.el.mise, "loading");
  setFocusStepsState(ctx.el.steps, "loading");
  setTimersState(ctx.el.timers, "loading");
  wireCalm(ctx)();
  wireBegin(ctx);
  Object.assign(ctx.view, createTimers(ctx));
  wireDone(ctx);
  wireMore(ctx);
  wireStage(ctx);
  startLoading(ctx);

  return () => {
    ctx.alive = false;
    ctx.seq++;
    for (const stop of ctx.cleanups.splice(0)) stop();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  };
}
