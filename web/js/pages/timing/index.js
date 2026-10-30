// "When do I start?": backward timing. Say when dinner is and the screen counts back through the recipe's
// step times to the moment each track starts: the two-way sentence, the plan as lanes, the start as a disc
// and one gentle nudge. The approved design is research/audhd-recepten/timing (4 of 4 approved; the disc is
// a 60-minute dial). The clock is the real one; dinner time, pace and time to spare come from the settings
// and a change in the sentence saves them.

// Split on 30/10/2026 (docs/agent/MODULARITY.md): this file joins the parts; the page's state is one `ctx` object that
// every part reads (the recipe, the sentence's state, the snooze) and the parts call each other through `ctx.view`.
// plan.js is the pure maths (scripts/schedule.test.mjs covers the laying out), the others build and draw one section.

import { t } from "../../i18n/index.js";
import { DEFAULTS, SLOW, planFor, at } from "./plan.js";
import { buildFrame } from "./frame.js";
import { createSentence } from "./sentence.js";
import { createPlanView } from "./plan-view.js";
import { createTimer } from "./timer.js";
import { createNudge } from "./nudge.js";
import { createFiller } from "./fill.js";

/**
 * @typedef {object} TimingCtx
 * @property {HTMLElement} root
 * @property {string | null} recipeId
 * @property {(href: string) => void} navigate
 * @property {(() => void)[]} cleanups
 * @property {boolean} alive
 * @property {import("../../api.js").Item | null} recipe
 * @property {number | null} snoozedUntil
 * @property {{ eat: string, pace: string, spare: number, dropped: Set<string> }} state
 * @property {() => number} paceFactor
 * @property {() => import("./plan.js").Plan | null} current
 * @property {(ms: number) => void} moveDinner
 * @property {{ draw: () => void, drawSentence: () => void, drawTimerLine: () => void, drawNudge: () => void }} view
 */

/** @param {HTMLElement} root @param {string | null} recipeId @param {(href: string) => void} navigate @returns {TimingCtx} */
function makeCtx(root, recipeId, navigate) {
  const state = { eat: DEFAULTS.dinner_time, pace: DEFAULTS.pace, spare: DEFAULTS.spare, /** @type {Set<string>} */ dropped: new Set() };
  /** @type {TimingCtx} */
  const ctx = {
    root,
    recipeId,
    navigate,
    cleanups: [],
    alive: true,
    recipe: null,
    snoozedUntil: null,
    state,
    paceFactor: () => (state.pace === "slow" ? SLOW : 1),
    current: () => (ctx.recipe ? planFor(ctx.recipe, { serve: at(state.eat), spare: state.spare, pace: ctx.paceFactor(), dropped: state.dropped }) : null),
    moveDinner: () => {},
    view: { draw: () => {}, drawSentence: () => {}, drawTimerLine: () => {}, drawNudge: () => {} },
  };
  ctx.cleanups.push(() => {
    ctx.alive = false;
  });
  return ctx;
}

/** Build the parts and join them through `ctx.view`. @param {TimingCtx} ctx */
function buildParts(ctx) {
  const frame = buildFrame(ctx);
  const sentence = createSentence(ctx);
  ctx.moveDinner = sentence.moveDinner;
  const plan = createPlanView(ctx, frame.planCard);
  const timer = createTimer(ctx);
  const nudge = createNudge(ctx);
  ctx.view = {
    draw: () => {
      sentence.draw();
      plan.draw();
      timer.draw();
      nudge.draw();
    },
    drawSentence: sentence.draw,
    drawTimerLine: timer.drawLine,
    drawNudge: nudge.draw,
  };
  return { frame, sentence, plan, timer, nudge };
}

/** The clock is the real one: the late note, the nudge and the disc's drift are looked at every 15 seconds. @param {TimingCtx} ctx @param {ReturnType<typeof buildParts>} parts */
function startTick(ctx, { frame, sentence, timer, nudge }) {
  const tick = window.setInterval(() => {
    if (!ctx.recipe || ctx.current() === null || frame.planCard.getAttribute("data-kp-state") !== "ready") return;
    sentence.draw();
    timer.draw();
    nudge.draw();
  }, 15000);
  ctx.cleanups.push(() => clearInterval(tick));
  ctx.cleanups.push(() => {
    timer.detach();
    nudge.detach();
  });
}

/** @param {HTMLElement} root @param {{ params: URLSearchParams, navigate: (href: string) => void }} page */
export function mount(root, { params, navigate }) {
  document.title = `${t("timing.title")} · Kitchen`;
  const ctx = makeCtx(root, params.get("id"), navigate);
  const parts = buildParts(ctx);
  const filler = createFiller(ctx, { frame: parts.frame, sentence: parts.sentence, gantt: parts.plan.gantt });
  root.addEventListener("kp-card-retry", () => void filler.load(true));
  parts.plan.gantt?.addEventListener("kp-gantt-retry", () => void filler.load(true));
  void filler.load(false);
  startTick(ctx, parts);
  return () => {
    for (const off of ctx.cleanups) off();
  };
}
