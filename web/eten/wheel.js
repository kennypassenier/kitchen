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
// Both wheels are the package's kiosk wheel with its answer card (js/wheel.js); the card's loading, empty and failed
// states are js/card-state.js. Nothing is stored: the spin is the whole of it.

import { attachWheels, setWheelItems, spinWheel, WHEEL_SPIN_EVENT, WHEEL_RESULT_EVENT } from "/static/kp/js/wheel.js";
import { attachCardStates, setCardState, CARD_RETRY_EVENT } from "/static/kp/js/card-state.js";
import { attachSegmented, setSegmentedCounts, getSegmentedValues, SEGMENTED_EVENT } from "/static/kp/js/segmented.js";
import { attachArt } from "/static/kp/js/art.js";

/** @typedef {{ name: string, ingredients: string[] }} Side */
/** @typedef {{ id: string, name: string, category: string | null, ingredients: string[], sides: Side[] }} Dish */
/** @typedef {{ id: string, name: string, count: number }} Category */
/** @typedef {{ lang: string, dishes: Dish[], categories: Category[] }} WheelData */

/** @param {string[]} list @param {string} and */
const join = (list, and) => (list.length < 2 ? list.join("") : `${list.slice(0, -1).join(", ")} ${and} ${list.at(-1)}`);
/** A choice inside a sentence: "met frieten", never "met Frieten". @param {string} s */
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

export const WORDS = {
  nl: {
    pageTitle: "Wat eten we vanavond?",
    pageText: "Tik op het grote wiel en het kiest een gerecht. Hoort er een keuze bij, zoals frieten of puree, dan kiest het kleine wiel mee.",
    cardTitle: "Het eten van vanavond",
    cardText: "Tik op een wiel om het te laten kiezen. Een tik op het kleine wiel kiest opnieuw voor hetzelfde gerecht.",
    dishKicker: "Het gerecht",
    sideKicker: "Het bijgerecht",
    filterLabel: "Soort eten",
    all: "Alles",
    loading: "De gerechten worden gelezen",
    failedTitle: "De gerechten konden niet gelezen worden",
    emptyTitle: "Er staat nog geen gerecht op dit wiel",
    emptyText: "Kenny zet gerechten op dit wiel vanuit Kitchen; daarna staan ze hier.",
    count: (/** @type {number} */ n) => `${n} ${n === 1 ? "gerecht" : "gerechten"}`,
    sideFirst: "Draai eerst het grote wiel; dan kiest dit wiel het bijgerecht.",
    nothing: (/** @type {string} */ dish) => `${dish}: hier valt niets te kiezen.`,
    tagChoice: (/** @type {string[]} */ sides) => `Met een keuze: ${join(sides.map(lower), "of")}`,
    tagSame: "Altijd op dezelfde manier",
    tagWith: (/** @type {string} */ dish) => `Bij ${dish}`,
    idle: "Tik op het grote wiel; het kiest het eten en het kleine wiel het bijgerecht.",
    turning: "De wielen draaien…",
    tonight: (/** @type {string} */ dish, /** @type {string[]} */ withs) => (withs.length ? `Vanavond: ${dish}, met ${join(withs.map(lower), "en")}.` : `Vanavond: ${dish}.`),
  },
  en: {
    pageTitle: "Parents' wheel",
    pageText: "The wheel Kenny's parents see on eten.kp-soft.dev, in English. Tap the big wheel and it picks a dish; when the dish comes with a choice, such as fries or mash, the small wheel picks along.",
    cardTitle: "Tonight's dinner",
    cardText: "Tap a wheel to let it choose. A tap on the small wheel picks again for the same dish.",
    dishKicker: "The dish",
    sideKicker: "The side",
    filterLabel: "Kind of food",
    all: "All",
    loading: "Reading the dishes",
    failedTitle: "The dishes could not be read",
    emptyTitle: "No dish is on this wheel yet",
    emptyText: "Open the dishes, add one with a Dutch and an English name and switch on “On the parents' wheel”.",
    count: (/** @type {number} */ n) => `${n} ${n === 1 ? "dish" : "dishes"}`,
    sideFirst: "Spin the big wheel first; then this wheel picks the side.",
    nothing: (/** @type {string} */ dish) => `${dish}: nothing to choose here.`,
    tagChoice: (/** @type {string[]} */ sides) => `With a choice of ${join(sides.map(lower), "or")}`,
    tagSame: "Always the same way",
    tagWith: (/** @type {string} */ dish) => `With ${dish}`,
    idle: "Tap the big wheel; it picks the dish and the small wheel the side.",
    turning: "The wheels are turning…",
    tonight: (/** @type {string} */ dish, /** @type {string[]} */ withs) => (withs.length ? `Tonight: ${dish}, with ${join(withs.map(lower), "and")}.` : `Tonight: ${dish}.`),
  },
};

