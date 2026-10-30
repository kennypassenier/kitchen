// Fill the screen with the recipe once it has loaded: the header, the Begin card's facts, the checklist, the steps and their
// photos, the timers restored from the memory and the plan. The state of each component is set to ready as it is given.

import { h } from "../../dom.js";
import { setChecklistItems, setChecklistState } from "/static/kp/js/checklist.js";
import { setFocusSteps, setFocusStepsState, getStepIndex } from "/static/kp/js/focus-steps.js";
import { setTimersState, getTimers, restoreTimers } from "/static/kp/js/timer.js";
import { setCardState } from "/static/kp/js/card-state.js";
import { showPhotos } from "../../recipe/photos.js";
import { t, lang } from "../../i18n/index.js";
import { localStep } from "../../recipe/bilingual.js";
import { link } from "../../ui/cards.js";
import { stepsOf, focusStepsOf } from "./logic.js";
import { miseItems } from "./mise.js";

/** The photos of the step the cook is on. @param {import("./index.js").CookCtx} ctx */
export function paintPhotos(ctx) {
  const { steps, stepPhotos } = ctx.el;
  const step = ctx.shown[getStepIndex(steps)];
  const ids = /** @type {string[]} */ (step?.photos ?? []);
  stepPhotos.hidden = ids.length === 0;
  if (ids.length === 0) return;
  const key = ids.join(",");
  if (stepPhotos.dataset.key === key) return;
  stepPhotos.dataset.key = key;
  const gallery = stepPhotos.firstElementChild;
  if (gallery instanceof HTMLElement) showPhotos(gallery, ids, t("edit.stepPhoto"));
  else stepPhotos.append(showPhotos(null, ids, t("edit.stepPhoto")));
}

/** The title, the sentence and the two links of the header. @param {import("./index.js").CookCtx} ctx @param {Record<string, any>} r */
function fillHeader(ctx, r) {
  const { title, lead, actions } = ctx.el;
  document.title = `${t("cook.cookName", r.name)} · Kitchen`;
  title.textContent = t("cook.cookColon", r.name);
  lead.textContent = ctx.mini ? t("cook.leadMini") : t("cook.lead");
  const base = `/cook?id=${encodeURIComponent(r.id)}`;
  actions.replaceChildren(
    link(`/recipe?id=${encodeURIComponent(r.id)}`, t("cook.backToRecipe")),
    ctx.mini ? link(base, t("cook.fullVersion")) : link(`${base}&mini=1`, t("cook.miniVersion")),
  );
}

/** The Begin card: the recipe's name and facts. @param {import("./index.js").CookCtx} ctx @param {Record<string, any>} r */
function fillBegin(ctx, r) {
  const fact = (/** @type {string} */ k, /** @type {string} */ v) => h("div", { class: "kp-kv__row" }, h("dt", null, k), h("dd", null, v));
  ctx.el.beginTitle.textContent = r.name;
  ctx.el.facts.replaceChildren(
    fact(t("cook.serves"), t("cook.portionCount", r.portions)),
    fact(t("cook.time"), t("cook.timeText", r.minutes, r.hands_on)),
    ...(r.gear ? [fact(t("cook.dirties"), r.gear)] : []),
    ...(ctx.mini ? [fact(t("bad.miniVersion"), r.mini_note || t("cook.onlyMatter"))] : []),
  );
  setCardState(ctx.el.beginCard, "ready");
}

/** The timers the memory kept come back, each with its disc. @param {import("./index.js").CookCtx} ctx */
function restoreTimersOf(ctx) {
  const { timers } = ctx.el;
  setTimersState(timers, "ready");
  if (Array.isArray(ctx.memo.timers) && ctx.memo.timers.length && !getTimers(timers).length) {
    restoreTimers(timers, ctx.memo.timers);
    for (const tm of getTimers(timers)) ctx.view.addDisc(tm);
  }
}

/** @param {import("./index.js").CookCtx} ctx @param {Record<string, any>} r */
export function fill(ctx, r) {
  const { mise, steps, stepPhotos } = ctx.el;
  ctx.recipe = r;
  // A step may carry its text and note in both languages (Kenny, 30/10/2026): cook mode reads them in the one shown.
  ctx.shown = stepsOf(r, ctx.mini).map((s) => localStep(s, lang()));
  fillHeader(ctx, r);
  fillBegin(ctx, r);
  setChecklistState(mise, "ready");
  setChecklistItems(mise, miseItems(r));
  ctx.view.paintStart();

  setFocusStepsState(steps, "ready");
  setFocusSteps(steps, focusStepsOf(r, ctx.shown));
  steps.setAttribute("aria-label", r.name);
  delete stepPhotos.dataset.key;
  paintPhotos(ctx);

  restoreTimersOf(ctx);
  ctx.view.paintDiscCard();
  ctx.view.refreshBand();
  ctx.finished = false;
  ctx.view.paintTimeline();
}
