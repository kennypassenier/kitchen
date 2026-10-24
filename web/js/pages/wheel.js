// The wheel, "What do we eat?" (route "/"): the kitchen's dishes on one wheel, the answer with when to start, the
// three-way filters, "No energy today" and the dishes that fit. Everything drawn is the package's: js/wheel.js,
// js/segmented.js (three-way chips), js/toggle.js, js/card-state.js (loading, empty and failed states), js/art.js,
// js/reason.js, js/calm.js, the kp-switch and the form grid. Data comes from api.js only.
//
// What a person did that is kept: a dish set aside ("Not this one, not again this week") is a `resting` item with an
// `until` date; the filters, the switch and the spin are never stored.

import { loadKitchen, kitchenNow, onKitchen, create, remove, daysSinceCooked } from "../api.js";
import { h } from "../dom.js";
import { attachWheels, setWheelItems, spinWheel, WHEEL_RESULT_EVENT, WHEEL_SPIN_EVENT } from "/static/kp/js/wheel.js";
import { attachCardStates, setCardState, CARD_RETRY_EVENT } from "/static/kp/js/card-state.js";
import { attachSegmented, SEGMENTED_EVENT, getSegmentedTri, setSegmentedTri, setSegmentedCounts, setSegmentedItems } from "/static/kp/js/segmented.js";
import { attachToggles, toggle } from "/static/kp/js/toggle.js";
import { attachArt } from "/static/kp/js/art.js";
import { attachDisabledReasons } from "/static/kp/js/reason.js";
import { setCalm, isCalm } from "/static/kp/js/calm.js";
import { openRecordEditor, detailHref } from "../records.js";

/**
 * @typedef {object} Dish a recipe as the wheel sees it
 * @property {string} id @property {string} label the full name @property {string} short the slice label
 * @property {string[]} meals @property {number} minutes @property {string[]} ing
 * @property {number} days days since last cooked (Infinity: never)
 * @property {boolean} safe @property {number} freezer portions in the freezer
 * @property {string} prep `none` | `light` | `full`
 */
/** @typedef {{ include: string[], exclude: string[] }} Tri */
/**
 * @typedef {object} Model what the person asked for, in memory only
 * @property {Tri} meal @property {Tri} time @property {Tri} ing @property {boolean} easy
 * @property {Set<string>} kinds @property {Set<string>} resting recipe ids set aside @property {string[]} order the order constraints were set in
 */

