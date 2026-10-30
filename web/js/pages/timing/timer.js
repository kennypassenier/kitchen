// The disc and the digits: one wait to the moment the first track starts, both counting down by themselves.

import { h, $ } from "../../dom.js";
import { attachTimerDiscs } from "/static/kp/js/timer-disc.js";
import { attachCountdowns } from "/static/kp/js/countdown.js";
import { attachSwitches } from "/static/kp/js/forms.js";
import { t } from "../../i18n/index.js";
import { ZONE } from "../../format.js";
import { MIN, hm } from "./plan.js";
import { words, startsInWords } from "./text.js";

const DIGITS_KEY = "kitchen:timing-digits";

/** @param {import("./index.js").TimingCtx} ctx */
export function createTimer(ctx) {
  const { root, recipeId, cleanups, state, current } = ctx;
  // ---- the disc's frame -----------------------------------------------------------------------------------------
  const discSlot = h("div", { class: "tm-timer__disc", id: "tm-disc-slot" });
  const digitsSlot = h("div", { class: "tm-timer__digits", id: "tm-digits-slot" });
  const timerReadout = h("p", { class: "tm-readout", id: "tm-timer-readout", role: "status" });
  const upNote = h("div", { class: "kp-alert kp-alert--info tm-up", id: "tm-timer-up", hidden: true });
  const upText = h("span");
  const upTitle = h("strong");
  upNote.append(h("div", { class: "kp-alert__body" }, upTitle, " ", upText));
  const digitsSwitch = /** @type {HTMLInputElement} */ (h("input", { class: "kp-switch__input", type: "checkbox", role: "switch", id: "tm-digits-switch" }));
  let numbers = false;
  try {
    numbers = localStorage.getItem(DIGITS_KEY) === "on";
  } catch {
    // The choice lasts for this visit only.
  }
  digitsSwitch.checked = numbers;
  if (recipeId) {
    const data = /** @type {HTMLElement} */ ($("#tm-timer-card-data", root));
    data.append(
      h("div", { class: "tm-timer" }, discSlot, digitsSlot),
      timerReadout,
      upNote,
      h(
        "div",
        { class: "kp-formgrid", "data-kp-formgrid-lines": "lines" },
        h(
          "div",
          { class: "kp-formgrid__row" },
          h("label", { class: "kp-formgrid__label", for: "tm-digits-switch" }, h("span", null, t("timing.digits"))),
          h(
            "div",
            { class: "kp-formgrid__control" },
            h("label", { class: "kp-switch" }, digitsSwitch, h("span", { class: "kp-switch__state", "aria-hidden": "true" }), h("span", null, t("timing.digitsShow"))),
          ),
          h("p", { class: "kp-formgrid__value", id: "tm-digits-said" }, t("timing.digitsSaid")),
        ),
      ),
    );
    cleanups.push(attachSwitches(data));
  }
  /** @type {(() => void)[]} */
  let discDetach = [];
  let discStart = 0;
  /** @type {HTMLElement | null} */
  let disc = null;

  function buildDisc() {
    const p = current();
    if (!p) return;
    for (const off of discDetach) off();
    discDetach = [];
    discStart = p.start;
    // A full dial is 60 minutes (Kenny's changed default): a longer wait leaves the disc full until the last hour.
    discSlot.innerHTML = `<div class="kp-timer-disc" data-kp-timer-disc-until="${p.start}" data-kp-timer-disc-timezone="${ZONE}" data-kp-timer-disc-name="${t("timing.discName")}" data-kp-timer-disc-scale="60"></div>`;
    digitsSlot.innerHTML = `<div class="kp-countdown tm-digits" data-kp-countdown-until="${p.start}" data-kp-countdown-timezone="${ZONE}" data-kp-countdown-name="${t("timing.countdownName")}"></div>`;
    disc = /** @type {HTMLElement} */ (discSlot.firstElementChild);
    discDetach.push(attachTimerDiscs(discSlot), attachCountdowns(digitsSlot));
    digitsSlot.hidden = !numbers;
    upNote.hidden = true;
    // The wait is a moment, not a length: both clocks count down to the start by themselves and have no controls.
    disc.addEventListener("kp-countdown-change", drawTimerLine);
    disc.addEventListener("kp-countdown-end", () => {
      const q = current();
      upTitle.textContent = t("timing.itIs", hm(Date.now()));
      upText.textContent = q ? t("timing.firstThen", q.first, startsInWords(q)) : "";
      upNote.hidden = false;
      ctx.view.drawTimerLine();
      ctx.view.drawNudge();
    });
  }

  function drawTimer() {
    const p = current();
    if (!p) return;
    /** @type {HTMLElement} */ ($("#tm-timer-card-body", root)).textContent =
      `${t("timing.dinnerSoStart", state.eat, hm(p.start))} ${p.start > Date.now() ? t("timing.fromNow", words(Math.max(1, Math.round((p.start - Date.now()) / MIN)))) : t("timing.momentCome")}`;
    // The disc is one wait to one moment: it is built again only when that moment moves.
    if (!disc || p.start !== discStart) buildDisc();
    ctx.view.drawTimerLine();
  }

  function drawTimerLine() {
    const p = current();
    if (!p) return;
    const left = Math.round((p.start - Date.now()) / MIN);
    timerReadout.textContent = left > 0 ? t("timing.youStartIn", hm(p.start), words(left)) : t("timing.startCome", hm(p.start));
  }

  digitsSwitch.addEventListener("change", () => {
    numbers = digitsSwitch.checked;
    digitsSlot.hidden = !numbers;
    try {
      localStorage.setItem(DIGITS_KEY, numbers ? "on" : "off");
    } catch {
      // The choice lasts for this visit only.
    }
  });
  return {
    draw: drawTimer,
    drawLine: drawTimerLine,
    detach: () => {
      for (const off of discDetach) off();
    },
  };
}
