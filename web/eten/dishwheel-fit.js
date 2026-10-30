// Drawing a wheel's labels right: the redraw when the wheel becomes measurable or a font has loaded, and a stop without
// a rewind. Part of the one wheel component (dishwheel.js; scripts/check-wheels.mjs lets both files drive kp's wheel).
// Nothing runs on import except one document-level font listener.

import { setWheelItems } from "/static/kp/js/wheel.js";

/** The last items given to a wheel element, for the redraw. @type {WeakMap<HTMLElement, object[]>} */
const LAST = new WeakMap();
/** Wheels that want a redraw once their text can be measured. @type {Set<HTMLElement>} */
const LIVE = new Set();

/** @param {HTMLElement} el */
const measurable = (el) => el.isConnected && el.getBoundingClientRect().width > 0;

/**
 * Draw the wheel's current items again, so every label is fitted with the face that is on the page now. Not while it
 * turns, and not once it has an outcome (setWheelItems would clear that). The glide kp plays for a changed set of
 * items would draw the labels by an estimate for a moment; the same items need no glide, so calm is switched on for the
 * one synchronous call that decides it (kp reads it at the start of the call) and put back at once.
 * @param {HTMLElement} el
 */
export function refit(el) {
  if (!el.isConnected) {
    LIVE.delete(el);
    return;
  }
  const items = LAST.get(el);
  if (!items?.length || !measurable(el) || el.hasAttribute("data-kp-wheel-spinning") || el.hasAttribute("data-kp-wheel-won")) return;
  const root = document.documentElement;
  const calm = root.hasAttribute("data-kp-calm");
  if (!calm) root.setAttribute("data-kp-calm", "");
  try {
    setWheelItems(el, items);
  } finally {
    if (!calm) root.removeAttribute("data-kp-calm");
  }
}

// A theme's web font can start loading after the first paint (kp's own redraw on `document.fonts.ready` may already be
// over by then) and a theme switch brings another face: every wheel is drawn again when a font has loaded.
document.fonts?.addEventListener("loadingdone", () => {
  LIVE.forEach(refit);
});

/**
 * The theme's own curve with the overshoot taken out. kp turns the disc along `--kp-wheel-ease`; a curve that passes 1
 * (pastel's "land" reaches 1.08) turns the disc past its stop and back, which reads as the wheel rewinding. The same
 * curve divided by its highest point and never falling keeps the theme's feel and ends the turn on the stop. Curves
 * that stay between 0 and 1 are left alone.
 * @param {HTMLElement} el
 */
export function monotoneEase(el) {
  el.style.removeProperty("--kp-wheel-ease");
  const raw = getComputedStyle(el).getPropertyValue("--kp-wheel-ease").trim();
  if (!raw) return;
  /** @type {Animation} */
  let probe;
  try {
    probe = document.createElement("i").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1000, easing: raw, fill: "both" });
  } catch {
    return;
  }
  probe.pause();
  const steps = 100;
  /** @type {number[]} */
  const ys = [];
  let bad = false;
  let top = 0;
  let prev = 0;
  for (let i = 0; i <= steps; i++) {
    probe.currentTime = (i * 1000) / steps;
    const p = Number(probe.effect?.getComputedTiming().progress ?? i / steps);
    if (p > 1.0001 || p < prev - 0.0001) bad = true;
    prev = Math.max(prev, p);
    top = Math.max(top, p);
    ys.push(p);
  }
  probe.cancel();
  if (!bad || top <= 0) return;
  let run = 0;
  const points = ys.map((y) => {
    run = Math.max(run, y / top);
    return run.toFixed(4);
  });
  points[steps] = "1";
  el.style.setProperty("--kp-wheel-ease", `linear(${points.join(", ")})`);
}

/** Give a wheel its items, and have them drawn again once the fonts and the layout are in. @param {HTMLElement} el @param {object[]} items */
export function give(el, items) {
  LAST.set(el, items);
  LIVE.add(el);
  setWheelItems(el, items);
  // Once the fonts that are loading now are in, and once the wheel is on screen and measurable.
  void document.fonts?.ready.then(() => refit(el));
}

/** The wheel is gone: it needs no redraw any more. @param {HTMLElement} el */
export function forget(el) {
  LIVE.delete(el);
}

/** A wheel that was hidden while it was drawn (a card still loading) is drawn again when it is shown. @param {HTMLElement[]} els @returns {ResizeObserver} */
export function watchShown(els) {
  /** @type {Map<HTMLElement, number>} */
  const seen = new Map();
  const watch = new ResizeObserver((entries) => {
    for (const { target } of entries) {
      const el = /** @type {HTMLElement} */ (target);
      const width = el.getBoundingClientRect().width;
      if (width > 0 && seen.get(el) === 0) refit(el);
      seen.set(el, width);
    }
  });
  for (const el of els) watch.observe(el);
  return watch;
}
