// Part 4: the mini recipe, the safe recipe cooked longest ago, shrunk to its smallest steps (or in full).

import { setSegmentedValues, setFocusSteps, setFocusStepsState } from "/static/kp/dist/kp-themes.min.js";
import { $ } from "../../dom.js";
import { t } from "../../i18n/index.js";
import { miniRecipe, toFocusSteps } from "./helpers.js";

/** @typedef {import("../../api.js").Kitchen} Kitchen */
/** @typedef {import("../../api.js").Item} Item */

/** @param {HTMLElement} group @param {boolean} off */
function setSegmentedDisabled(group, off) {
  if (off) group.setAttribute("aria-disabled", "true");
  else group.removeAttribute("aria-disabled");
}

/** The "cook this" link: off with no recipe, else the recipe in cook mode (mini or in full), fresh. @param {HTMLAnchorElement} cook @param {Item | null} recipe @param {"mini" | "full"} version */
function setCook(cook, recipe, version) {
  if (!recipe) {
    cook.removeAttribute("href");
    cook.setAttribute("aria-disabled", "true");
    cook.textContent = t("bad.cookThis");
    return;
  }
  cook.removeAttribute("aria-disabled");
  cook.textContent = t("bad.cookThis");
  cook.href = `/cook?id=${encodeURIComponent(recipe.id)}${version === "mini" ? "&mini=1" : ""}&fresh=1`;
}

/** The sentence under the title: what the version holds. @param {Item} mini @param {"mini" | "full"} version @param {Item[]} steps @param {Item[]} small */
function ledeOf(mini, version, steps, small) {
  const minutes = (version === "mini" ? small : steps).reduce((sum, s) => sum + (Number(s.mins) || 0), 0);
  return version === "mini"
    ? t("bad.miniLede", small.length, minutes, mini.gear, mini.mini_note || t("bad.leftOut", steps.length - small.length))
    : t("bad.fullLede", steps.length, mini.minutes, mini.portions, mini.gear);
}

/**
 * @typedef {object} MiniState
 * @property {import("./index.js").BadDaysCtx} ctx
 * @property {{ title: HTMLElement, version: HTMLElement, lede: HTMLElement, steps: HTMLElement, cook: HTMLAnchorElement }} el
 * @property {Item | null} mini
 * @property {"mini" | "full"} version
 */

/** @param {MiniState} m */
function drawMini(m) {
  const { mini, el } = m;
  if (!mini) return;
  const steps = /** @type {Item[]} */ (mini.steps);
  const small = steps.filter((s) => s.mini);
  const hasMini = small.length > 0;
  if (!hasMini) m.version = "full";
  const shown = m.version === "mini" ? small : steps;
  el.lede.textContent = ledeOf(mini, m.version, steps, small);
  el.steps.setAttribute("aria-label", `${mini.name}, ${m.version === "mini" ? t("bad.miniVersion").toLowerCase() : t("bad.fullRecipe").toLowerCase()}`);
  setFocusStepsState(el.steps, "ready");
  setFocusSteps(el.steps, toFocusSteps(shown));
  setSegmentedValues(el.version, [m.version]);
  const miniItem = /** @type {HTMLButtonElement | null} */ ($('[data-value="mini"]', el.version));
  if (miniItem) miniItem.disabled = !hasMini;
  setSegmentedDisabled(el.version, false);
  setCook(el.cook, mini, m.version);
}

/** No safe recipe yet: the card points at the recipes. @param {MiniState} m */
function drawNoMini({ el }) {
  el.title.textContent = t("bad.miniDefault");
  el.lede.textContent = "";
  setFocusStepsState(el.steps, "ready");
  setFocusSteps(el.steps, []);
  setSegmentedDisabled(el.version, true);
  el.cook.removeAttribute("aria-disabled");
  el.cook.textContent = t("bad.openMine");
  el.cook.href = "/recipes";
}

/** @param {MiniState} m @param {Kitchen} k */
function renderMini(m, k) {
  const recipe = miniRecipe(k);
  const signature = JSON.stringify(recipe ? [recipe.id, recipe.name, recipe.steps, recipe.mini_note, recipe.gear, recipe.minutes, recipe.portions] : null);
  if (signature === m.ctx.drawn.mini) return;
  m.ctx.drawn.mini = signature;
  m.mini = recipe;
  m.version = "mini";
  if (!recipe) return drawNoMini(m);
  m.el.title.textContent = recipe.name;
  drawMini(m);
}

/** @param {import("./index.js").BadDaysCtx} ctx */
export function createMini(ctx) {
  const { page } = ctx;
  const q = (/** @type {string} */ sel) => $(sel, page);
  /** @type {MiniState} */
  const m = {
    ctx,
    el: {
      title: /** @type {HTMLElement} */ (q("[data-bd-mini-title]")),
      version: /** @type {HTMLElement} */ (q("[data-bd-version]")),
      lede: /** @type {HTMLElement} */ (q("[data-bd-mini-lede]")),
      steps: /** @type {HTMLElement} */ (q("[data-bd-steps]")),
      cook: /** @type {HTMLAnchorElement} */ (q("[data-bd-cook]")),
    },
    mini: null,
    version: "mini",
  };
  const { el } = m;
  el.version.addEventListener("kp-segmented-change", (event) => {
    const value = /** @type {CustomEvent} */ (event).detail.value;
    if (!m.mini || (value !== "mini" && value !== "full") || value === m.version) return;
    m.version = value;
    drawMini(m);
  });
  el.steps.addEventListener("kp-focus-steps-retry", ctx.reload);
  el.cook.addEventListener("click", (event) => {
    if (el.cook.getAttribute("aria-disabled") === "true") event.preventDefault();
  });
  return {
    render: (/** @type {Kitchen} */ k) => renderMini(m, k),
    loading: () => {
      setFocusStepsState(el.steps, "loading", t("bad.loadingRecipe"));
      setCook(el.cook, null, m.version);
      setSegmentedDisabled(el.version, true);
    },
    /** @param {string} why */
    failed: (why) => {
      setFocusStepsState(el.steps, "error", `${t("bad.recipeFailed")} ${why}`);
      setCook(el.cook, null, m.version);
    },
  };
}
