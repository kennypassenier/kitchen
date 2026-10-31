// The parents' wheel, one module for both languages (Kenny, 22/10/2026).
//
// The Dutch page on eten.kp-soft.dev (web/eten/eten.js, no login) and Kitchen's own English page (/parents) both mount
// this. The data comes ready from the server (src/parents.rs `wheel`): the dishes with a name in the page's language,
// each with its category and its sides, every name already in that language.
//
// The big wheel picks a dish. The small wheel picks one of the dish's sides (Kenny, 24/10/2026 05:26: a side is one
// or more ingredients that go together, "Frieten en mayonaise", "Kroketten"), when there are two or more; a dish
// with one side simply comes with it. The dish's fixed ingredients (salad, …) always come with it and are not spun.
// The sentence under the wheels says the whole dinner. A tap on the small wheel picks the side again. The
// categories, when there are two or more, narrow the big wheel.
//
// The wheels, their layout and the side wheel's rule are the one wheel component (web/eten/dishwheel.js, Kenny,
// 24/10/2026 10:27); this module only gives it the dishes and says the dinner in the answer column beside the wheels.
// The card's loading, empty and failed states are js/card-state.js. Nothing is stored: the spin is the whole of it.

import { mountDishWheel } from "./dishwheel.js";
import { attachCardStates, setCardState, CARD_RETRY_EVENT, attachSegmented, setSegmentedCounts, getSegmentedValues, SEGMENTED_EVENT, attachArt } from "/static/kp/dist/kp-themes.min.js";
import { WORDS } from "./words.js";

export { WORDS };

/** @typedef {{ name: string, ingredients: string[] }} Side */
/** @typedef {{ id: string, name: string, category: string | null, ingredients: string[], sides: Side[] }} Dish */
/** @typedef {{ id: string, name: string, count: number }} Category */
/** @typedef {{ lang: string, dishes: Dish[], categories: Category[] }} WheelData */

/** The entries of the small wheel: the dish's sides by name. @param {Dish} d */
const choices = (d) => (d.sides ?? []).map((s) => s.name);
/** The small wheel spins only when there is a real choice. @param {Dish} d */
const spins = (d) => choices(d).length > 1;
/** The short line about a dish on the wheel. @param {typeof WORDS["nl"]} w @param {Dish} d */
const tagOf = (w, d) => (spins(d) ? w.tagChoice(choices(d)) : w.tagSame);

/** @param {string} s */
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/** The page's card, the wheels, and the answer column; returns the nodes the behaviour needs. @param {HTMLElement} root @param {typeof WORDS["nl"]} w */
function buildPage(root, w) {
  root.innerHTML = `
    <div class="pr-page">
      <section class="kp-card dw-card pr-card" data-kp-state="loading" aria-labelledby="pr-card-t" data-kp-loading-words="${esc(w.loading)}">
        <div class="kp-card__header">
          <h1 class="kp-card__title" id="pr-card-t">${esc(w.cardTitle)}</h1>
          <div class="kp-card__actions"><span class="kp-badge" data-pr-count></span></div>
        </div>
        <p class="kp-card__body">${esc(w.cardText)}</p>
        <div class="kp-card__stage">
          <div class="kp-card__data">
            <div class="pr-stage">
              <div class="pr-filter" data-pr-filter></div>
              <div data-pr-wheels></div>
            </div>
          </div>
        </div>
      </section>
    </div>`;
  return {
    card: /** @type {HTMLElement} */ (root.querySelector(".pr-card")),
    count: /** @type {HTMLElement} */ (root.querySelector("[data-pr-count]")),
    filterBox: /** @type {HTMLElement} */ (root.querySelector("[data-pr-filter]")),
    wheelsHost: /** @type {HTMLElement} */ (root.querySelector("[data-pr-wheels]")),
  };
}

/** @typedef {{ w: typeof WORDS["nl"], el: ReturnType<typeof buildPage>, wheels: ReturnType<typeof mountDishWheel>, tonight: HTMLElement, hint: HTMLElement, emptyAction: (() => HTMLElement[]) | undefined, undo: Array<() => void>, data: WheelData | null, status: "loading" | "error" | "ready", failure: string, filter: string }} PageState */

/** What the wheels chose, said as one dinner in the answer column. @param {PageState} s @param {import("./dishwheel.js").DishChange} change */
function say(s, change) {
  const { w, tonight, hint } = s;
  const d = change.dish ? (s.data?.dishes.find((x) => x.id === change.dish?.id) ?? null) : null;
  if (change.phase === "turning" || (d && spins(d) && !change.side)) {
    tonight.textContent = w.turning;
    hint.textContent = d ? tagOf(w, d) : "";
    return;
  }
  if (!d) {
    tonight.textContent = w.idle;
    hint.textContent = "";
    return;
  }
  // The fixed ingredients (the dish's own name left out: "Stoofvlees, met stoofvlees" says it twice), then the side
  // the small wheel picked, or the only one.
  const fixed = (d.ingredients ?? []).filter((n) => n.toLowerCase() !== d.name.toLowerCase());
  tonight.textContent = w.tonight(d.name, [...fixed, ...(change.side ? [change.side] : [])]);
  hint.textContent = tagOf(w, d);
}

