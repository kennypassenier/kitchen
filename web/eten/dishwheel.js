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
// Nothing runs on import except one document-level font listener (dishwheel-fit.js, the label fitting and the stop
// without a rewind; split from this file on 30/10/2026 for size, the two files are the one component).

import { attachWheels, spinWheel, WHEEL_SPIN_EVENT, WHEEL_RESULT_EVENT } from "/static/kp/dist/kp-themes.min.js";
import { give, forget, watchShown, monotoneEase } from "./dishwheel-fit.js";

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

/** @param {string | { label: string, tag?: string }} s */
const sideLabel = (s) => (typeof s === "string" ? s : s.label);

/** @param {string} s */
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/** The wheel's reader name: its kicker when it has one, else a label. @param {string | undefined} kicker @param {string} k @param {string | undefined} label */
const named = (kicker, k, label) => (kicker ? `aria-labelledby="${k}"` : `aria-label="${esc(label ?? "")}"`);

/** The wheels' markup: the big wheel, the small one, and the answer column. @param {string} id @param {DishWords} words @param {{ sides: boolean, answer: boolean, kiosk: boolean, cards: boolean }} o */
function markup(id, words, { sides, answer, kiosk, cards }) {
  const wheelAttrs = `data-kp-wheel${kiosk ? " data-kp-wheel-kiosk" : ""}${cards ? " data-kp-wheel-answer" : ""}`;
  return `
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
}

/** @typedef {{ big: HTMLElement, small: HTMLElement | null, words: DishWords, onChange: ((change: DishChange) => void) | undefined, dishes: Map<string, DishItem>, dish: DishItem | null }} WheelState dish is the dish the big wheel stands on */

/** @param {WheelState} s @param {DishChange["phase"]} phase @param {string | null} [side] */
function emit(s, phase, side = null) {
  const list = (s.dish?.sides ?? []).map(sideLabel);
  s.onChange?.({ phase, dish: s.dish, sides: list, side: side ?? (list.length === 1 ? list[0] : null) });
}

/** The small wheel empty, saying why. @param {WheelState} s @param {string | undefined} text */
function clearSide(s, text) {
  if (!s.small) return;
  s.small.setAttribute("data-kp-wheel-empty", text ?? s.words.sideFirst ?? "");
  give(s.small, []);
}

/** The big wheel stopped: the small one is filled with the dish's sides and spins, or says why not. @param {WheelState} s @param {Event} e */
function onResult(s, e) {
  const { words, small } = s;
  const item = /** @type {CustomEvent} */ (e).detail?.item;
  s.dish = s.dishes.get(item?.id) ?? null;
  const dish = s.dish;
  if (!dish) return emit(s, "idle");
  const list = (dish.sides ?? []).map(sideLabel);
  if (!small || list.length < 2) {
    clearSide(s, list.length === 1 ? words.oneSide?.(dish.label, list[0]) : words.nothing?.(dish.label));
    return emit(s, "dish");
  }
  const tag = words.sideTag?.(dish.label);
  give(small, list.map((label, i) => ({ id: String(i), label, ...(tag ? { tag } : {}) })));
  emit(s, "dish");
  void spinWheel(small);
}

/** Listen to both wheels; returns the way to stop. @param {WheelState} s */
function wire(s) {
  const { big, small } = s;
  const onSpin = () => {
    s.dish = null;
    clearSide(s, s.words.sideFirst);
    emit(s, "turning");
  };
  const onBigResult = (/** @type {Event} */ e) => onResult(s, e);
  const onSideSpin = () => emit(s, "side-turning");
  const onSideResult = (/** @type {Event} */ e) => {
    const label = /** @type {CustomEvent} */ (e).detail?.item?.label;
    // A result that comes after the big wheel was spun again is of the old dish: ignored.
    if (!s.dish || typeof label !== "string") return;
    emit(s, "side", label);
  };
  // kp reads the curve right after the spin event: take the overshoot out of it for this spin.
  const ease = (/** @type {Event} */ e) => monotoneEase(/** @type {HTMLElement} */ (e.currentTarget));
  big.addEventListener(WHEEL_SPIN_EVENT, onSpin);
  big.addEventListener(WHEEL_RESULT_EVENT, onBigResult);
  small?.addEventListener(WHEEL_SPIN_EVENT, onSideSpin);
  small?.addEventListener(WHEEL_RESULT_EVENT, onSideResult);
  big.addEventListener(WHEEL_SPIN_EVENT, ease);
  small?.addEventListener(WHEEL_SPIN_EVENT, ease);
  return () => {
    big.removeEventListener(WHEEL_SPIN_EVENT, onSpin);
    big.removeEventListener(WHEEL_RESULT_EVENT, onBigResult);
    big.removeEventListener(WHEEL_SPIN_EVENT, ease);
    small?.removeEventListener(WHEEL_SPIN_EVENT, onSideSpin);
    small?.removeEventListener(WHEEL_RESULT_EVENT, onSideResult);
    small?.removeEventListener(WHEEL_SPIN_EVENT, ease);
  };
}

/**
 * Mount the wheels into `host`.
 * @param {HTMLElement} host
 * @param {DishWheelOptions} [options]
 */
export function mountDishWheel(host, { words = {}, sides = true, answer = true, kiosk = false, cards = false, onChange } = {}) {
  host.classList.add("dw");
  host.toggleAttribute("data-dw-cards", cards);
  host.toggleAttribute("data-dw-single", !sides);
  host.toggleAttribute("data-dw-noanswer", !answer);
  host.innerHTML = markup(`dw${++counter}`, words, { sides, answer, kiosk, cards });
  const big = /** @type {HTMLElement} */ (host.querySelector("[data-dw-dish]"));
  const small = /** @type {HTMLElement | null} */ (host.querySelector("[data-dw-side]"));
  const answerBox = /** @type {HTMLElement | null} */ (host.querySelector("[data-dw-answer]"));
  const stopAttach = attachWheels(host);
  /** @type {WheelState} */
  const s = { big, small, words, onChange, dishes: new Map(), dish: null };
  const unwire = wire(s);
  const watch = watchShown(small ? [big, small] : [big]);
  return {
    big,
    small,
    /** The column beside the wheels; the page fills it. */
    answer: answerBox,
    /** Put these dishes on the big wheel; the small wheel is emptied and nothing is chosen. @param {DishItem[]} items */
    setDishes(items) {
      s.dishes = new Map(items.map((d) => [d.id, d]));
      s.dish = null;
      clearSide(s, words.sideFirst);
      give(big, items.map(({ sides: _sides, ...rest }) => rest));
      emit(s, "idle");
    },
    /** Spin the big wheel, as a press on Spin does. */
    spin: () => spinWheel(big),
    /** Spin the small wheel again for the same dish. */
    spinSide: () => (small ? spinWheel(small) : Promise.resolve(null)),
    destroy() {
      watch.disconnect();
      unwire();
      forget(big);
      if (small) forget(small);
      stopAttach?.();
    },
  };
}
