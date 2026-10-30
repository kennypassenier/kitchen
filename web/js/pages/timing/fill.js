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
 * @param {import("./index.js").TimingCtx} ctx
 * @param {{ frame: ReturnType<typeof import("./frame.js").buildFrame>, sentence: ReturnType<typeof import("./sentence.js").createSentence>, gantt: HTMLElement | null }} parts
 */
export function createFiller(ctx, { frame, sentence, gantt }) {
  const { root, recipeId, navigate, state } = ctx;
  const { pickCard, sentenceCard, planCard, timerCard, nudgeCard, nonePlate, box } = frame;
  const { eatEl, paceEl, spareEl } = sentence;
  // ---- the states -----------------------------------------------------------------------------------------------
  const dataCards = [sentenceCard, timerCard, nudgeCard];

  /** The recipes that can be counted back, A to Z. @param {import("../api.js").Kitchen} k */
  const countable = (k) => k.recipes.filter(hasTimes).sort((a, b) => String(a.name).localeCompare(String(b.name)));

  /** @param {unknown} e */
  function failed(e) {
    const text = e instanceof Error ? e.message : t("timing.noAnswer");
    const options = (/** @type {string} */ title) => ({ title, text: `${text} ${t("timing.stillThere")}` });
    setCardState(pickCard, "error", options(t("timing.recipesFailed")));
    setCardState(nonePlate, "error", options(t("timing.recipesFailed")));
    for (const c of dataCards) setCardState(c, "error", options(t("timing.stepsFailed")));
    // The timeline shows its own failed plate (with Retry) inside the plan card, as the package's timeline does.
    if (gantt) {
      const o = options(t("timing.stepsFailed"));
      setCardState(planCard, "ready");
      setTimelineState(gantt, "error", o.title, { text: o.text });
    } else setCardState(planCard, "error", options(t("timing.stepsFailed")));
  }

  /** The plate of a recipe that cannot be counted back, with the one action that helps. @param {string} title @param {string} text @param {HTMLElement} action */
  const plate = (title, text, action) => ({ title, text, action });

  /** @param {import("../api.js").Kitchen} k */
  function fill(k) {
    const list = countable(k);
    // The picker: recipes with step times, the chosen one set.
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
    if (list.length === 0) {
      setCardState(pickCard, "empty", plate(t("timing.noTimesTitle"), t("timing.noTimesText"), h("a", { class: "kp-button kp-button--primary", href: "/recipes" }, t("timing.openRecipes"))));
      setCardState(nonePlate, "empty", plate(t("timing.noTimesTitle"), t("timing.noTimesText2"), h("a", { class: "kp-button kp-button--primary", href: "/recipes" }, t("timing.openRecipes"))));
      return;
    }
    setCardState(pickCard, "ready");
    if (ctx.recipe && hasTimes(ctx.recipe)) {
      handle?.set([String(ctx.recipe.id)]);
      const lanes = /** @type {Item[]} */ (ctx.recipe.tracks ?? []).length;
      said.textContent = t("timing.said", timedSteps(ctx.recipe).length, lanes, words(Number(ctx.recipe.minutes) || 0));
      actions.append(h("a", { class: "kp-button kp-button--sm", href: `/recipe?id=${encodeURIComponent(String(ctx.recipe.id))}` }, t("timing.openRecipe")));
    } else {
      said.textContent = recipeId ? t("timing.thatNoTimes") : t("timing.chooseToCount");
    }

    if (!recipeId) {
      setCardState(nonePlate, "empty", plate(t("timing.pickRecipe"), t("timing.chooseAbove"), h("button", { type: "button", class: "kp-button kp-button--primary", onclick: () => /** @type {HTMLInputElement | null} */ ($("#tm-recipe", root))?.focus() }, t("timing.chooseRecipe"))));
      return;
    }
    // The recipe of the link: missing, without step times, or ready.
    if (!ctx.recipe || !hasTimes(ctx.recipe)) {
      const title = ctx.recipe ? t("timing.thisNoTimes") : t("timing.notInKitchen");
      const text = ctx.recipe
        ? t("timing.giveEveryStep")
        : t("timing.linkOld");
      const again = () => h(ctx.recipe ? "a" : "button", ctx.recipe ? { class: "kp-button kp-button--primary", href: `/recipe?id=${encodeURIComponent(String(ctx.recipe?.id))}` } : { type: "button", class: "kp-button kp-button--primary", onclick: () => /** @type {HTMLInputElement | null} */ ($("#tm-recipe", root))?.focus() }, ctx.recipe ? t("timing.openRecipe") : t("timing.chooseRecipe"));
      for (const c of dataCards) setCardState(c, "empty", plate(title, text, again()));
      if (gantt) setTimelineState(gantt, "ready");
      setCardState(planCard, "empty", plate(title, text, again()));
      return;
    }

    const s = k.settings ?? {};
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
    /** @type {HTMLElement} */ ($("#tm-sentence-card-t", root)).textContent = String(ctx.recipe.name);
    const tracks = /** @type {Item[]} */ (ctx.recipe.tracks ?? []);
    /** @type {HTMLElement} */ ($("#tm-sentence-card-body", root)).textContent =
      tracks.length > 1 ? t("timing.cookAtOnce", tracks.length, tracks.map((tr) => String(tr.name).toLowerCase()).join(", ").replace(/, ([^,]*)$/, ` ${t("timing.and")} $1`)) : t("timing.oneTrack");
    setCardState(sentenceCard, "ready");
    if (gantt) setTimelineState(gantt, "ready");
    setCardState(planCard, "ready");
    setCardState(timerCard, "ready");
    setCardState(nudgeCard, "ready");
    ctx.view.draw();
  }

  /** @param {boolean} force */
  async function load(force) {
    for (const c of root.querySelectorAll(".kp-card")) {
      if (c === planCard && gantt) {
        setCardState(planCard, "ready");
        setTimelineState(gantt, "loading");
      } else setCardState(/** @type {HTMLElement} */ (c), "loading");
    }
    try {
      const k = await loadKitchen({ force });
      if (ctx.alive) fill(k);
    } catch (e) {
      if (ctx.alive) failed(e);
    }
  }
  return { load };
}
