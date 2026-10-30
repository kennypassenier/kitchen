// The one wheel component of Kitchen (Kenny, 24/10/2026 10:27: "the wheel must work the same everywhere, one fixed
// component so there is no difference"). The parents' page on eten.kp-soft.dev, Kitchen's /parents, the main "What do
// we eat?" page and an ingredient page all mount THIS and nothing else; pages only hand over data and options. The
// static check scripts/check-wheels.mjs fails when any other file imports kp's wheel module or calls
// setWheelItems/spinWheel itself.
//
// It owns:
//   - the layout (web/eten/dishwheel.css): the big dish wheel, the small side wheel right next to it with both
//     bottoms on one line, and an answer column beside them that the page fills; on a phone they stack;
//   - the side wheel's rule: it turns only after the big wheel has STOPPED on a dish with two or more sides; while the
//     big wheel turns the small one is idle and empty; one side is named, none is "nothing to choose"; a new spin of
//     the big wheel resets the small one at once;
//   - labels fitted from the first paint (see `refit`): kp fits a label by measuring its text, which is wrong while the
//     wheel is hidden (a card that is still loading) or before the theme's web font is in; the component draws the
//     same items again when the wheel is shown and when the fonts have loaded, never while it turns;
//   - a stop without a rewind (see `monotoneEase`): a theme's curve that overshoots (pastel's "land") would turn the
//     disc past its stop and back; the component hands kp the same curve with the overshoot taken out;
//   - the hub's size (a smaller hub so a label never touches it);
//   - upright names: Kitchen turned every label on the left half by 180 degrees itself (Kenny, 24/10/2026 11:40: "every name
//     must read upright wherever its slice sits"); kp-themes 11.3.0 does it (the flip follows the slice's place on screen
//     after a spin), so that workaround is gone (30/10/2026).
//
// It imports nothing from web/js (no api.js, no i18n): /eten must load without the app. The words come in as options.
// Nothing runs on import except one document-level font listener.

import { attachWheels, setWheelItems, spinWheel, WHEEL_SPIN_EVENT, WHEEL_RESULT_EVENT } from "/static/kp/js/wheel.js";

/**
 * @typedef {object} DishItem one dish on the big wheel
 * @property {string} id @property {string} label the name drawn on the slice @property {string} [short] a shorter name for thin slices
 * @property {number} [weight] @property {string} [tag] @property {boolean} [resting]
 * @property {Array<string | { label: string, tag?: string }>} [sides] what the small wheel picks from (names)
 */

/**
 * @typedef {object} DishWords every word the component shows or says; the caller owns the language
 * @property {string} [dishKicker] the line over the big wheel @property {string} [sideKicker] the line over the small wheel
 * @property {string} [dishLabel] the big wheel's name for a reader when there is no kicker
 * @property {string} [dishEmpty] said when the big wheel has no dish
 * @property {string} [sideFirst] said by the idle small wheel: spin the big wheel first
 * @property {(dish: string) => string} [nothing] the dish has no side to choose
 * @property {(dish: string, side: string) => string} [oneSide] the dish comes with one side
 * @property {(dish: string) => string} [sideTag] a short line on each side's slice
 */

/**
 * @typedef {object} DishChange what happened on the wheels, for the page's answer column
 * @property {"idle" | "turning" | "dish" | "side-turning" | "side"} phase
 *   idle: dishes (re)set, nothing chosen; turning: the big wheel turns; dish: the big wheel stopped; side-turning: the small
 *   wheel turns; side: the small wheel stopped
 * @property {DishItem | null} dish @property {string[]} sides the dish's sides @property {string | null} side the side chosen, or the only one
 */

/**
 * @typedef {object} DishWheelOptions
 * @property {DishWords} [words]
 * @property {boolean} [sides] a small side wheel next to the big one (default true)
 * @property {boolean} [answer] the answer column beside the wheels, for the page to fill (default true)
 * @property {boolean} [kiosk] no hub buttons: a tap on a wheel spins it (default false)
 * @property {boolean} [cards] kp's own answer card under each wheel instead of the page's answer column (default false)
 * @property {(change: DishChange) => void} [onChange]
 */

