// The states of the page: loading, failed, empty plates, and the filled page once the kitchen has arrived.

import { h, $ } from "../../dom.js";
import { loadKitchen, recipeById } from "../../api.js";
import { setCardState, combobox, drawnSelect, setTime } from "/static/kp/dist/kp-themes.min.js";
import { setTimelineState } from "../../recipe/timeline.js";
import { t } from "../../i18n/index.js";
import { DEFAULTS, SPARES, hasTimes, timedSteps, countedMinutes } from "./plan.js";
import { words } from "./text.js";
import { readDinnerToday } from "../../dinner-today.js";
import { notCountableKeys } from "./plates.js";

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

/** The plate of a recipe that cannot be counted back, with the one action that helps (if any). @param {string} title @param {string} text @param {HTMLElement} [action] */
const plate = (title, text, action) => ({ title, text, action });

/** The picker's field and its line. @param {FillDeps} d */
const pickerParts = (d) => ({ input: /** @type {HTMLInputElement} */ ($("#tm-recipe", d.ctx.root)), said: /** @type {HTMLElement} */ ($("#tm-pick-said", d.ctx.root)) });

/** @param {FillDeps} d @param {unknown} e */
function failed(d, e) {
  const { frame, gantt } = d;
  const text = e instanceof Error ? e.message : t("timing.noAnswer");
  const options = (/** @type {string} */ title) => ({ title, text: `${text} ${t("timing.stillThere")}` });
  pickerParts(d).said.textContent = t("timing.recipesFailed");
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
  /** @type {HTMLInputElement} */ ($("#tm-recipe", root)).disabled = false;
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

/** What the picker says about the recipe of the link: its steps counted as the plan counts them (feat-timing-durations-1). @param {FillDeps} d @param {ReturnType<typeof fillPicker>} picker */
function sayRecipe({ ctx }, { handle, said, actions }) {
  if (ctx.recipe && hasTimes(ctx.recipe)) {
    handle?.set([String(ctx.recipe.id)]);
    const lanes = /** @type {Item[]} */ (ctx.recipe.tracks ?? []).length;
    const line = t("timing.said", timedSteps(ctx.recipe).length, lanes, words(countedMinutes(ctx.recipe)));
    said.textContent = ctx.fromWheel ? t("timing.fromWheel", line) : line;
    actions.append(h("a", { class: "kp-button kp-button--sm", href: `/recipe?id=${encodeURIComponent(String(ctx.recipe.id))}` }, t("timing.openRecipe")));
  } else {
    said.textContent = !ctx.recipeId ? t("timing.chooseToCount") : ctx.recipe ? t("timing.thatNoTimes") : t("timing.thatMissing");
  }
}

/** The one action that helps a recipe that cannot be counted back: open it to give its steps times. A recipe that is not
 * in the kitchen has no action; the picker in the header is the way on. @param {FillDeps} d */
function helpAction(d) {
  const recipe = d.ctx.recipe;
  return recipe ? h("a", { class: "kp-button kp-button--primary", href: `/recipe?id=${encodeURIComponent(String(recipe.id))}` }, t("timing.openRecipe")) : undefined;
}

/** The recipe of the link is missing or has no step times: every card says so, with the one action that helps. @param {FillDeps} d */
function showNotCountable(d) {
  const { ctx, frame, gantt } = d;
  const keys = notCountableKeys({ found: Boolean(ctx.recipe), fromWheel: ctx.fromWheel });
  const title = t(keys.title);
  const text = t(keys.text);
  for (const c of [frame.sentenceCard, frame.timerCard, frame.nudgeCard]) setCardState(c, "empty", plate(title, text, helpAction(d)));
  if (gantt) setTimelineState(gantt, "ready");
  setCardState(frame.planCard, "empty", plate(title, text, helpAction(d)));
}

/** The dinner time (today's own, else the settings' default), pace and time to spare from the settings, shown in the sentence's controls. @param {FillDeps} d @param {Record<string, any>} s */
function readSettings({ ctx, sentence }, s) {
  const { state } = ctx;
  const { eatEl, paceEl, spareEl } = sentence;
  // Today's own dinner time wins over the default (feat-timing-today-1); tomorrow starts from the default again.
  const usual = typeof s.dinner_time === "string" && /^\d{1,2}:\d{2}$/.test(s.dinner_time) ? s.dinner_time : DEFAULTS.dinner_time;
  state.eat = readDinnerToday() ?? usual;
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
function showNoTimes(d) {
  const { frame } = d;
  const open = () => h("a", { class: "kp-button kp-button--primary", href: "/recipes" }, t("timing.openRecipes"));
  const { input, said } = pickerParts(d);
  input.disabled = true;
  said.textContent = t("timing.noTimesTitle");
  setCardState(frame.nonePlate, "empty", plate(t("timing.noTimesTitle"), t("timing.noTimesText2"), open()));
}

/** The page once the kitchen has arrived. @param {FillDeps} d @param {import("../../api.js").Kitchen} k */
function fill(d, k) {
  const { ctx, frame, gantt } = d;
  const list = countable(k);
  const picker = fillPicker(d, list);
  if (list.length === 0) return showNoTimes(d);
  sayRecipe(d, picker);
  if (!ctx.recipeId) {
    // No recipe yet: the plate says where the picker is; it has no button of its own (Kenny, 01/11/2026 "Eén kiezer").
    setCardState(frame.nonePlate, "empty", plate(t("timing.pickRecipe"), t("timing.chooseAbove")));
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
