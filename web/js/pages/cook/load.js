// Load the kitchen, fill the screen with the recipe, and Try again. A newer load wins: `ctx.seq` is bumped by each and by
// leaving the page, so an answer that arrives late is dropped.

import { loadKitchen, onKitchen, recipeById } from "../../api.js";
import { t } from "../../i18n/index.js";
import { plateScreen } from "./parts.js";
import { showLoading, showError } from "./states.js";
import { fill } from "./fill.js";

/** The settings that act on this screen: the timers' sound. @param {import("./index.js").CookCtx} ctx @param {Record<string, any>} settings */
const applySettings = (ctx, settings) => ctx.el.timers.setAttribute("data-kp-timers-sound", settings.timer_sound || "chime");

/** @param {import("./index.js").CookCtx} ctx @param {boolean} force */
async function load(ctx, force) {
  const mine = ++ctx.seq;
  try {
    const k = await loadKitchen({ force });
    if (!ctx.alive || mine !== ctx.seq) return;
    applySettings(ctx, k.settings ?? {});
    const r = recipeById(ctx.recipeId);
    if (!r) {
      plateScreen(ctx, t("cook.notHere"), t("cook.removed"), t("shell.openWheel"), "/");
      return;
    }
    fill(ctx, r);
  } catch (e) {
    if (!ctx.alive || mine !== ctx.seq) return;
    showError(ctx, e instanceof Error ? e.message : t("cook.loadFailed"));
  }
}

/** Follow the settings, wire Try again on every component, and start the first load. @param {import("./index.js").CookCtx} ctx */
export function startLoading(ctx) {
  ctx.cleanups.push(
    onKitchen((k) => {
      if (ctx.alive) applySettings(ctx, k.settings ?? {});
    }),
  );
  const retry = () => {
    showLoading(ctx);
    void load(ctx, true);
  };
  const { mise, steps, timers, line } = ctx.el;
  for (const [el, type] of /** @type {const} */ ([
    [ctx.root, "kp-card-retry"],
    [mise, "kp-checklist-retry"],
    [steps, "kp-focus-steps-retry"],
    [timers, "kp-timers-retry"],
    [line.el, "kp-gantt-retry"],
  ]))
    el.addEventListener(type, retry);
  void load(ctx, false);
}
