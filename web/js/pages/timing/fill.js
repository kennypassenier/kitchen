// The states of the page: loading, failed, empty plates, and the filled page once the kitchen has arrived.

import { h, $ } from "../../dom.js";
import { loadKitchen, recipeById } from "../../api.js";
import { setCardState } from "/static/kp/js/card-state.js";
import { combobox, drawnSelect } from "/static/kp/js/combobox.js";
import { setTime } from "/static/kp/js/timefield.js";
import { setTimelineState } from "../../recipe/timeline.js";
import { t } from "../../i18n/index.js";
import { DEFAULTS, SPARES, hasTimes, timedSteps } from "./plan.js";
import { words } from "./text.js";

/** @typedef {import("../../api.js").Item} Item */

/**
 * @typedef {object} FillDeps What the filler reads: the page's ctx and the built parts.
 * @property {import("./index.js").TimingCtx} ctx
 * @property {ReturnType<typeof import("./frame.js").buildFrame>} frame
 * @property {ReturnType<typeof import("./sentence.js").createSentence>} sentence
 * @property {HTMLElement | null} gantt
 */

/** The recipes that can be counted back, A to Z. @param {import("../../api.js").Kitchen} k */
const countable = (k) => k.recipes.filter(hasTimes).sort((a, b) => String(a.name).localeCompare(String(b.name)));

/** The plate of a recipe that cannot be counted back, with the one action that helps. @param {string} title @param {string} text @param {HTMLElement} action */
const plate = (title, text, action) => ({ title, text, action });

/** @param {FillDeps} d */
const focusPicker = (d) => /** @type {HTMLInputElement | null} */ ($("#tm-recipe", d.ctx.root))?.focus();

/** @param {FillDeps} d @param {unknown} e */
function failed({ frame, gantt }, e) {
  const text = e instanceof Error ? e.message : t("timing.noAnswer");
  const options = (/** @type {string} */ title) => ({ title, text: `${text} ${t("timing.stillThere")}` });
  setCardState(frame.pickCard, "error", options(t("timing.recipesFailed")));
  setCardState(frame.nonePlate, "error", options(t("timing.recipesFailed")));
  for (const c of [frame.sentenceCard, frame.timerCard, frame.nudgeCard]) setCardState(c, "error", options(t("timing.stepsFailed")));
  // The timeline shows its own failed plate (with Retry) inside the plan card, as the package's timeline does.
  if (gantt) {
    const o = options(t("timing.stepsFailed"));
    setCardState(frame.planCard, "ready");
    setTimelineState(gantt, "error", o.title, { text: o.text });
  } else setCardState(frame.planCard, "error", options(t("timing.stepsFailed")));
}

/** The picker: the recipes with step times in name order, the chosen one set. @param {FillDeps} d @param {Item[]} list */
function fillPicker({ ctx, frame }, list) {
  const { root, recipeId, navigate } = ctx;
  const { box } = frame;
  const listEl = /** @type {HTMLElement} */ ($("#tm-recipe-list", root));
  listEl.querySelectorAll("li[data-kp-option]").forEach((li) => li.remove());
  for (const r of list) listEl.prepend(h("li", { class: "kp-combobox__option", role: "option", "data-kp-option": "", "data-value": r.id }, r.name));
  // Options are kept in name order: prepend reversed them.
  const options = [...listEl.querySelectorAll("li[data-kp-option]")].reverse();
  listEl.prepend(...options);
  const handle = combobox(box);
  handle?.refresh();
  const said = /** @type {HTMLElement} */ ($("#tm-pick-said", root));
  const actions = /** @type {HTMLElement} */ ($("#tm-pick-actions", root));
  box.addEventListener("kp-combobox-change", (event) => {
    const { value } = /** @type {CustomEvent} */ (event).detail;
    if (value && value !== recipeId) navigate(`/timing?id=${encodeURIComponent(value)}`);
  });
  ctx.recipe = recipeId ? recipeById(recipeId) : null;
  actions.replaceChildren();
  return { handle, said, actions };
}

/** What the picker says about the recipe of the link. @param {FillDeps} d @param {ReturnType<typeof fillPicker>} picker */
function sayRecipe({ ctx }, { handle, said, actions }) {
  if (ctx.recipe && hasTimes(ctx.recipe)) {
    handle?.set([String(ctx.recipe.id)]);
    const lanes = /** @type {Item[]} */ (ctx.recipe.tracks ?? []).length;
    said.textContent = t("timing.said", timedSteps(ctx.recipe).length, lanes, words(Number(ctx.recipe.minutes) || 0));
    actions.append(h("a", { class: "kp-button kp-button--sm", href: `/recipe?id=${encodeURIComponent(String(ctx.recipe.id))}` }, t("timing.openRecipe")));
  } else {
    said.textContent = ctx.recipeId ? t("timing.thatNoTimes") : t("timing.chooseToCount");
  }
}

/** The one action that helps a recipe that cannot be counted back. @param {FillDeps} d */
function helpAction(d) {
  const recipe = d.ctx.recipe;
  if (recipe) return h("a", { class: "kp-button kp-button--primary", href: `/recipe?id=${encodeURIComponent(String(recipe.id))}` }, t("timing.openRecipe"));
  return h("button", { type: "button", class: "kp-button kp-button--primary", onclick: () => focusPicker(d) }, t("timing.chooseRecipe"));
}