/** The empty and failed notes carry the package's drawing. @param {PageState} s */
function drawArt(s) {
  const box = s.el.card.querySelector(".kp-card__empty:not([data-kp-art]), .kp-card__failure:not([data-kp-art])");
  if (!box) return;
  box.setAttribute("data-kp-art", box.classList.contains("kp-card__failure") ? "error" : "nomatch");
  s.undo.push(attachArt(s.el.card));
}

/** The dishes on the big wheel, after the filter. @param {PageState} s */
function fillBig(s) {
  const list = (s.data?.dishes ?? []).filter((d) => !s.filter || d.category === s.filter);
  s.el.count.textContent = s.w.count(list.length);
  s.wheels.setDishes(list.map((d) => ({ id: d.id, label: d.name, tag: tagOf(s.w, d), sides: choices(d) })));
}

/** The categories as one row of choices; with fewer than two there is nothing to narrow and the row stays empty. @param {PageState} s */
function drawFilter(s) {
  const { filterBox } = s.el;
  const cats = s.data?.categories ?? [];
  if (cats.length < 2) {
    filterBox.replaceChildren();
    return;
  }
  const item = (/** @type {string} */ value, /** @type {string} */ label) =>
    `<button type="button" class="kp-segmented__item" role="radio" aria-checked="${value === s.filter}" data-value="${esc(value)}"><span class="kp-segmented__label">${esc(label)}</span><span class="kp-segmented__count"></span></button>`;
  filterBox.innerHTML = `<div class="kp-segmented kp-segmented--chips" data-kp-segmented="single" role="radiogroup" aria-label="${esc(s.w.filterLabel)}">${item("", s.w.all)}${cats.map((c) => item(c.id, c.name)).join("")}</div>`;
  const group = /** @type {HTMLElement} */ (filterBox.firstElementChild);
  s.undo.push(attachSegmented(group));
  setSegmentedCounts(group, { "": s.data?.dishes.length ?? 0, ...Object.fromEntries(cats.map((c) => [c.id, c.count])) });
  group.addEventListener(SEGMENTED_EVENT, () => {
    const next = getSegmentedValues(group)[0] ?? "";
    if (next === s.filter) return;
    s.filter = next;
    fillBig(s);
  });
}

/** The card in the state the data is in. @param {PageState} s */
function draw(s) {
  const { w, el } = s;
  if (s.status === "loading") {
    el.count.textContent = "";
    setCardState(el.card, "loading", { words: w.loading });
    return;
  }
  if (s.status === "error") {
    el.count.textContent = "";
    setCardState(el.card, "error", { title: w.failedTitle, text: s.failure });
    drawArt(s);
    return;
  }
  if (!s.data?.dishes.length) {
    el.count.textContent = w.count(0);
    setCardState(el.card, "empty", { title: w.emptyTitle, text: w.emptyText, action: s.emptyAction?.() });
    drawArt(s);
    return;
  }
  if (s.filter && !s.data.categories.some((c) => c.id === s.filter)) s.filter = "";
  drawFilter(s);
  fillBig(s);
  setCardState(el.card, "ready");
}

/** @param {PageState} s @param {(force: boolean) => Promise<WheelData>} load @param {boolean} [force] */
function read(s, load, force = false) {
  if (force) {
    s.status = "loading";
    draw(s);
  }
  load(force).then(
    (d) => {
      s.data = d;
      s.status = "ready";
      draw(s);
    },
    (/** @type {Error} */ e) => {
      s.status = "error";
      s.failure = e.message;
      draw(s);
    },
  );
}

/**
 * Mount the wheel page into `root`.
 * @param {HTMLElement} root
 * @param {{ lang: "nl" | "en", load: (force: boolean) => Promise<WheelData>, emptyAction?: () => HTMLElement[] }} opts
 * @returns {() => void} cleanup
 */
export function mountWheel(root, { lang, load, emptyAction }) {
  const w = WORDS[lang];
  const el = buildPage(root, w);
  /** @type {PageState} */
  const s = { w, el, wheels: /** @type {any} */ (null), tonight: /** @type {any} */ (null), hint: /** @type {any} */ (null), emptyAction, undo: [], data: null, status: "loading", failure: "", filter: "" };
  s.wheels = mountDishWheel(el.wheelsHost, {
    kiosk: true,
    words: { dishKicker: w.dishKicker, sideKicker: w.sideKicker, sideFirst: w.sideFirst, nothing: w.nothing, sideTag: w.tagWith },
    onChange: (change) => say(s, change),
  });
  // The answer column: what the wheels chose, said as one dinner.
  const answerBox = /** @type {HTMLElement} */ (s.wheels.answer);
  answerBox.innerHTML = `<p class="pr-kicker">${esc(w.answerKicker)}</p><p class="pr-tonight" data-pr-tonight aria-live="polite"></p><p class="pr-hint" data-pr-hint></p>`;
  s.tonight = /** @type {HTMLElement} */ (answerBox.querySelector("[data-pr-tonight]"));
  s.hint = /** @type {HTMLElement} */ (answerBox.querySelector("[data-pr-hint]"));
  s.hint.textContent = "";
  s.tonight.textContent = w.idle;
  s.undo.push(attachCardStates(el.card), () => s.wheels.destroy());
  const retry = () => read(s, load, true);
  el.card.addEventListener(CARD_RETRY_EVENT, retry);
  s.undo.push(() => el.card.removeEventListener(CARD_RETRY_EVENT, retry));
  draw(s);
  read(s, load);
  return () => {
    for (const fn of s.undo.reverse()) fn();
  };
}