const MEALS = /** @type {Record<string, string>} */ ({ breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" });
const BANDS = /** @type {Record<string, string>} */ ({ quick: "up to 20 min", mid: "21 to 45 min", long: "over 45 min" });
const KINDS = /** @type {Record<string, string>} */ ({ safe: "Safe favourites", freezer: "Freezer portions", noprep: "No prep" });
/** The ingredient chips before the dishes have loaded; once they have, the chips are the ingredients the dishes use. */
const FIRST_INGREDIENTS = ["chicken", "beef", "egg", "cheese", "tomato", "potato"];
/** A dish not cooked for this many days gets a bigger slice (when the odds are not equal). */
const LONG_DAYS = 21;
const LOADING_WORDS = "Reading your dishes";

const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
const hhmm = (/** @type {number} */ m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const dmy = (/** @type {Date} */ d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const iso = (/** @type {Date} */ d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (/** @type {number} */ n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const minutesText = (/** @type {number} */ m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);
const plural = (/** @type {number} */ n, /** @type {string} */ one, /** @type {string} */ many) => `${n} ${n === 1 ? one : many}`;
const cap = (/** @type {string} */ s) => s.charAt(0).toUpperCase() + s.slice(1);
const norm = (/** @type {unknown} */ s) => String(s ?? "").trim().toLowerCase();
const band = (/** @type {number} */ m) => (m <= 20 ? "quick" : m <= 45 ? "mid" : "long");
const isKind = (/** @type {Dish} */ d, /** @type {string} */ k) => (k === "safe" ? d.safe : k === "freezer" ? d.freezer > 0 : d.prep === "none");
const emptyTri = () => ({ include: [], exclude: [] });

/** @param {Dish[]} dishes @param {string} group @param {string[]} values */
function countOf(dishes, group, values) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const v of values) {
    out[v] = dishes.filter((d) => (group === "meal" ? d.meals.includes(v) : group === "time" ? band(d.minutes) === v : d.ing.includes(v))).length;
  }
  return out;
}

/** @param {HTMLElement} root @param {{ params: URLSearchParams, navigate: (href: string) => void }} ctx */
export function mount(root, { navigate }) {
  document.title = "What do we eat? · Kitchen";

  // ---- the data, as the wheel reads it -------------------------------------------------------------------------------
  /** @type {import("../api.js").Kitchen | null} */
  let kitchen = kitchenNow();
  /** @type {"loading" | "error" | "ready"} */
  let status = kitchen ? "ready" : "loading";
  let failure = "";
  /** @type {Dish[]} */
  let dishes = [];
  /** @type {Map<string, any>} recipe id -> its active resting item */
  let restItems = new Map();
  /** @type {Model} */
  const M = { meal: emptyTri(), time: emptyTri(), ing: emptyTri(), easy: false, kinds: new Set(Object.keys(KINDS)), resting: new Set(), order: [] };
  /** @type {(() => void)[]} */
  const undo = [];
  let writing = false;
  /** Calm mode was switched on by the "No energy today" switch (so switching off puts it back only then). */
  let calmByUs = false;

  const odds = () => String(kitchen?.settings?.odds ?? "equal");
  const dinnerTime = () => {
    const t = String(kitchen?.settings?.dinner_time ?? "");
    return /^\d{1,2}:\d{2}$/.test(t) ? `${pad(Number(t.split(":")[0]))}:${t.split(":")[1]}` : "18:30";
  };

  function derive() {
    const k = kitchen;
    const today = iso(new Date());
    const freezer = (k?.freezer ?? []).filter((f) => Number(f.portions) > 0);
    restItems = new Map();
    for (const r of k?.resting ?? []) if (String(r.until) >= today) restItems.set(r.recipe_id, r);
    M.resting = new Set(restItems.keys());
    dishes = (k?.recipes ?? []).map((r) => ({
      id: r.id,
      label: r.name,
      short: r.short || r.name,
      meals: r.meals ?? [],
      minutes: Number(r.minutes) || 0,
      ing: r.ing ?? [],
      days: k ? daysSinceCooked(k, r.id) : Infinity,
      safe: !!r.safe,
      freezer: freezer.filter((f) => f.recipe_id === r.id || norm(f.dish) === norm(r.name) || norm(f.dish) === norm(r.short)).reduce((n, f) => n + Number(f.portions), 0),
      prep: r.prep ?? "full",
    }));
  }
  const byId = (/** @type {string} */ id) => dishes.find((d) => d.id === id);

  // ---- what fits ------------------------------------------------------------------------------------------------------
  /** @param {Dish} d @param {Model} m @param {{ filters?: boolean, resting?: boolean, easy?: boolean }} [skip] */
  function fits(d, m, skip = {}) {
    if (!skip.filters) {
      if (m.meal.include.length && !m.meal.include.some((x) => d.meals.includes(x))) return false;
      if (m.meal.exclude.some((x) => d.meals.includes(x))) return false;
      if (m.time.include.length && !m.time.include.includes(band(d.minutes))) return false;
      if (m.time.exclude.includes(band(d.minutes))) return false;
      if (!m.ing.include.every((x) => d.ing.includes(x))) return false;
      if (m.ing.exclude.some((x) => d.ing.includes(x))) return false;
    }
    if (!skip.resting && m.resting.has(d.id)) return false;
    if (!skip.easy && m.easy && ![...m.kinds].some((k) => isKind(d, k))) return false;
    return true;
  }
  const onWheel = (/** @type {Model} */ m) => dishes.filter((d) => fits(d, m));

  /** The size of a dish's slice: equal by default; the settings may ask for long-not-eaten or freezer first. @param {Dish} d */
  function weight(d) {
    const mode = odds();
    if (mode === "equal") return 1;
    let w = Number.isFinite(d.days) ? Math.min(5, Math.max(0.6, 0.6 + d.days / 8)) : 5;
    if (mode === "freezer" && d.freezer > 0) w *= 3;
    return Math.round(w * 10) / 10;
  }
  const bigger = (/** @type {Dish} */ d) => odds() !== "equal" && d.days >= LONG_DAYS;

  /** @param {Model} m */
  const copyOf = (m) => ({
    meal: structuredClone(m.meal),
    time: structuredClone(m.time),
    ing: structuredClone(m.ing),
    easy: m.easy,
    kinds: new Set(m.kinds),
    resting: new Set(m.resting),
    order: [...m.order],
  });

  /**
   * Everything that holds dishes back, each with how to let it go (on the model it is given).
   * @param {Model} m
   * @returns {{ key: string, label: string, release: () => void }[]}
   */
  function constraints(m) {
    /** @type {{ key: string, label: string, release: () => void }[]} */
    const out = [];
    /** @param {"meal" | "time" | "ing"} group @param {(v: string) => string} name */
    const tri = (group, name) => {
      for (const state of /** @type {const} */ (["include", "exclude"])) {
        for (const value of m[group][state]) {
          const n = name(value);
          const label = group === "ing" ? (state === "include" ? `with ${n}` : `without ${n}`) : state === "include" ? n : `not ${n}`;
          out.push({ key: `${group}:${value}`, label, release: () => (m[group][state] = m[group][state].filter((x) => x !== value)) });
        }
      }
    };
    tri("meal", (v) => MEALS[v] ?? v);
    tri("time", (v) => BANDS[v] ?? v);
    tri("ing", (v) => v);
    for (const id of m.resting) out.push({ key: `rest:${id}`, label: `resting: ${byId(id)?.label ?? "a dish"}`, release: () => m.resting.delete(id) });
    if (m.easy) {
      for (const k of Object.keys(KINDS)) {
        if (!m.kinds.has(k)) out.push({ key: `kind:${k}`, label: `not counting ${KINDS[k].toLowerCase()}`, release: () => m.kinds.add(k) });
      }
    }
    if (m.easy && !out.length) out.push({ key: "easy", label: "no energy today", release: () => (m.easy = false) });
    return out;
  }
  const filterCount = (/** @type {Model} */ m) => constraints(m).filter((c) => /^(meal|time|ing):/.test(c.key)).length;
  const blockText = (/** @type {Model} */ m) => {
    const all = constraints(m);
    return all.length ? `No dish fits all of: ${all.map((c) => c.label).join(", ")}.` : "No dish is left on the wheel.";
  };
  /** @param {string} key @param {boolean} on */
  function track(key, on) {
    M.order = M.order.filter((k) => k !== key);
    if (on) M.order.push(key);
  }

  /** The one thing that frees the most dishes when let go (the later one on a tie). */
  function pickToLoosen() {
    const all = constraints(M);
    if (!all.length) return null;
    let pick = all[all.length - 1];
    let best = -1;
    for (const c of all) {
      const copy = copyOf(M);
      constraints(copy).find((x) => x.key === c.key)?.release();
      const n = onWheel(copy).length;
      if (n >= best) {
        best = n;
        pick = c;
      }
    }
    return pick;
  }

  // ---- the markup, whole, from the first frame ---------------------------------------------------------------------------
  const chip = (/** @type {string} */ value, /** @type {string} */ label) =>
    `<button type="button" class="kp-segmented__item" data-value="${value}"><span class="kp-segmented__label">${label}</span></button>`;
  const chips = (/** @type {string} */ id, /** @type {string} */ labelId, /** @type {string} */ items) =>
    `<div class="kp-segmented kp-segmented--chips" data-kp-segmented="tri" data-kp-segmented-summary aria-labelledby="${labelId}" id="${id}">${items}</div>`;
  const card = (/** @type {string} */ id, /** @type {string} */ title, /** @type {string} */ badge, /** @type {string} */ body, /** @type {string} */ extra = "") => `
    <section class="kp-card wl-card ${extra}" id="${id}" data-kp-state="${status === "ready" ? "ready" : "loading"}" aria-labelledby="${id}-t" data-kp-loading-words="${LOADING_WORDS}">
      <div class="kp-card__header">
        <h3 class="kp-card__title" id="${id}-t">${title}</h3>
        <div class="kp-card__actions"><span class="kp-badge" ${badge}></span></div>
      </div>
      <p class="kp-card__body" ${id === "wl-card" ? 'id="wl-card-body"' : ""}>${body}</p>
      <div class="kp-card__stage"><div class="kp-card__data"></div></div>
    </section>`;

  root.innerHTML = `
    <div class="wl-page">
      <header class="wl-intro">
        <h1>What do we eat?</h1>
        <p>One press and the wheel picks tonight&rsquo;s dinner from your own recipes; all you do is say yes or spin again.</p>
      </header>

      <section class="wl-sec" id="wl-wheel" aria-labelledby="wl-h-wheel">
        <div class="wl-sec__head">
          <h2 id="wl-h-wheel">The wheel and its answer</h2>
          <p>Press Spin and the wheel picks a dish, tells you when to start cooking it, and lets you say yes, spin again or set the dish aside for a week.</p>
        </div>
        ${card("wl-card", "Tonight&rsquo;s dinner", "data-wl-fitcount", "Spin once; if the answer does not feel right, spin again or set that dish aside.")}
      </section>

      <section class="wl-sec" id="wl-filters-sec" aria-labelledby="wl-h-filters">
        <div class="wl-sec__head">
          <h2 id="wl-h-filters">Filters: want, not, or either way</h2>
          <p>Press a chip once to require it, twice to leave it out and a third time to let it go; the wheel and the list below only hold what fits.</p>
        </div>
        <div class="kp-formgrid wl-filters" id="wl-filters">
          <div class="kp-formgrid__row">
            <p class="kp-formgrid__label wl-filters__name" id="wl-f-meal-l">Meal</p>
            <div class="kp-formgrid__control wl-filters__row" data-kp-formgrid-span="wide">
              ${chips("wl-f-meal", "wl-f-meal-l", Object.entries(MEALS).map(([v, l]) => chip(v, l)).join(""))}
            </div>
          </div>
          <div class="kp-formgrid__row">
            <p class="kp-formgrid__label wl-filters__name" id="wl-f-time-l">Time</p>
            <div class="kp-formgrid__control wl-filters__row" data-kp-formgrid-span="wide">
              ${chips("wl-f-time", "wl-f-time-l", Object.entries(BANDS).map(([v, l]) => chip(v, cap(l))).join(""))}
            </div>
          </div>
          <div class="kp-formgrid__row">
            <p class="kp-formgrid__label wl-filters__name" id="wl-f-ing-l">Ingredients</p>
            <div class="kp-formgrid__control wl-filters__row" data-kp-formgrid-span="wide">
              ${chips("wl-f-ing", "wl-f-ing-l", FIRST_INGREDIENTS.map((v) => chip(v, cap(v))).join(""))}
            </div>
          </div>
          <div class="kp-formgrid__row wl-filters__foot">
            <div class="kp-formgrid__control wl-filters__foot-cell" data-kp-formgrid-span="wide">
              <button type="button" class="kp-button kp-button--sm" id="wl-f-clear" disabled data-kp-disabled-reason="Nothing is filtered yet" title="Let go of every chip at once">Clear all filters</button>
              <p class="wl-live" role="status" id="wl-f-live"></p>
            </div>
          </div>
        </div>
        ${card("wl-fits", "Dishes that fit", 'id="wl-fits-count"', "These are the dishes on the wheel right now, with how long ago each was cooked.", "wl-card--list")}
      </section>

      <section class="wl-sec" id="wl-easy-sec" aria-labelledby="wl-h-easy">
        <div class="wl-sec__head">
          <h2 id="wl-h-easy">No energy today: only what is possible</h2>
          <p>One switch for the days with nothing in the tank: the wheel only holds safe favourites, portions from the freezer and food that needs no preparing.</p>
        </div>
        <div class="kp-formgrid wl-easy" id="wl-easy">
          <div class="kp-formgrid__row">
            <p class="kp-formgrid__label wl-filters__name wl-easy__name" id="wl-easy-l">No energy today</p>
            <div class="kp-formgrid__control" data-kp-formgrid-span="wide">
              <label class="kp-switch">
                <input class="kp-switch__input" type="checkbox" role="switch" id="wl-easy-switch" aria-labelledby="wl-easy-l" disabled />
                <span class="kp-switch__state" aria-hidden="true"></span>
                <span>Limit the wheel to what I can manage</span>
              </label>
            </div>
          </div>
          <div class="kp-formgrid__row">
            <p class="kp-formgrid__label wl-filters__name" id="wl-easy-says-l">What it does</p>
            <p class="kp-formgrid__control wl-easy__says" data-kp-formgrid-span="wide" aria-labelledby="wl-easy-says-l">On: the wheel only holds dishes you can manage today. Nothing is deleted; switch it off and everything is back. Calm mode comes on with it and goes off again.</p>
          </div>
          <div class="kp-formgrid__row">
            <p class="kp-formgrid__label wl-filters__name" id="wl-easy-kinds-l">What counts as easy</p>
            <div class="kp-formgrid__control wl-filters__row" data-kp-formgrid-span="wide">
              <div class="kp-toggles" role="group" aria-labelledby="wl-easy-kinds-l" id="wl-easy-kinds" data-kp-toggle-group="easy" data-kp-toggle-mode="multi">
                ${Object.entries(KINDS)
                  .map(
                    ([v, l]) =>
                      `<button type="button" class="kp-button" data-kp-toggle data-kp-look="chip" data-kp-pressed-mark="check" aria-pressed="true" data-kp-toggle-value="${v}" data-kp-count="loading" disabled data-kp-disabled-reason="Turn on No energy today first">${l}</button>`,
                  )
                  .join("")}
              </div>
            </div>
          </div>
          <div class="kp-formgrid__row">
            <p class="kp-formgrid__label wl-filters__name" id="wl-easy-now-l">Right now</p>
            <p class="kp-formgrid__control wl-live" role="status" data-kp-formgrid-span="wide" id="wl-easy-live" aria-labelledby="wl-easy-now-l"></p>
          </div>
        </div>
      </section>
    </div>`;

  /** @param {string} id */
  const q = (id) => /** @type {HTMLElement} */ (root.querySelector(`#${id}`));
  const cardMain = q("wl-card");
  const cardList = q("wl-fits");
  const groups = { meal: q("wl-f-meal"), time: q("wl-f-time"), ing: q("wl-f-ing") };
  const clearBtn = /** @type {HTMLButtonElement} */ (q("wl-f-clear"));
  const filtersLive = q("wl-f-live");
  const easyLive = q("wl-easy-live");
  const switchEl = /** @type {HTMLInputElement} */ (q("wl-easy-switch"));
  const kindsEl = q("wl-easy-kinds");
  const kindButtons = /** @type {HTMLElement[]} */ ([...kindsEl.querySelectorAll("[data-kp-toggle]")]);

  // The package's own attach calls, once, on this screen's markup.
  undo.push(attachCardStates(root), attachSegmented(root), attachToggles(kindsEl), attachDisabledReasons(root));
  /** The empty and failed notes carry the package's drawing. @param {HTMLElement} cardEl */
  const drawArt = (cardEl) => {
    const box = cardEl.querySelector(".kp-card__empty:not([data-kp-art]), .kp-card__failure:not([data-kp-art])");
    if (!box) return;
    box.setAttribute("data-kp-art", box.classList.contains("kp-card__failure") ? "error" : "nomatch");
    undo.push(attachArt(cardEl));
  };
  for (const g of Object.values(groups)) if (status === "loading") g.setAttribute("aria-busy", "true");
  for (const g of Object.values(groups)) setSegmentedCounts(g, Object.fromEntries([...g.querySelectorAll("[data-value]")].map((b) => [/** @type {HTMLElement} */ (b).dataset.value ?? "", null])));

  // ---- one view of the model: the wheel card or the list card -------------------------------------------------------
  /**
   * @param {HTMLElement} cardEl
   * @param {"wheel" | "list"} kind
   */
  function view(cardEl, kind) {
    const data = /** @type {HTMLElement} */ (cardEl.querySelector(".kp-card__data"));
    const badge = /** @type {HTMLElement} */ (cardEl.querySelector(".kp-badge"));
    /** @type {string | null} */
    let chosen = null;
    let spinning = false;
    let shownKey = "";
    let cardKey = "";
    /** @type {string[]} */
    let items = [];
    /** @type {Record<string, HTMLElement>} */
    const part = {};
    /** @type {HTMLElement | null} */
    let wheel = null;

    const say = (/** @type {string} */ text) => {
      if (kind === "wheel") part.live.textContent = text;
      else filtersLive.textContent = text;
    };

    if (kind === "wheel") {
      data.innerHTML = `
        <div class="wl-screen">
          <div class="wl-wheelcol">
            <p class="wl-result__kicker wl-wheelcol__kicker">Tonight&rsquo;s wheel</p>
            <div class="kp-wheel" data-kp-wheel aria-label="Tonight’s dinner"></div>
          </div>
          <div class="wl-result" role="group" aria-label="The wheel’s answer">
            <p class="wl-result__kicker" data-wl="kicker"></p>
            <p class="wl-result__name" data-wl="name"></p>
            <div class="wl-result__facts" data-wl="facts"></div>
            <p class="wl-result__why" data-wl="why"></p>
            <p class="wl-result__timing" data-wl="timing"></p>
            <div class="wl-actions">
              <div class="wl-action">
                <button type="button" class="kp-button kp-button--primary" data-wl="yes" disabled data-kp-disabled-reason="Spin first: the wheel has not chosen yet">Yes, cook this</button>
                <p>Open this recipe, where you can begin cooking it.</p>
              </div>
              <div class="wl-action">
                <button type="button" class="kp-button" data-wl="again" disabled data-kp-disabled-reason="The dishes are loading">Spin again</button>
                <p>Let the wheel choose another dish.</p>
              </div>
              <div class="wl-action">
                <button type="button" class="kp-button" data-wl="skip" disabled data-kp-disabled-reason="Spin first: there is no dish to set aside yet">Not this one, not again this week</button>
                <p data-wl="skip-says"></p>
              </div>
            </div>
            <div class="wl-resting">
              <p class="wl-resting__label" data-wl="rest"></p>
              <div class="wl-resting__list" data-wl="resting"></div>
            </div>
            <p class="wl-live" role="status" data-wl="live"></p>
          </div>
        </div>`;
      for (const el of data.querySelectorAll("[data-wl]")) part[/** @type {HTMLElement} */ (el).dataset.wl ?? ""] = /** @type {HTMLElement} */ (el);
      wheel = /** @type {HTMLElement} */ (data.querySelector(".kp-wheel"));
      wheel.id = `${cardEl.id}-wheel`;
      undo.push(attachWheels(cardEl) ?? (() => {}), attachDisabledReasons(cardEl));
    } else {
      data.innerHTML = '<ul class="wl-fits" data-wl="list"></ul>';
      part.list = /** @type {HTMLElement} */ (data.querySelector('[data-wl="list"]'));
    }

    const badgeOf = (/** @type {string} */ text, tone = "") => h("span", { class: `kp-badge${tone ? ` kp-badge--${tone}` : ""}` }, text);
    const setReason = (/** @type {HTMLElement} */ button, /** @type {boolean} */ off, /** @type {string} */ why) => {
      /** @type {HTMLButtonElement} */ (button).disabled = off;
      button.setAttribute("data-kp-disabled-reason", why);
    };

    /** The line that counts back from dinner. @param {Dish} d */
    const timingOf = (d) => {
      const [hh, mm] = dinnerTime().split(":").map(Number);
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const start = hh * 60 + mm - d.minutes;
      return start >= nowMin
        ? `Start at ${hhmm(start)} to eat at ${dinnerTime()} (${minutesText(d.minutes)}).`
        : `Dinner at ${dinnerTime()} is too soon for this one: start now and eat at ${hhmm(nowMin + d.minutes)}.`;
    };
    const lastCooked = (/** @type {Dish} */ d) =>
      !Number.isFinite(d.days)
        ? "Not cooked yet."
        : `Last cooked ${d.days === 0 ? "today" : d.days === 1 ? "yesterday" : `${dmy(daysAgo(d.days))}, ${d.days} days ago`}.`;
    const oddsLine = () =>
      ({
        equal: "Every dish has a slice of the same size.",
        recency: `A dish you have not cooked for ${LONG_DAYS} days or more gets a bigger slice.`,
        freezer: `A dish not cooked for ${LONG_DAYS} days gets a bigger slice, and one with portions in the freezer a bigger one still.`,
      })[/** @type {"equal"} */ (odds())] ?? "";

    const paintAnswer = () => {
      if (!wheel) return;
      const d = chosen ? byId(chosen) : undefined;
      const loaded = status === "ready";
      part.facts.replaceChildren();
      if (!loaded) {
        part.kicker.textContent = status === "error" ? "The dishes could not be read" : "Reading your dishes";
        part.name.textContent = "";
        part.why.textContent = "";
        part.timing.textContent = "";
      } else if (spinning) {
        part.kicker.textContent = "The wheel is turning";
        part.name.textContent = "…";
        part.why.textContent = "Hold on a moment: it will stop by itself.";
        part.timing.textContent = "";
      } else if (!d) {
        part.kicker.textContent = "Not chosen yet";
        part.name.textContent = items.length ? "Press Spin" : "Nothing to spin";
        part.facts.append(badgeOf(`${plural(items.length, "dish", "dishes")} on the wheel`));
        part.why.textContent = oddsLine();
        part.timing.textContent = "Once the wheel has chosen, this says when to start.";
      } else {
        part.kicker.textContent = items.length === 1 ? "Only one dish fits" : "The wheel chose";
        part.name.textContent = d.label;
        for (const m of d.meals) part.facts.append(badgeOf(MEALS[m] ?? cap(m)));
        part.facts.append(badgeOf(minutesText(d.minutes)));
        if (d.safe) part.facts.append(badgeOf("Safe favourite", "success"));
        if (d.freezer > 0) part.facts.append(badgeOf(`Freezer, ${plural(d.freezer, "portion", "portions")}`, "info"));
        if (d.prep === "none") part.facts.append(badgeOf("No prep", "success"));
        if (bigger(d)) part.facts.append(badgeOf("Bigger slice", "warning"));
        part.why.textContent = `${lastCooked(d)} ${bigger(d) ? "Its slice was bigger." : odds() === "equal" ? "Every slice was the same size." : "Its slice was smaller."}`;
        part.timing.textContent = timingOf(d);
      }
      const idle = loaded && !spinning && !writing;
      setReason(part.yes, !d || !idle, !loaded ? "The dishes are loading" : spinning ? "The wheel is turning" : writing ? "Saving a change" : "Spin first: the wheel has not chosen yet");
      setReason(part.again, !idle || items.length < 2, !loaded ? "The dishes are loading" : spinning ? "The wheel is turning" : writing ? "Saving a change" : "Only one dish is on the wheel: there is nothing to spin");
      setReason(part.skip, !d || !idle, !loaded ? "The dishes are loading" : spinning ? "The wheel is turning" : writing ? "Saving a change" : "Spin first: there is no dish to set aside yet");
      const until = new Date();
      until.setDate(until.getDate() + 7);
      part["skip-says"].textContent = `Take this dish off the wheel until ${dmy(until)}.`;
      const rest = [...restItems.values()];
      part.rest.textContent = rest.length ? "Resting, off the wheel until the date shown:" : "Nothing is resting: every dish that fits is on the wheel.";
      part.resting.replaceChildren(
        ...rest.map((item) => {
          const name = byId(item.recipe_id)?.label ?? "A dish";
          const until = new Date(`${item.until}T12:00:00`);
          const back = h("button", { type: "button", class: "kp-button kp-button--sm", title: "Put this dish back on the wheel", "aria-label": `Bring back ${name}` }, "Bring back");
          back.addEventListener("click", () => void bringBack(item, name));
          // Edit changes the last day it rests (Kenny, 24/10/2026 05:07: every item has full CRUD and its own page).
          const edit = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": `Change how long ${name} rests` }, "Edit");
          edit.addEventListener("click", () => openRecordEditor("resting", item));
          return h(
            "div",
            { class: "wl-rest" },
            h("span", { class: "wl-rest__name" }, h("a", { href: detailHref("resting", item.id) }, name)),
            h("span", { class: "wl-rest__until" }, Number.isNaN(until.getTime()) ? "" : dmy(until)),
            h("span", { class: "kp-row-actions" }, edit, back),
          );
        }),
      );
    };

    const paintList = () => {
      part.list.replaceChildren(
        ...items.map((id) => {
          const d = /** @type {Dish} */ (byId(id));
          const meta = `${d.meals.map((m) => MEALS[m] ?? cap(m)).join(", ")} · ${minutesText(d.minutes)} · ${Number.isFinite(d.days) ? `last cooked ${dmy(daysAgo(d.days))}` : "not cooked yet"}`;
          return h("li", { class: "wl-fit" }, h("span", { class: "wl-fit__text" }, h("b", null, d.label), h("span", null, meta)), h("span", { class: "wl-fit__tags" }, bigger(d) ? badgeOf("Bigger slice", "warning") : null));
        }),
      );
    };

    /** The card's state follows the data and the model. */
    const syncCard = () => {
      const n = items.length;
      badge.textContent = status !== "ready" ? "" : kind === "list" ? `${n} of ${dishes.length}` : plural(n, "dish", "dishes");
      const none = status === "ready" && n === 0;
      const key = status === "ready" ? (none ? `empty:${dishes.length}:${blockText(M)}:${filterCount(M)}` : "ready") : `${status}:${failure}`;
      if (key === cardKey) return;
      cardKey = key;
      if (status === "loading") setCardState(cardEl, "loading", { words: LOADING_WORDS });
      else if (status === "error") setCardState(cardEl, "error", { title: "The dishes could not be read", text: failure });
      else if (none) {
        /** @type {HTMLElement[]} */
        const action = [];
        if (!dishes.length) {
          action.push(h("a", { class: "kp-button kp-button--primary kp-stateplate__action", href: "/recipes", title: "Go to the recipes, where a new dish can be added" }, "Open the recipes"));
          setCardState(cardEl, "empty", { title: "There are no dishes yet", text: "Add a recipe and it joins the wheel.", action });
        } else {
          action.push(h("button", { type: "button", class: "kp-button kp-button--primary kp-stateplate__action", title: "Let go of the one thing that holds the most dishes back", onclick: () => void loosenOne(say) }, "Loosen a filter"));
          if (filterCount(M)) action.push(h("button", { type: "button", class: "kp-button kp-stateplate__action", title: "Let go of every filter chip at once", onclick: () => clearFilters() }, "Clear all filters"));
          setCardState(cardEl, "empty", { title: "No dish matches these filters", text: `${blockText(M)} Loosen a filter and the wheel is back.`, action });
        }
      } else setCardState(cardEl, "ready");
      drawArt(cardEl);
    };

    const refresh = () => {
      const list = status === "ready" ? onWheel(M) : [];
      items = list.map((d) => d.id);
      syncCard();
      if (kind === "list") {
        paintList();
        return;
      }
      if (status === "ready" && wheel) {
        const next = list.map((d) => ({ id: d.id, label: d.short, weight: weight(d) }));
        const key = JSON.stringify(next);
        if (key !== shownKey) {
          shownKey = key;
          chosen = null;
          setWheelItems(wheel, next);
        }
      }
      paintAnswer();
    };

    if (wheel) {
      wheel.addEventListener(WHEEL_SPIN_EVENT, () => {
        spinning = true;
        chosen = null;
        paintAnswer();
      });
      wheel.addEventListener(WHEEL_RESULT_EVENT, (event) => {
        spinning = false;
        chosen = /** @type {CustomEvent} */ (event).detail.item.id;
        paintAnswer();
        say(`The wheel chose ${byId(/** @type {string} */ (chosen))?.label}.`);
      });
      part.yes.addEventListener("click", () => {
        if (chosen) navigate(`/recipe?id=${encodeURIComponent(chosen)}`);
      });
      part.again.addEventListener("click", () => void spinWheel(/** @type {HTMLElement} */ (wheel)));
      part.skip.addEventListener("click", () => void setAside());
    }

    async function setAside() {
      if (!chosen || writing) return;
      const d = byId(chosen);
      if (!d) return;
      const until = new Date();
      until.setDate(until.getDate() + 7);
      writing = true;
      paintAnswer();
      try {
        await create("resting", { recipe_id: d.id, until: iso(until) });
        say(`${d.label} is set aside until ${dmy(until)} and off the wheel.`);
      } catch (e) {
        say(`${d.label} could not be set aside: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        writing = false;
        paintAnswer();
      }
    }

    /** @param {any} item @param {string} name */
    async function bringBack(item, name) {
      if (writing) return;
      writing = true;
      paintAnswer();
      try {
        await remove("resting", item.id);
        say(`${name} is back on the wheel.`);
      } catch (e) {
        say(`${name} could not be brought back: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        writing = false;
        paintAnswer();
      }
    }

    cardEl.addEventListener(CARD_RETRY_EVENT, () => void reload());
    return { refresh, say, cardEl };
  }

  const wheelView = view(cardMain, "wheel");
  const listView = view(cardList, "list");

  // ---- loosening, clearing, reading again ----------------------------------------------------------------------------
  /** @param {(text: string) => void} say */
  async function loosenOne(say) {
    const pick = pickToLoosen();
    if (!pick) return;
    if (pick.key.startsWith("rest:")) {
      const item = restItems.get(pick.key.slice(5));
      if (!item) return;
      try {
        await remove("resting", item.id);
      } catch (e) {
        say(`Could not let go of “${pick.label}”: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
    } else {
      pick.release();
      if (pick.key === "easy" || pick.key.startsWith("kind:")) paintEasy();
    }
    M.order = M.order.filter((k) => k !== pick.key);
    paintChips();
    const n = onWheel(M).length;
    say(`Let go of “${pick.label}”: ${n === 1 ? "1 dish fits" : `${n} dishes fit`} again.`);
  }

  function clearFilters() {
    M.meal = emptyTri();
    M.time = emptyTri();
    M.ing = emptyTri();
    M.order = M.order.filter((k) => !/^(meal|time|ing):/.test(k));
    paintChips();
    filtersLive.textContent = "Every filter is let go: every dish is on the list.";
  }

  async function reload() {
    if (status === "loading") return;
    status = "loading";
    paintAll();
    try {
      kitchen = await loadKitchen({ force: true });
      status = "ready";
    } catch (e) {
      failure = e instanceof Error ? e.message : String(e);
      status = "error";
    }
    paintAll();
  }

  // ---- the filter chips -------------------------------------------------------------------------------------------------
  let ingKey = FIRST_INGREDIENTS.join();
  let ingCounts = /** @type {Record<string, number>} */ ({});
  function paintCounts() {
    const loading = status === "loading";
    for (const g of Object.values(groups)) g.toggleAttribute("aria-busy", loading);
    if (status === "error") return;
    if (status === "ready") {
      // The ingredient chips are the ingredients the dishes use, most used first.
      const all = new Map();
      for (const d of dishes) for (const i of d.ing) all.set(i, (all.get(i) ?? 0) + 1);
      const names = [...all.keys()].sort((a, b) => all.get(b) - all.get(a) || a.localeCompare(b));
      const shown = names.length ? names : FIRST_INGREDIENTS;
      ingCounts = countOf(dishes, "ing", shown);
      if (shown.join() !== ingKey) {
        ingKey = shown.join();
        setSegmentedItems(groups.ing, shown.map((v) => ({ value: v, label: cap(v), count: ingCounts[v] })));
        M.ing = getSegmentedTri(groups.ing);
        M.order = M.order.filter((k) => !k.startsWith("ing:") || shown.includes(k.slice(4)));
      }
      setSegmentedCounts(groups.meal, countOf(dishes, "meal", Object.keys(MEALS)));
      setSegmentedCounts(groups.time, countOf(dishes, "time", Object.keys(BANDS)));
      setSegmentedCounts(groups.ing, ingCounts);
    }
  }
  function paintChips() {
    setSegmentedTri(groups.meal, M.meal);
    setSegmentedTri(groups.time, M.time);
    setSegmentedTri(groups.ing, M.ing);
    paintAll();
  }
  /** @param {"meal" | "time" | "ing"} group */
  function readChips(group) {
    const now = getSegmentedTri(groups[group]);
    for (const state of /** @type {const} */ (["include", "exclude"])) for (const v of now[state]) if (!M[group][state].includes(v)) track(`${group}:${v}`, true);
    for (const state of /** @type {const} */ (["include", "exclude"])) for (const v of M[group][state]) if (!now.include.includes(v) && !now.exclude.includes(v)) track(`${group}:${v}`, false);
    M[group] = now;
    paintAll();
  }
  for (const group of /** @type {const} */ (["meal", "time", "ing"])) {
    const on = () => readChips(group);
    groups[group].addEventListener(SEGMENTED_EVENT, on);
    undo.push(() => groups[group].removeEventListener(SEGMENTED_EVENT, on));
  }
  clearBtn.addEventListener("click", clearFilters);

  function describeFilters() {
    const all = constraints(M).filter((c) => /^(meal|time|ing):/.test(c.key));
    clearBtn.disabled = status !== "ready" || !all.length;
    clearBtn.setAttribute("data-kp-disabled-reason", status !== "ready" ? "The dishes are loading" : "Nothing is filtered yet");
    if (status === "loading") filtersLive.textContent = "Reading your dishes.";
    else if (status === "error") filtersLive.textContent = "The dishes could not be read, so there is nothing to filter yet.";
    else if (!all.length) filtersLive.textContent = "Nothing is filtered: every dish is on the list.";
    else filtersLive.textContent = `${all.map((c) => c.label).join(", ")}: ${onWheel(M).length} of ${dishes.length} dishes fit.`;
  }

  // ---- No energy today --------------------------------------------------------------------------------------------------
  function paintEasy() {
    const ready = status === "ready";
    switchEl.disabled = !ready;
    switchEl.checked = M.easy;
    for (const b of kindButtons) {
      const t = toggle(b);
      if (ready) t?.setCount(dishes.filter((d) => isKind(d, b.dataset.kpToggleValue ?? "")).length);
      t?.set(M.kinds.has(b.dataset.kpToggleValue ?? ""), { silent: true });
      /** @type {HTMLButtonElement} */ (b).disabled = !ready || !M.easy;
      b.setAttribute("data-kp-disabled-reason", ready ? "Turn on No energy today first" : "The dishes are loading");
    }
    const n = onWheel(M).length;
    easyLive.textContent =
      status === "loading"
        ? "Reading your dishes."
        : status === "error"
          ? "The dishes could not be read."
          : M.easy
            ? `No energy today is on: ${n === 1 ? "1 dish is" : `${n} dishes are`} on the wheel.`
            : "No energy today is off: the wheel holds every dish.";
  }
  const onSwitch = () => {
    M.easy = switchEl.checked;
    // Calm mode comes on with the switch, is not remembered, and goes off again only if the switch turned it on.
    if (M.easy && !isCalm()) {
      setCalm(true, { remember: false, announce: false });
      calmByUs = true;
    } else if (!M.easy && calmByUs) {
      setCalm(false, { remember: false, announce: false });
      calmByUs = false;
    }
    paintAll();
  };
  const onKinds = (/** @type {Event} */ event) => {
    M.kinds = new Set(/** @type {CustomEvent} */ (event).detail.pressedKeys);
    for (const k of Object.keys(KINDS)) track(`kind:${k}`, !M.kinds.has(k));
    paintAll();
  };
  switchEl.addEventListener("change", onSwitch);
  kindsEl.addEventListener("kp-toggle-changed", onKinds);
  undo.push(() => switchEl.removeEventListener("change", onSwitch), () => kindsEl.removeEventListener("kp-toggle-changed", onKinds));

  // ---- the whole screen, again, from the data and the model ------------------------------------------------------
  function paintAll() {
    derive();
    const body = root.querySelector("#wl-card-body");
    if (body) body.textContent = `Dinner is at ${dinnerTime()}. Spin once; if the answer does not feel right, spin again or set that dish aside.`;
    wheelView.refresh();
    listView.refresh();
    paintCounts();
    describeFilters();
    paintEasy();
  }

  undo.push(
    onKitchen((k) => {
      kitchen = k;
      if (status === "ready") paintAll();
    }),
  );
  paintAll();
  if (status === "loading") {
    loadKitchen().then(
      (k) => {
        kitchen = k;
        status = "ready";
        paintAll();
      },
      (e) => {
        failure = e instanceof Error ? e.message : String(e);
        status = "error";
        paintAll();
      },
    );
  }

  return () => {
    for (const fn of undo) fn();
    if (calmByUs) setCalm(false, { remember: false, announce: false });
    // Close the busy cards the loading states opened.
    for (const c of [cardMain, cardList]) if (c.getAttribute("data-kp-state") === "loading") setCardState(c, "ready");
  };
}
