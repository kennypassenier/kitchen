// Keeps the full-viewport stage in step with the cook (stage-state.js decides, this paints): the timers bar pinned at the
// top while a timer exists, the "Gather first" button until cooking has begun, the dinner card once the last step is done.
// It also tells the stylesheet how far down the page the stage starts (`--ck-above`), so the stage fills the rest of the
// viewport whatever the shell's bar measures in this theme and at this width.

import { getTimers } from "/static/kp/dist/kp-themes.min.js";
import { stageParts } from "./stage-state.js";

/** @param {import("./index.js").CookCtx} ctx */
export function paintStage(ctx) {
  const { pinned, gatherBtn, doneSection, timers } = ctx.el;
  const parts = stageParts({ started: Boolean(ctx.memo.started), finished: ctx.finished, timers: getTimers(timers) });
  pinned.hidden = !parts.timers;
  gatherBtn.hidden = !parts.gather;
  if (parts.done) doneSection.hidden = false;
  return parts;
}

/** Measure where the stage starts and keep it measured on a resize. @param {import("./index.js").CookCtx} ctx */
function followTop(ctx) {
  const { screen } = ctx.el;
  const measure = () => {
    const top = screen.getBoundingClientRect().top + window.scrollY;
    screen.style.setProperty("--ck-above", `${Math.max(0, Math.round(top))}px`);
  };
  measure();
  const ro = new ResizeObserver(measure);
  ro.observe(document.documentElement);
  ctx.cleanups.push(() => ro.disconnect());
}

/** Repaint on every event that can change what the stage shows. @param {import("./index.js").CookCtx} ctx */
export function wireStage(ctx) {
  const repaint = () => paintStage(ctx);
  for (const type of ["kp-timer-start", "kp-timer-change", "kp-timer-done", "kp-timer-stop"]) ctx.el.timers.addEventListener(type, repaint);
  ctx.el.steps.addEventListener("kp-focus-steps-done", repaint);
  ctx.view.paintStage = repaint;
  followTop(ctx);
  repaint();
}