/** The entries of the small wheel: the dish's sides by name. @param {Dish} d */
const choices = (d) => (d.sides ?? []).map((s) => s.name);
/** The small wheel spins only when there is a real choice. @param {Dish} d */
const spins = (d) => choices(d).length > 1;

/** @param {string} s */
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/**
 * Mount the wheel page into `root`.
 * @param {HTMLElement} root
 * @param {{ lang: "nl" | "en", load: (force: boolean) => Promise<WheelData>, emptyAction?: () => HTMLElement[] }} opts
 * @returns {() => void} cleanup
 */
export function mountWheel(root, { lang, load, emptyAction }) {
  const w = WORDS[lang];
  /** @type {WheelData | null} */
  let data = null;
  /** @type {"loading" | "error" | "ready"} */
  let status = "loading";
  let failure = "";
  let filter = "";
  /** @type {Dish | null} the dish the big wheel stands on */
  let dish = null;
  /** @type {string | null} the side the small wheel landed on */
  let pick = null;
  /** @type {Array<() => void>} */
  const undo = [];

  root.innerHTML = `
    <div class="pr-page">
      <header class="kp-page-header">
        <div class="kp-page-header__inner">
          <div>
            <h1 class="kp-page-header__title">${esc(w.pageTitle)}</h1>
            <p class="kp-page-header__description">${esc(w.pageText)}</p>
          </div>
        </div>
      </header>
      <section class="kp-card pr-card" data-kp-state="loading" aria-labelledby="pr-card-t" data-kp-loading-words="${esc(w.loading)}">
        <div class="kp-card__header">
          <h2 class="kp-card__title" id="pr-card-t">${esc(w.cardTitle)}</h2>
          <div class="kp-card__actions"><span class="kp-badge" data-pr-count></span></div>
        </div>
        <p class="kp-card__body">${esc(w.cardText)}</p>
        <div class="kp-card__stage">
          <div class="kp-card__data">
            <div class="pr-stage">
              <div class="pr-filter" data-pr-filter></div>
              <div class="pr-wheels">
                <div class="pr-wheel pr-wheel--dish">
                  <p class="pr-wheel__kicker" id="pr-dish-k">${esc(w.dishKicker)}</p>
                  <div class="kp-wheel" data-pr-dish data-kp-wheel data-kp-wheel-kiosk data-kp-wheel-answer aria-labelledby="pr-dish-k"></div>
                </div>
                <div class="pr-wheel pr-wheel--side">
                  <p class="pr-wheel__kicker" id="pr-side-k">${esc(w.sideKicker)}</p>
                  <div class="kp-wheel" data-pr-side data-kp-wheel data-kp-wheel-kiosk data-kp-wheel-answer data-kp-wheel-empty="${esc(w.sideFirst)}" aria-labelledby="pr-side-k"></div>
                </div>
              </div>
              <p class="pr-tonight" data-pr-tonight aria-live="polite">${esc(w.idle)}</p>
            </div>
          </div>
        </div>
      </section>
    </div>`;

  const card = /** @type {HTMLElement} */ (root.querySelector(".pr-card"));
  const count = /** @type {HTMLElement} */ (root.querySelector("[data-pr-count]"));
  const filterBox = /** @type {HTMLElement} */ (root.querySelector("[data-pr-filter]"));
  const big = /** @type {HTMLElement} */ (root.querySelector("[data-pr-dish]"));
  const small = /** @type {HTMLElement} */ (root.querySelector("[data-pr-side]"));
  const tonight = /** @type {HTMLElement} */ (root.querySelector("[data-pr-tonight]"));
  undo.push(attachCardStates(card), attachWheels(card));

  /** The empty and failed notes carry the package's drawing. */
  const drawArt = () => {
    const box = card.querySelector(".kp-card__empty:not([data-kp-art]), .kp-card__failure:not([data-kp-art])");
    if (!box) return;
    box.setAttribute("data-kp-art", box.classList.contains("kp-card__failure") ? "error" : "nomatch");
    undo.push(attachArt(card));
  };

  const say = () => {
    if (!dish) {
      tonight.textContent = w.idle;
      return;
    }
    // The fixed ingredients (the dish's own name left out: "Stoofvlees, met stoofvlees" says it twice), then the side
    // the small wheel picked, or the only one.
    const sides = choices(dish);
    const chosen = sides.length === 1 ? sides[0] : pick;
    if (spins(dish) && chosen === null) {
      tonight.textContent = w.turning;
      return;
    }
    const fixed = (dish.ingredients ?? []).filter((n) => n.toLowerCase() !== dish?.name.toLowerCase());
    tonight.textContent = w.tonight(dish.name, [...fixed, ...(chosen ? [chosen] : [])]);
  };

  // The big wheel draws its dish before it turns: the small wheel starts on the dish's choice at once.
  const onDish = (/** @type {Event} */ e) => {
    const id = /** @type {CustomEvent} */ (e).detail?.item?.id;
    dish = data?.dishes.find((d) => d.id === id) ?? null;
    pick = null;
    tonight.textContent = w.turning;
    if (!dish || !spins(dish)) {
      small.setAttribute("data-kp-wheel-empty", dish ? w.nothing(dish.name) : w.sideFirst);
      setWheelItems(small, []);
      return;
    }
    const name = dish.name;
    setWheelItems(small, choices(dish).map((c) => ({ id: c, label: c, tag: w.tagWith(name) })));
    void spinWheel(small);
  };
  const onDishDone = () => say();
  const onSide = (/** @type {Event} */ e) => {
    const label = /** @type {CustomEvent} */ (e).detail?.item?.label;
    if (!dish || typeof label !== "string") return;
    pick = label;
    say();
  };
  // A tap on the small wheel spins it again: the side is open until it lands.
  const onSideSpin = () => {
    pick = null;
    say();
  };
  big.addEventListener(WHEEL_SPIN_EVENT, onDish);
  big.addEventListener(WHEEL_RESULT_EVENT, onDishDone);
  small.addEventListener(WHEEL_RESULT_EVENT, onSide);
  small.addEventListener(WHEEL_SPIN_EVENT, onSideSpin);
  undo.push(() => {
    big.removeEventListener(WHEEL_SPIN_EVENT, onDish);
    big.removeEventListener(WHEEL_RESULT_EVENT, onDishDone);
    small.removeEventListener(WHEEL_RESULT_EVENT, onSide);
    small.removeEventListener(WHEEL_SPIN_EVENT, onSideSpin);
  });

  /** The dishes the filter lets through. */
  const shown = () => (data?.dishes ?? []).filter((d) => !filter || d.category === filter);

  const fillBig = () => {
    dish = null;
    pick = null;
    small.setAttribute("data-kp-wheel-empty", w.sideFirst);
    setWheelItems(small, []);
    const list = shown();
    count.textContent = w.count(list.length);
    setWheelItems(
      big,
      list.map((d) => {
        return { id: d.id, label: d.name, tag: spins(d) ? w.tagChoice(choices(d)) : w.tagSame };
      }),
    );
    say();
  };

  // The categories as one row of choices; with fewer than two there is nothing to narrow and the row stays empty.
  const drawFilter = () => {
    const cats = data?.categories ?? [];
    if (cats.length < 2) {
      filterBox.replaceChildren();
      return;
    }
    const item = (/** @type {string} */ value, /** @type {string} */ label) =>
      `<button type="button" class="kp-segmented__item" role="radio" aria-checked="${value === filter}" data-value="${esc(value)}"><span class="kp-segmented__label">${esc(label)}</span><span class="kp-segmented__count"></span></button>`;
    filterBox.innerHTML = `<div class="kp-segmented kp-segmented--chips" data-kp-segmented="single" role="radiogroup" aria-label="${esc(w.filterLabel)}">${item("", w.all)}${cats.map((c) => item(c.id, c.name)).join("")}</div>`;
    const group = /** @type {HTMLElement} */ (filterBox.firstElementChild);
    undo.push(attachSegmented(group));
    setSegmentedCounts(group, { "": data?.dishes.length ?? 0, ...Object.fromEntries(cats.map((c) => [c.id, c.count])) });
    group.addEventListener(SEGMENTED_EVENT, () => {
      const next = getSegmentedValues(group)[0] ?? "";
      if (next === filter) return;
      filter = next;
      fillBig();
    });
  };

  const draw = () => {
    if (status === "loading") {
      count.textContent = "";
      setCardState(card, "loading", { words: w.loading });
      return;
    }
    if (status === "error") {
      count.textContent = "";
      setCardState(card, "error", { title: w.failedTitle, text: failure });
      drawArt();
      return;
    }
    if (!data?.dishes.length) {
      count.textContent = w.count(0);
      setCardState(card, "empty", { title: w.emptyTitle, text: w.emptyText, action: emptyAction?.() });
      drawArt();
      return;
    }
    if (filter && !data.categories.some((c) => c.id === filter)) filter = "";
    drawFilter();
    fillBig();
    setCardState(card, "ready");
  };

  const read = (force = false) => {
    if (force) {
      status = "loading";
      draw();
    }
    load(force).then(
      (d) => {
        data = d;
        status = "ready";
        draw();
      },
      (/** @type {Error} */ e) => {
        status = "error";
        failure = e.message;
        draw();
      },
    );
  };
  const retry = () => read(true);
  card.addEventListener(CARD_RETRY_EVENT, retry);
  undo.push(() => card.removeEventListener(CARD_RETRY_EVENT, retry));

  draw();
  read();
  return () => {
    for (const fn of undo.reverse()) fn();
  };
}
