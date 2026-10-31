// Cook mode: /cook?id=<recipe id>[&mini=1].
//
// One screen in the approved order: the Begin card, which opens the mise-en-place checklist; cook mode (one step at a time,
// the recipe's parallel tracks as lanes, the running timers beside it, an attention band when one ends); the timeline; the
// timer discs; the calm switch; and, when the last step is done, the offer to log tonight's dinner. Everything is the
// package's own component with its standard behaviour; this file gives them the recipe.
//
// The place in the recipe (active step, every track, the steps done) is kept by focus-steps itself (data-kp-remember). The
// page keeps only what the package does not cover (memo.js): the running timers, whether Begin was pressed and when each
// step really started and ended.
//
// Split on 30/10/2026 (docs/agent/MODULARITY.md): this file joins the parts. The page's state is one `ctx` object that every
// part reads (the recipe, the steps shown, the elements, the memory); the parts call each other through `ctx.view`, and the
// live things (the package's attachments, the 10 s ticker, the discs, listeners on the document) are all taken down by the
// functions in `ctx.cleanups`. logic.js is the pure part (scripts/cook.test.mjs).

import { attachChecklists, setChecklistState, attachFocusSteps, setFocusStepsState, attachTimers, setTimersState, attachAttention, attachCardStates, attachCalm, memoryFor } from "/static/kp/dist/kp-themes.min.js";
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
 * @property {{ paintTimeline: () => void, paintPhotos: () => void, refreshBand: () => void, paintStart: () => void, addDisc: (tm: any) => void, paintDiscCard: () => void }} view
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
    view: { paintTimeline: () => {}, paintPhotos: () => {}, refreshBand: () => {}, paintStart: () => {}, addDisc: () => {}, paintDiscCard: () => {} },
  };
  return { ctx, fresh };
}

/** Build every section's markup, loading from the first frame, and put it on the page. @param {CookCtx} ctx */
function buildScreen(ctx) {
  const head = buildHeader();
  const stage = buildStage(ctx);
  Object.assign(ctx.el, head, stage, buildBegin(), buildCalm(), buildDone());
  const e = ctx.el;
  ctx.root.replaceChildren(e.header, e.beginSection, e.cook, e.timelineSection, e.discSection, e.calmSection, e.doneSection);
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
  startLoading(ctx);

  return () => {
    ctx.alive = false;
    ctx.seq++;
    for (const stop of ctx.cleanups.splice(0)) stop();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  };
}
