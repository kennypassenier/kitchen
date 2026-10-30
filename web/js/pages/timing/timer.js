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

/**
 * @typedef {object} TimerParts
 * @property {HTMLElement} discSlot
 * @property {HTMLElement} digitsSlot
 * @property {HTMLElement} readout
 * @property {HTMLElement} upNote
 * @property {HTMLElement} upText
 * @property {HTMLElement} upTitle
 * @property {HTMLInputElement} digitsSwitch
 * @property {boolean} numbers Whether the digits show beside the disc (kept per browser).
 * @property {(() => void)[]} discDetach
 * @property {number} discStart
 * @property {HTMLElement | null} disc
 */

/** Whether the digits were switched on on this browser. */
function readNumbers() {
  try {
    return localStorage.getItem(DIGITS_KEY) === "on";
  } catch {
    // The choice lasts for this visit only.
    return false;
  }
}

/** @param {boolean} numbers */
function saveNumbers(numbers) {
  try {
    localStorage.setItem(DIGITS_KEY, numbers ? "on" : "off");
  } catch {
    // The choice lasts for this visit only.
  }
}

/** @returns {TimerParts} */
function emptyParts() {
  const upNote = h("div", { class: "kp-alert kp-alert--info tm-up", id: "tm-timer-up", hidden: true });
  const upText = h("span");
  const upTitle = h("strong");
  upNote.append(h("div", { class: "kp-alert__body" }, upTitle, " ", upText));
  const digitsSwitch = /** @type {HTMLInputElement} */ (h("input", { class: "kp-switch__input", type: "checkbox", role: "switch", id: "tm-digits-switch" }));
  const numbers = readNumbers();
  digitsSwitch.checked = numbers;
  return {
    discSlot: h("div", { class: "tm-timer__disc", id: "tm-disc-slot" }),
    digitsSlot: h("div", { class: "tm-timer__digits", id: "tm-digits-slot" }),
    readout: h("p", { class: "tm-readout", id: "tm-timer-readout", role: "status" }),
    upNote,
    upText,
    upTitle,
    digitsSwitch,
    numbers,
    discDetach: [],
    discStart: 0,
    disc: null,
  };
}

/** The row with the switch that shows the digits. @param {TimerParts} s */
function digitsRow(s) {
  return h(
    "div",
    { class: "kp-formgrid", "data-kp-formgrid-lines": "lines" },
    h(
      "div",
      { class: "kp-formgrid__row" },
      h("label", { class: "kp-formgrid__label", for: "tm-digits-switch" }, h("span", null, t("timing.digits"))),
      h("div", { class: "kp-formgrid__control" }, h("label", { class: "kp-switch" }, s.digitsSwitch, h("span", { class: "kp-switch__state", "aria-hidden": "true" }), h("span", null, t("timing.digitsShow")))),
      h("p", { class: "kp-formgrid__value", id: "tm-digits-said" }, t("timing.digitsSaid")),
    ),
  );
}

/** The disc is built again only when the moment it counts to moves; the clocks have no controls. @param {import("./index.js").TimingCtx} ctx @param {TimerParts} s */
function buildDisc(ctx, s) {
  const p = ctx.current();
  if (!p) return;
  for (const off of s.discDetach) off();
  s.discDetach = [];
  s.discStart = p.start;
  // A full dial is 60 minutes (Kenny's changed default): a longer wait leaves the disc full until the last hour.
  s.discSlot.innerHTML = `<div class="kp-timer-disc" data-kp-timer-disc-until="${p.start}" data-kp-timer-disc-timezone="${ZONE}" data-kp-timer-disc-name="${t("timing.discName")}" data-kp-timer-disc-scale="60"></div>`;
  s.digitsSlot.innerHTML = `<div class="kp-countdown tm-digits" data-kp-countdown-until="${p.start}" data-kp-countdown-timezone="${ZONE}" data-kp-countdown-name="${t("timing.countdownName")}"></div>`;
  const disc = /** @type {HTMLElement} */ (s.discSlot.firstElementChild);
  s.disc = disc;
  s.discDetach.push(attachTimerDiscs(s.discSlot), attachCountdowns(s.digitsSlot));
  s.digitsSlot.hidden = !s.numbers;
  s.upNote.hidden = true;
  // The wait is a moment, not a length: both clocks count down to the start by themselves and have no controls.
  disc.addEventListener("kp-countdown-change", () => drawTimerLine(ctx, s));
  disc.addEventListener("kp-countdown-end", () => {
    const q = ctx.current();
    s.upTitle.textContent = t("timing.itIs", hm(Date.now()));
    s.upText.textContent = q ? t("timing.firstThen", q.first, startsInWords(q)) : "";
    s.upNote.hidden = false;
    ctx.view.drawTimerLine();
    ctx.view.drawNudge();
  });
}

/** @param {import("./index.js").TimingCtx} ctx @param {TimerParts} s */
function drawTimer(ctx, s) {
  const p = ctx.current();
  if (!p) return;
  /** @type {HTMLElement} */ ($("#tm-timer-card-body", ctx.root)).textContent =
    `${t("timing.dinnerSoStart", ctx.state.eat, hm(p.start))} ${p.start > Date.now() ? t("timing.fromNow", words(Math.max(1, Math.round((p.start - Date.now()) / MIN)))) : t("timing.momentCome")}`;
  // The disc is one wait to one moment: it is built again only when that moment moves.
  if (!s.disc || p.start !== s.discStart) buildDisc(ctx, s);
  ctx.view.drawTimerLine();
}

/** @param {import("./index.js").TimingCtx} ctx @param {TimerParts} s */
function drawTimerLine(ctx, s) {
  const p = ctx.current();
  if (!p) return;
  const left = Math.round((p.start - Date.now()) / MIN);
  s.readout.textContent = left > 0 ? t("timing.youStartIn", hm(p.start), words(left)) : t("timing.startCome", hm(p.start));
}

/** @param {import("./index.js").TimingCtx} ctx */
export function createTimer(ctx) {
  const s = emptyParts();
  if (ctx.recipeId) {
    const data = /** @type {HTMLElement} */ ($("#tm-timer-card-data", ctx.root));
    data.append(h("div", { class: "tm-timer" }, s.discSlot, s.digitsSlot), s.readout, s.upNote, digitsRow(s));
    ctx.cleanups.push(attachSwitches(data));
  }
  s.digitsSwitch.addEventListener("change", () => {
    s.numbers = s.digitsSwitch.checked;
    s.digitsSlot.hidden = !s.numbers;
    saveNumbers(s.numbers);
  });
  return {
    draw: () => drawTimer(ctx, s),
    drawLine: () => drawTimerLine(ctx, s),
    detach: () => {
      for (const off of s.discDetach) off();
    },
  };
}
