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
    cardTitle: "Het eten van vanavond",
    cardText: "Tik op een wiel om het te laten kiezen. Een tik op het kleine wiel kiest opnieuw voor hetzelfde gerecht.",
    answerKicker: "Het avondeten",
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
    cardTitle: "Tonight's dinner",
    cardText: "Tap a wheel to let it choose. A tap on the small wheel picks again for the same dish.",
    answerKicker: "Dinner",
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
/** The short line about a dish on the wheel. @param {typeof WORDS["nl"]} w @param {Dish} d */
const tagOf = (w, d) => (spins(d) ? w.tagChoice(choices(d)) : w.tagSame);

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
  /** @type {Array<() => void>} */
  const undo = [];

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

  const card = /** @type {HTMLElement} */ (root.querySelector(".pr-card"));
  const count = /** @type {HTMLElement} */ (root.querySelector("[data-pr-count]"));
  const filterBox = /** @type {HTMLElement} */ (root.querySelector("[data-pr-filter]"));
  const wheels = mountDishWheel(/** @type {HTMLElement} */ (root.querySelector("[data-pr-wheels]")), {
    kiosk: true,
    words: { dishKicker: w.dishKicker, sideKicker: w.sideKicker, sideFirst: w.sideFirst, nothing: w.nothing, sideTag: w.tagWith },
    onChange: (change) => say(change),
  });
  // The answer column: what the wheels chose, said as one dinner.
  const answerBox = /** @type {HTMLElement} */ (wheels.answer);
  answerBox.innerHTML = `<p class="pr-kicker">${esc(w.answerKicker)}</p><p class="pr-tonight" data-pr-tonight aria-live="polite"></p><p class="pr-hint" data-pr-hint></p>`;
  const tonight = /** @type {HTMLElement} */ (answerBox.querySelector("[data-pr-tonight]"));
  const hint = /** @type {HTMLElement} */ (answerBox.querySelector("[data-pr-hint]"));
  hint.textContent = "";
  tonight.textContent = w.idle;
  undo.push(attachCardStates(card), () => wheels.destroy());

  /** The empty and failed notes carry the package's drawing. */
  const drawArt = () => {
    const box = card.querySelector(".kp-card__empty:not([data-kp-art]), .kp-card__failure:not([data-kp-art])");
    if (!box) return;
    box.setAttribute("data-kp-art", box.classList.contains("kp-card__failure") ? "error" : "nomatch");
    undo.push(attachArt(card));
  };

  /** @param {import("./dishwheel.js").DishChange} change */
  function say(change) {
    const d = change.dish ? (data?.dishes.find((x) => x.id === change.dish?.id) ?? null) : null;
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

  /** The dishes the filter lets through. */
  const shown = () => (data?.dishes ?? []).filter((d) => !filter || d.category === filter);

  const fillBig = () => {
    const list = shown();
    count.textContent = w.count(list.length);
    wheels.setDishes(list.map((d) => ({ id: d.id, label: d.name, tag: tagOf(w, d), sides: choices(d) })));
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