let counter = 0;
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
function refit(el) {
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
function monotoneEase(el) {
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

/** @param {string | { label: string, tag?: string }} s */
const sideLabel = (s) => (typeof s === "string" ? s : s.label);

/**
 * Mount the wheels into `host`.
 * @param {HTMLElement} host
 * @param {DishWheelOptions} [options]
 */
export function mountDishWheel(host, { words = {}, sides = true, answer = true, kiosk = false, cards = false, onChange } = {}) {
  const id = `dw${++counter}`;
  const wheelAttrs = `data-kp-wheel${kiosk ? " data-kp-wheel-kiosk" : ""}${cards ? " data-kp-wheel-answer" : ""}`;
  const esc = (/** @type {string} */ s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
  const named = (/** @type {string | undefined} */ kicker, /** @type {string} */ k, /** @type {string | undefined} */ label) =>
    kicker ? `aria-labelledby="${k}"` : `aria-label="${esc(label ?? "")}"`;
  host.classList.add("dw");
  host.toggleAttribute("data-dw-cards", cards);
  host.toggleAttribute("data-dw-single", !sides);
  host.toggleAttribute("data-dw-noanswer", !answer);
  host.innerHTML = `
    <div class="dw__wheels">
    <div class="dw__wheel dw__wheel--dish">
      ${words.dishKicker ? `<p class="dw__kicker" id="${id}-dk">${esc(words.dishKicker)}</p>` : ""}
      <div class="kp-wheel" data-dw-dish ${wheelAttrs} ${words.dishEmpty ? `data-kp-wheel-empty="${esc(words.dishEmpty)}"` : ""} ${named(words.dishKicker, `${id}-dk`, words.dishLabel)}></div>
    </div>
    ${
      sides
        ? `<div class="dw__wheel dw__wheel--side">
      ${words.sideKicker ? `<p class="dw__kicker" id="${id}-sk">${esc(words.sideKicker)}</p>` : ""}
      <div class="kp-wheel" data-dw-side ${wheelAttrs} data-kp-wheel-empty="${esc(words.sideFirst ?? "")}" ${named(words.sideKicker, `${id}-sk`, words.sideKicker)}></div>
    </div>`
        : ""
    }
    </div>
    ${answer ? '<div class="dw__answer" data-dw-answer></div>' : ""}`;
  const big = /** @type {HTMLElement} */ (host.querySelector("[data-dw-dish]"));
  const small = /** @type {HTMLElement | null} */ (host.querySelector("[data-dw-side]"));
  const answerBox = /** @type {HTMLElement | null} */ (host.querySelector("[data-dw-answer]"));
  const stopAttach = attachWheels(host);

  /** @type {Map<string, DishItem>} */
  let dishes = new Map();
  /** @type {DishItem | null} the dish the big wheel stands on */
  let dish = null;
  /** @param {HTMLElement} el @param {object[]} items */
  const give = (el, items) => {
    LAST.set(el, items);
    LIVE.add(el);
    setWheelItems(el, items);
    // Once the fonts that are loading now are in, and once the wheel is on screen and measurable.
    void document.fonts?.ready.then(() => refit(el));
  };
  const emit = (/** @type {DishChange["phase"]} */ phase, /** @type {string | null} */ side = null) => {
    const list = (dish?.sides ?? []).map(sideLabel);
    onChange?.({ phase, dish, sides: list, side: side ?? (list.length === 1 ? list[0] : null) });
  };
  /** The small wheel empty, saying why. @param {string | undefined} text */
  const clearSide = (text) => {
    if (!small) return;
    small.setAttribute("data-kp-wheel-empty", text ?? words.sideFirst ?? "");
    give(small, []);
  };

  const onSpin = () => {
    dish = null;
    clearSide(words.sideFirst);
    emit("turning");
  };
  const onResult = (/** @type {Event} */ e) => {
    const item = /** @type {CustomEvent} */ (e).detail?.item;
    dish = dishes.get(item?.id) ?? null;
    if (!dish) return emit("idle");
    const list = (dish.sides ?? []).map(sideLabel);
    if (!small || list.length < 2) {
      clearSide(list.length === 1 ? words.oneSide?.(dish.label, list[0]) : words.nothing?.(dish.label));
      return emit("dish");
    }
    const tag = words.sideTag?.(dish.label);
    give(small, list.map((label, i) => ({ id: String(i), label, ...(tag ? { tag } : {}) })));
    emit("dish");
    void spinWheel(small);
  };
  const onSideSpin = () => emit("side-turning");
  const onSideResult = (/** @type {Event} */ e) => {
    const label = /** @type {CustomEvent} */ (e).detail?.item?.label;
    // A result that comes after the big wheel was spun again is of the old dish: ignored.
    if (!dish || typeof label !== "string") return;
    emit("side", label);
  };
  big.addEventListener(WHEEL_SPIN_EVENT, onSpin);
  big.addEventListener(WHEEL_RESULT_EVENT, onResult);
  small?.addEventListener(WHEEL_SPIN_EVENT, onSideSpin);
  small?.addEventListener(WHEEL_RESULT_EVENT, onSideResult);
  // kp reads the curve right after the spin event: take the overshoot out of it for this spin.
  const ease = (/** @type {Event} */ e) => monotoneEase(/** @type {HTMLElement} */ (e.currentTarget));
  big.addEventListener(WHEEL_SPIN_EVENT, ease);
  small?.addEventListener(WHEEL_SPIN_EVENT, ease);
  // A wheel that was hidden while it was drawn (a card still loading) is drawn again when it is shown.
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
  watch.observe(big);
  if (small) watch.observe(small);
  return {
    big,
    small,
    /** The column beside the wheels; the page fills it. */
    answer: answerBox,
    /** Put these dishes on the big wheel; the small wheel is emptied and nothing is chosen. @param {DishItem[]} items */
    setDishes(items) {
      dishes = new Map(items.map((d) => [d.id, d]));
      dish = null;
      clearSide(words.sideFirst);
      give(big, items.map(({ sides: _sides, ...rest }) => rest));
      emit("idle");
    },
    /** Spin the big wheel, as a press on Spin does. */
    spin: () => spinWheel(big),
    /** Spin the small wheel again for the same dish. */
    spinSide: () => (small ? spinWheel(small) : Promise.resolve(null)),
    destroy() {
      watch.disconnect();
      big.removeEventListener(WHEEL_SPIN_EVENT, onSpin);
      big.removeEventListener(WHEEL_RESULT_EVENT, onResult);
      big.removeEventListener(WHEEL_SPIN_EVENT, ease);
      small?.removeEventListener(WHEEL_SPIN_EVENT, onSideSpin);
      small?.removeEventListener(WHEEL_RESULT_EVENT, onSideResult);
      small?.removeEventListener(WHEEL_SPIN_EVENT, ease);
      LIVE.delete(big);
      if (small) LIVE.delete(small);
      stopAttach?.();
    },
  };
}
