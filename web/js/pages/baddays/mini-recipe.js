// Part 4: the mini recipe, the safe recipe cooked longest ago, shrunk to its smallest steps (or in full).

import { setSegmentedValues } from "/static/kp/js/segmented.js";
import { setFocusSteps, setFocusStepsState } from "/static/kp/js/focus-steps.js";
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

/** @param {import("./index.js").BadDaysCtx} ctx */
export function createMini(ctx) {
  const { page, drawn } = ctx;
  const miniTitle = /** @type {HTMLElement} */ ($("[data-bd-mini-title]", page));
  const miniVersion = /** @type {HTMLElement} */ ($("[data-bd-version]", page));
  const miniLede = /** @type {HTMLElement} */ ($("[data-bd-mini-lede]", page));
  const miniSteps = /** @type {HTMLElement} */ ($("[data-bd-steps]", page));
  const cook = /** @type {HTMLAnchorElement} */ ($("[data-bd-cook]", page));
  /** @type {Item | null} */
  let mini = null;
  /** @type {"mini" | "full"} */
  let version = "mini";

  function drawMini() {
    if (!mini) return;
    const steps = /** @type {Item[]} */ (mini.steps);
    const small = steps.filter((s) => s.mini);
    const hasMini = small.length > 0;
    if (!hasMini) version = "full";
    const shown = version === "mini" ? small : steps;
    miniLede.textContent = ledeOf(mini, version, steps, small);
    miniSteps.setAttribute("aria-label", `${mini.name}, ${version === "mini" ? t("bad.miniVersion").toLowerCase() : t("bad.fullRecipe").toLowerCase()}`);
    setFocusStepsState(miniSteps, "ready");
    setFocusSteps(miniSteps, toFocusSteps(shown));
    setSegmentedValues(miniVersion, [version]);
    const miniItem = /** @type {HTMLButtonElement | null} */ ($('[data-value="mini"]', miniVersion));
    if (miniItem) miniItem.disabled = !hasMini;
    setSegmentedDisabled(miniVersion, false);
    setCook(cook, mini, version);
  }

  /** @param {Kitchen} k */
  function renderMini(k) {
    const recipe = miniRecipe(k);
    const signature = JSON.stringify(recipe ? [recipe.id, recipe.name, recipe.steps, recipe.mini_note, recipe.gear, recipe.minutes, recipe.portions] : null);
    if (signature === drawn.mini) return;
    drawn.mini = signature;
    mini = recipe;
    version = "mini";
    if (!recipe) {
      miniTitle.textContent = t("bad.miniDefault");
      miniLede.textContent = "";
      setFocusStepsState(miniSteps, "ready");
      setFocusSteps(miniSteps, []);
      setSegmentedDisabled(miniVersion, true);
      cook.removeAttribute("aria-disabled");
      cook.textContent = t("bad.openMine");
      cook.href = "/recipes";
      return;
    }
    miniTitle.textContent = recipe.name;
    drawMini();
  }

  miniVersion.addEventListener("kp-segmented-change", (event) => {
    const value = /** @type {CustomEvent} */ (event).detail.value;
    if (!mini || (value !== "mini" && value !== "full") || value === version) return;
    version = value;
    drawMini();
  });
  miniSteps.addEventListener("kp-focus-steps-retry", ctx.reload);
  cook.addEventListener("click", (event) => {
    if (cook.getAttribute("aria-disabled") === "true") event.preventDefault();
  });
  return {
    render: renderMini,
    loading: () => {
      setFocusStepsState(miniSteps, "loading", t("bad.loadingRecipe"));
      setCook(cook, null, version);
      setSegmentedDisabled(miniVersion, true);
    },
    /** @param {string} why */
    failed: (why) => {
      setFocusStepsState(miniSteps, "error", `${t("bad.recipeFailed")} ${why}`);
      setCook(cook, null, version);
    },
  };
}