/** The recipe of the link is missing or has no step times: every card says so, with the one action that helps. @param {FillDeps} d */
function showNotCountable(d) {
  const { ctx, frame, gantt } = d;
  const title = ctx.recipe ? t("timing.thisNoTimes") : t("timing.notInKitchen");
  const text = ctx.recipe ? t("timing.giveEveryStep") : t("timing.linkOld");
  for (const c of [frame.sentenceCard, frame.timerCard, frame.nudgeCard]) setCardState(c, "empty", plate(title, text, helpAction(d)));
  if (gantt) setTimelineState(gantt, "ready");
  setCardState(frame.planCard, "empty", plate(title, text, helpAction(d)));
}

/** The dinner time, pace and time to spare from the settings, shown in the sentence's controls. @param {FillDeps} d @param {Record<string, any>} s */
function readSettings({ ctx, sentence }, s) {
  const { state } = ctx;
  const { eatEl, paceEl, spareEl } = sentence;
  state.eat = typeof s.dinner_time === "string" && /^\d{1,2}:\d{2}$/.test(s.dinner_time) ? s.dinner_time : DEFAULTS.dinner_time;
  state.pace = s.pace === "slow" ? "slow" : "normal";
  state.spare = Number.isFinite(Number(s.spare)) ? Number(s.spare) : DEFAULTS.spare;
  if (spareEl && !SPARES.includes(state.spare)) spareEl.append(h("option", { value: state.spare }, t("timing.minutes", state.spare)));
  if (eatEl) {
    // A dinner time outside the usual window still shows: the window widens to hold it.
    const mins = Number(state.eat.slice(0, 2)) * 60 + Number(state.eat.slice(3));
    if (mins < 16 * 60) eatEl.setAttribute("data-kp-time-min", state.eat);
    if (mins > 22 * 60) eatEl.setAttribute("data-kp-time-max", state.eat);
    setTime(eatEl, state.eat);
  }
  if (paceEl) paceEl.value = state.pace;
  if (spareEl) spareEl.value = String(state.spare);
  for (const el of [paceEl, spareEl]) if (el) drawnSelect(el)?.refresh();
}

/** The sentence card's title and the line about the recipe's tracks. @param {FillDeps} d @param {Item} recipe */
function fillSentenceCard({ ctx }, recipe) {
  /** @type {HTMLElement} */ ($("#tm-sentence-card-t", ctx.root)).textContent = String(recipe.name);
  const tracks = /** @type {Item[]} */ (recipe.tracks ?? []);
  /** @type {HTMLElement} */ ($("#tm-sentence-card-body", ctx.root)).textContent =
    tracks.length > 1 ? t("timing.cookAtOnce", tracks.length, tracks.map((tr) => String(tr.name).toLowerCase()).join(", ").replace(/, ([^,]*)$/, ` ${t("timing.and")} $1`)) : t("timing.oneTrack");
}

/** No recipe has step times yet: the picker and the plate say so. @param {FillDeps} d */
function showNoTimes({ frame }) {
  const open = () => h("a", { class: "kp-button kp-button--primary", href: "/recipes" }, t("timing.openRecipes"));
  setCardState(frame.pickCard, "empty", plate(t("timing.noTimesTitle"), t("timing.noTimesText"), open()));
  setCardState(frame.nonePlate, "empty", plate(t("timing.noTimesTitle"), t("timing.noTimesText2"), open()));
}

/** The page once the kitchen has arrived. @param {FillDeps} d @param {import("../../api.js").Kitchen} k */
function fill(d, k) {
  const { ctx, frame, gantt } = d;
  const list = countable(k);
  const picker = fillPicker(d, list);
  if (list.length === 0) return showNoTimes(d);
  setCardState(frame.pickCard, "ready");
  sayRecipe(d, picker);
  if (!ctx.recipeId) {
    setCardState(frame.nonePlate, "empty", plate(t("timing.pickRecipe"), t("timing.chooseAbove"), h("button", { type: "button", class: "kp-button kp-button--primary", onclick: () => focusPicker(d) }, t("timing.chooseRecipe"))));
    return;
  }
  // The recipe of the link: missing, without step times, or ready.
  if (!ctx.recipe || !hasTimes(ctx.recipe)) return showNotCountable(d);
  readSettings(d, k.settings ?? {});
  fillSentenceCard(d, ctx.recipe);
  setCardState(frame.sentenceCard, "ready");
  if (gantt) setTimelineState(gantt, "ready");
  for (const c of [frame.planCard, frame.timerCard, frame.nudgeCard]) setCardState(c, "ready");
  ctx.view.draw();
}

/** @param {FillDeps} d @param {boolean} force */
async function load(d, force) {
  const { ctx, frame, gantt } = d;
  for (const c of ctx.root.querySelectorAll(".kp-card")) {
    if (c === frame.planCard && gantt) {
      setCardState(frame.planCard, "ready");
      setTimelineState(gantt, "loading");
    } else setCardState(/** @type {HTMLElement} */ (c), "loading");
  }
  try {
    const k = await loadKitchen({ force });
    if (ctx.alive) fill(d, k);
  } catch (e) {
    if (ctx.alive) failed(d, e);
  }
}

/**
 * The states of the page: loading, failed, empty plates, and the filled page once the kitchen has arrived.
 * @param {import("./index.js").TimingCtx} ctx
 * @param {{ frame: FillDeps["frame"], sentence: FillDeps["sentence"], gantt: HTMLElement | null }} parts
 */
export function createFiller(ctx, { frame, sentence, gantt }) {
  const deps = { ctx, frame, sentence, gantt };
  return { load: (/** @type {boolean} */ force) => load(deps, force) };
}
