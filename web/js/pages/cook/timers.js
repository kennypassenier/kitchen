// The running timers: the attention band that says a timer ended and where to go on, and the discs that follow the
// package's timers. The component's events are the only input; the memory keeps the timers for a reload.

import { h, $ } from "../../dom.js";
import { setAttention } from "/static/kp/js/attention.js";
import { goToStep } from "/static/kp/js/focus-steps.js";
import { getTimers, stopTimer } from "/static/kp/js/timer.js";
import { attachTimerDiscs, timerDiscOf } from "/static/kp/js/timer-disc.js";
import { setCardState } from "/static/kp/js/card-state.js";
import { t } from "../../i18n/index.js";
import { nextAfter } from "./logic.js";

/** The dial the discs measure: 60 minutes, the classic Time Timer (Kenny's default). */
export const DIAL_MINUTES = 60;

/** The band lists every finished timer with the button that goes on. @param {import("./index.js").CookCtx} ctx */
function createBand(ctx) {
  const { band, steps, timers } = ctx.el;
  const refreshBand = () => {
    const done = getTimers(timers).filter((tm) => tm.state === "done");
    setAttention(
      band,
      done.map((tm) => {
        const next = nextAfter(ctx.shown, tm);
        const action = h(
          "button",
          { type: "button", class: "kp-button kp-button--sm", ...(next ? { "data-ck-from": ctx.shown.findIndex((x) => x.id === tm.id) } : { "data-ck-stop": tm.id }) },
          next ? t("cook.goToStep", next.number) : t("cook.stopTimer", tm.name),
        );
        return { key: tm.id, severity: /** @type {const} */ ("warning"), title: t("cook.timerDone", tm.name), text: next ? t("cook.nextIs", next.number, next.text) : t("cook.nothingLeft"), action };
      }),
    );
  };
  band.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (!button) return;
    if (button.hasAttribute("data-ck-from")) {
      // Back to the step that started the timer, then on with the view's own Next, so that step counts as done.
      goToStep(steps, Number(button.getAttribute("data-ck-from")));
      $(".kp-focus-steps__next", steps)?.click();
    } else if (button.hasAttribute("data-ck-stop")) stopTimer(timers, button.getAttribute("data-ck-stop") ?? "");
  });
  return refreshBand;
}

/** One disc per running timer; they are detached together when the page is left. @param {import("./index.js").CookCtx} ctx */
function createDiscs(ctx) {
  const { discs, discCard, steps } = ctx.el;
  /** @type {Map<string, { el: HTMLElement, detach: () => void }>} */
  const discOf = new Map();
  const paintDiscCard = () => {
    if (discOf.size) setCardState(discCard, "ready");
    else
      setCardState(discCard, "empty", {
        title: t("cook.noTimerTitle"),
        text: t("cook.noTimerText"),
        action: h("button", { type: "button", class: "kp-button", onclick: () => steps.focus() }, t("cook.goSteps")),
      });
  };
  /** @param {{ id: string, name: string, seconds: number, remaining: number, state: string }} tm */
  function addDisc(tm) {
    if (discOf.has(tm.id) || tm.state === "done") return;
    const el = h("div", { class: "kp-timer-disc", "data-kp-timer-disc": `${Math.max(1, tm.remaining)}s`, "data-kp-timer-disc-name": tm.name, "data-kp-timer-disc-scale": DIAL_MINUTES });
    discs.append(el);
    const detach = attachTimerDiscs(el);
    discOf.set(tm.id, { el, detach });
    if (tm.state === "running") timerDiscOf(el)?.start();
    paintDiscCard();
  }
  /** @param {string} id */
  function dropDisc(id) {
    const d = discOf.get(id);
    if (!d) return;
    d.detach();
    d.el.remove();
    discOf.delete(id);
    paintDiscCard();
  }
  ctx.cleanups.push(() => {
    for (const d of discOf.values()) d.detach();
    discOf.clear();
  });
  /** The disc of a timer changes with the timer's own action. @param {string} id @param {string} action */
  const touchDisc = (id, action) => {
    const found = discOf.get(id);
    const clock = found ? timerDiscOf(found.el) : null;
    if (action === "pause") clock?.pause();
    else if (action === "resume") clock?.start();
    else if (action === "add") clock?.add(60);
  };
  return { addDisc, dropDisc, paintDiscCard, touchDisc };
}

/** @param {import("./index.js").CookCtx} ctx */
export function createTimers(ctx) {
  const refreshBand = createBand(ctx);
  const discs = createDiscs(ctx);
  /** @param {Event} event */
  const onTimer = (event) => {
    const { timer, action } = /** @type {CustomEvent} */ (event).detail ?? {};
    switch (event.type) {
      case "kp-timer-start":
        discs.dropDisc(timer.id);
        discs.addDisc(timer);
        break;
      case "kp-timer-change":
        discs.touchDisc(timer.id, action);
        break;
      case "kp-timer-stop":
        discs.dropDisc(timer.id);
        break;
    }
    refreshBand();
    ctx.memo.timers = getTimers(ctx.el.timers);
    ctx.keep();
  };
  for (const type of ["kp-timer-start", "kp-timer-change", "kp-timer-done", "kp-timer-stop"]) ctx.el.timers.addEventListener(type, onTimer);
  return { refreshBand, addDisc: discs.addDisc, paintDiscCard: discs.paintDiscCard };
}
