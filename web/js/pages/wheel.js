// The wheel, "What do we eat?" (route "/"): the kitchen's dishes on one wheel, the answer with when to start, the
// three-way filters, "No energy today" and the dishes that fit. Everything drawn is the package's: the one wheel component (web/eten/dishwheel.js, Kenny, 24/10/2026 10:27: the same
// wheel everywhere; this page gives it the dishes and fills its answer column) over js/wheel.js,
// js/segmented.js (three-way chips), js/toggle.js, js/card-state.js (loading, empty and failed states), js/art.js,
// js/reason.js, js/calm.js, the kp-switch and the form grid. Data comes from api.js only.
//
// What a person did that is kept: a dish set aside ("Not this one, not again this week") is a `resting` item with an
// `until` date; the filters, the switch and the spin are never stored.

import { loadKitchen, kitchenNow, onKitchen, create, remove, daysSinceCooked, defaultRecipe, recipeLabel } from "../api.js";
import { h } from "../dom.js";
import { mountDishWheel } from "/eten/dishwheel.js";
import { attachCardStates, setCardState, CARD_RETRY_EVENT } from "/static/kp/js/card-state.js";
import { attachSegmented, SEGMENTED_EVENT, getSegmentedTri, setSegmentedTri, setSegmentedCounts, setSegmentedItems } from "/static/kp/js/segmented.js";
import { attachToggles, toggle } from "/static/kp/js/toggle.js";
import { attachArt } from "/static/kp/js/art.js";
import { attachDisabledReasons } from "/static/kp/js/reason.js";
import { setCalm, isCalm } from "/static/kp/js/calm.js";
import { openRecordEditor, detailHref, sideName } from "../records/index.js";
import { t, nameOf } from "../i18n/index.js";
import { dmyDate, localIso, cap } from "../format.js";
import * as L from "./wheel/logic.js";
import { minutesWords } from "../i18n/minutes.js";

/** @typedef {import("./wheel/logic.js").Dish} Dish */
/** @typedef {import("./wheel/logic.js").Model} Model */

const mealLabels = () => /** @type {Record<string, string>} */ ({ breakfast: t("wheel.mealBreakfast"), lunch: t("wheel.mealLunch"), dinner: t("wheel.mealDinner") });
const bandLabels = () => /** @type {Record<string, string>} */ ({ quick: t("wheel.bandQuick"), mid: t("wheel.bandMid"), long: t("wheel.bandLong") });
const kindLabels = () => /** @type {Record<string, string>} */ ({ safe: t("wheel.kindSafe"), freezer: t("wheel.kindFreezer"), noprep: t("wheel.kindNoprep") });
const loadingWords = () => t("wheel.loading");

const minutesText = (/** @type {number} */ m) => minutesWords(m, "wheel.hm", "wheel.min");
/** @param {HTMLElement} root @param {{ params: URLSearchParams, navigate: (href: string) => void }} ctx */

/** The words the constraints are named with. @param {(id: string) => string | undefined} dishLabel @param {(v: string) => string} catName @returns {import("./wheel/logic.js").Words} */
const constraintWords = (dishLabel, catName) => ({
  meal: (v) => mealLabels()[v] ?? v,
  time: (v) => bandLabels()[v] ?? v,
  cat: catName,
  dish: (id) => dishLabel(id) ?? t("wheel.aDish"),
  kind: (k) => kindLabels()[k],
  with: (n) => t("wheel.with", n),
  without: (n) => t("wheel.without", n),
  not: (n) => t("wheel.not", n),
  resting: (n) => t("wheel.restingLabel", n),
  notCounting: (n) => t("wheel.notCounting", n.toLowerCase()),
  noEnergy: t("wheel.noEnergyLabel"),
});

export function mount(root, { navigate }) {
  document.title = `${t("wheel.title")} · Kitchen`;

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
  const M = L.newModel();
  /** @type {(() => void)[]} */
  const undo = [];
  let writing = false;
  /** Calm mode was switched on by the "No energy today" switch (so switching off puts it back only then). */
  let calmByUs = false;

  const odds = () => String(kitchen?.settings?.odds ?? "equal");
  const dinnerTime = () => L.dinnerTimeOf(kitchen?.settings?.dinner_time);

  function derive() {
    const k = kitchen;
    const freezer = (k?.freezer ?? []).filter((f) => Number(f.portions) > 0);
    restItems = L.restingByDish(k?.resting ?? []);
    M.resting = new Set(restItems.keys());
    dishes = (k?.dishes ?? []).map((d) => {
      const r = defaultRecipe(d);
      return L.dishFrom(d, r, { label: nameOf(d).text, days: k ? daysSinceCooked(k, d.id) : Infinity, freezer, recipeLabelOf: recipeLabel });
    });
  }
  const byId = (/** @type {string} */ id) => dishes.find((d) => d.id === id);
  /** A dish category's name in the language shown. @param {string} id */
  const catName = (id) => {
    const c = kitchen?.dish_categories.find((x) => x.id === id);
    return c ? nameOf(c).text : id;
  };

  // ---- what fits ------------------------------------------------------------------------------------------------------
  const onWheel = (/** @type {Model} */ m) => dishes.filter((d) => L.fits(d, m));
  const weight = (/** @type {Dish} */ d) => L.weightOf(d, odds());
  const bigger = (/** @type {Dish} */ d) => L.isBigger(d, odds());
  const words = constraintWords((id) => byId(id)?.label, (v) => catName(v));
  const constraints = (/** @type {Model} */ m) => L.constraintsOf(m, words);
  const filterCount = (/** @type {Model} */ m) => constraints(m).filter((c) => L.isFilterKey(c.key)).length;
  const blockText = (/** @type {Model} */ m) => {
    const all = constraints(m);
    return all.length ? t("wheel.noFitAll", all.map((c) => c.label).join(", ")) : t("wheel.noneLeft");
  };
  /** @param {string} key @param {boolean} on */
  const track = (key, on) => (M.order = L.tracked(M.order, key, on));
  const pickToLoosen = () => L.pickToLoosen(M, words, dishes);

  // ---- the markup, whole, from the first frame ---------------------------------------------------------------------------
  const chip = (/** @type {string} */ value, /** @type {string} */ label) =>
    `<button type="button" class="kp-segmented__item" data-value="${value}"><span class="kp-segmented__label">${label}</span></button>`;
  const chips = (/** @type {string} */ id, /** @type {string} */ labelId, /** @type {string} */ items) =>
    `<div class="kp-segmented kp-segmented--chips" data-kp-segmented="tri" data-kp-segmented-summary aria-labelledby="${labelId}" id="${id}">${items}</div>`;
  const card = (/** @type {string} */ id, /** @type {string} */ title, /** @type {string} */ badge, /** @type {string} */ body, /** @type {string} */ extra = "") => `
    <section class="kp-card wl-card dw-card ${extra}" id="${id}" data-kp-state="${status === "ready" ? "ready" : "loading"}" aria-labelledby="${id}-t" data-kp-loading-words="${loadingWords()}">
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
        <h1>${t("wheel.title")}</h1>
        <p>${t("wheel.intro")}</p>
      </header>

      <section class="wl-sec" id="wl-wheel" aria-labelledby="wl-h-wheel">
        <div class="wl-sec__head">
          <h2 id="wl-h-wheel">${t("wheel.secWheel")}</h2>
          <p>${t("wheel.secWheelText")}</p>
        </div>
        ${card("wl-card", t("wheel.cardTitle"), "data-wl-fitcount", t("wheel.cardBody"))}
      </section>

      <section class="wl-sec" id="wl-filters-sec" aria-labelledby="wl-h-filters">
        <div class="wl-sec__head">
          <h2 id="wl-h-filters">${t("wheel.secFilters")}</h2>
          <p>${t("wheel.secFiltersText")}</p>
        </div>
        <div class="kp-formgrid wl-filters" id="wl-filters">
          <div class="kp-formgrid__row">
            <p class="kp-formgrid__label wl-filters__name" id="wl-f-meal-l">${t("wheel.fMeal")}</p>
            <div class="kp-formgrid__control wl-filters__row" data-kp-formgrid-span="wide">
              ${chips("wl-f-meal", "wl-f-meal-l", Object.entries(mealLabels()).map(([v, l]) => chip(v, l)).join(""))}
            </div>
          </div>
          <div class="kp-formgrid__row">
            <p class="kp-formgrid__label wl-filters__name" id="wl-f-time-l">${t("wheel.fTime")}</p>
            <div class="kp-formgrid__control wl-filters__row" data-kp-formgrid-span="wide">
              ${chips("wl-f-time", "wl-f-time-l", Object.entries(bandLabels()).map(([v, l]) => chip(v, cap(l))).join(""))}
            </div>
          </div>
          <div class="kp-formgrid__row">
            <p class="kp-formgrid__label wl-filters__name" id="wl-f-ing-l">${t("wheel.fIng")}</p>
            <div class="kp-formgrid__control wl-filters__row" data-kp-formgrid-span="wide">
              ${chips("wl-f-ing", "wl-f-ing-l", L.FIRST_INGREDIENTS.map((v) => chip(v, cap(v))).join(""))}
            </div>
          </div>
          <div class="kp-formgrid__row">
            <p class="kp-formgrid__label wl-filters__name" id="wl-f-cat-l">${t("wheel.fCat")}</p>
            <div class="kp-formgrid__control wl-filters__row" data-kp-formgrid-span="wide">
              ${chips("wl-f-cat", "wl-f-cat-l", "")}
            </div>
          </div>
          <div class="kp-formgrid__row wl-filters__foot">
            <div class="kp-formgrid__control wl-filters__foot-cell" data-kp-formgrid-span="wide">
              <button type="button" class="kp-button kp-button--sm" id="wl-f-clear" disabled data-kp-disabled-reason="${t("wheel.nothingFiltered")}" title="${t("wheel.clearTitle")}">${t("wheel.clearAll")}</button>
              <p class="wl-live" role="status" id="wl-f-live"></p>
            </div>
          </div>
        </div>
        ${card("wl-fits", t("wheel.fitsTitle"), 'id="wl-fits-count"', t("wheel.fitsText"), "wl-card--list")}
      </section>

      <section class="wl-sec" id="wl-easy-sec" aria-labelledby="wl-h-easy">
        <div class="wl-sec__head">
          <h2 id="wl-h-easy">${t("wheel.secEasy")}</h2>
          <p>${t("wheel.secEasyText")}</p>
        </div>
        <div class="kp-formgrid wl-easy" id="wl-easy">
          <div class="kp-formgrid__row">
            <p class="kp-formgrid__label wl-filters__name wl-easy__name" id="wl-easy-l">${t("wheel.noEnergy")}</p>
            <div class="kp-formgrid__control" data-kp-formgrid-span="wide">
              <label class="kp-switch">
                <input class="kp-switch__input" type="checkbox" role="switch" id="wl-easy-switch" aria-labelledby="wl-easy-l" disabled />
                <span class="kp-switch__state" aria-hidden="true"></span>
                <span>${t("wheel.limit")}</span>
              </label>
            </div>
          </div>
          <div class="kp-formgrid__row">
            <p class="kp-formgrid__label wl-filters__name" id="wl-easy-says-l">${t("wheel.whatItDoes")}</p>
            <p class="kp-formgrid__control wl-easy__says" data-kp-formgrid-span="wide" aria-labelledby="wl-easy-says-l">${t("wheel.easySays")}</p>
          </div>
          <div class="kp-formgrid__row">
            <p class="kp-formgrid__label wl-filters__name" id="wl-easy-kinds-l">${t("wheel.whatCounts")}</p>
            <div class="kp-formgrid__control wl-filters__row" data-kp-formgrid-span="wide">
              <div class="kp-toggles" role="group" aria-labelledby="wl-easy-kinds-l" id="wl-easy-kinds" data-kp-toggle-group="easy" data-kp-toggle-mode="multi">
                ${Object.entries(kindLabels())
                  .map(
                    ([v, l]) =>
                      `<button type="button" class="kp-button" data-kp-toggle data-kp-look="chip" data-kp-pressed-mark="check" aria-pressed="true" data-kp-toggle-value="${v}" data-kp-count="loading" disabled data-kp-disabled-reason="${t("wheel.turnOnFirst")}">${l}</button>`,
                  )
                  .join("")}
              </div>
            </div>
          </div>
          <div class="kp-formgrid__row">
            <p class="kp-formgrid__label wl-filters__name" id="wl-easy-now-l">${t("wheel.rightNow")}</p>
            <p class="kp-formgrid__control wl-live" role="status" data-kp-formgrid-span="wide" id="wl-easy-live" aria-labelledby="wl-easy-now-l"></p>
          </div>
        </div>
      </section>
    </div>`;

  /** @param {string} id */
  const q = (id) => /** @type {HTMLElement} */ (root.querySelector(`#${id}`));
  const cardMain = q("wl-card");
  const cardList = q("wl-fits");
  const groups = { meal: q("wl-f-meal"), time: q("wl-f-time"), ing: q("wl-f-ing"), cat: q("wl-f-cat") };
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
    /** @type {ReturnType<typeof mountDishWheel> | null} the one wheel component, kind "wheel" only */
    let wheels = null;

    const say = (/** @type {string} */ text) => {
      if (kind === "wheel") part.live.textContent = text;
      else filtersLive.textContent = text;
    };

    if (kind === "wheel") {
      data.innerHTML = `
        <div class="wl-screen" data-wl="screen"></div>`;
      const screen = /** @type {HTMLElement} */ (data.querySelector('[data-wl="screen"]'));
      wheels = mountDishWheel(screen, {
        words: { dishKicker: t("wheel.tonightsWheel"), sideKicker: t("wheel.sideKicker"), sideFirst: t("wheel.sideFirst"), nothing: () => "", oneSide: (_d, side) => t("wheel.withSide", side) },
        onChange: (change) => onWheelChange(change),
      });
      /** @type {HTMLElement} */ (wheels.answer).innerHTML = `
          <div class="wl-result" role="group" aria-label="${t("wheel.answerLabel")}">
            <p class="wl-result__kicker" data-wl="kicker"></p>
            <p class="wl-result__name" data-wl="name"></p>
            <p class="wl-result__side" data-wl="sideline"></p>
            <div class="wl-result__facts" data-wl="facts"></div>
            <p class="wl-result__why" data-wl="why"></p>
            <p class="wl-result__timing" data-wl="timing"></p>
            <p class="wl-result__others" data-wl="others"></p>
            <div class="wl-actions">
              <div class="wl-action">
                <button type="button" class="kp-button kp-button--primary" data-wl="yes" disabled data-kp-disabled-reason="${t("wheel.spinFirst")}">${t("wheel.yes")}</button>
                <p>${t("wheel.yesSays")}</p>
              </div>
              <div class="wl-action">
                <button type="button" class="kp-button" data-wl="again" disabled data-kp-disabled-reason="${t("wheel.dishesLoading")}">${t("wheel.again")}</button>
                <p>${t("wheel.againSays")}</p>
              </div>
              <div class="wl-action">
                <button type="button" class="kp-button" data-wl="skip" disabled data-kp-disabled-reason="${t("wheel.spinFirstSkip")}">${t("wheel.skip")}</button>
                <p data-wl="skip-says"></p>
              </div>
            </div>
            <div class="wl-resting">
              <p class="wl-resting__label" data-wl="rest"></p>
              <div class="wl-resting__list" data-wl="resting"></div>
            </div>
            <p class="wl-live" role="status" data-wl="live"></p>
          </div>`;
      for (const el of data.querySelectorAll("[data-wl]")) part[/** @type {HTMLElement} */ (el).dataset.wl ?? ""] = /** @type {HTMLElement} */ (el);
      undo.push(() => wheels?.destroy(), attachDisabledReasons(cardEl));
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
      const now = new Date();
      const plan = L.startPlan(dinnerTime(), d.minutes, now.getHours() * 60 + now.getMinutes());
      return plan.ok ? t("wheel.startAt", plan.start, dinnerTime(), minutesText(d.minutes)) : t("wheel.tooSoon", dinnerTime(), plan.ready);
    };
    const lastCooked = (/** @type {Dish} */ d) => {
      const kind = L.lastCookedKind(d.days);
      return kind === "never" ? t("wheel.notCooked") : t("wheel.lastCooked", kind === "today" ? t("wheel.today") : kind === "yesterday" ? t("wheel.yesterday") : t("wheel.daysAgo", L.lastCookedDate(d.days), d.days));
    };
    const oddsLine = () =>
      ({
        equal: t("wheel.oddsEqual"),
        recency: t("wheel.oddsRecency", L.LONG_DAYS),
        freezer: t("wheel.oddsFreezer", L.LONG_DAYS),
      })[/** @type {"equal"} */ (odds())] ?? "";

    const paintAnswer = () => {
      if (!wheels) return;
      const d = chosen ? byId(chosen) : undefined;
      const loaded = status === "ready";
      part.facts.replaceChildren();
      if (!loaded) {
        part.kicker.textContent = status === "error" ? t("wheel.failedTitle") : t("wheel.loading");
        part.name.textContent = "";
        part.why.textContent = "";
        part.timing.textContent = "";
        part.others.replaceChildren();
      } else if (spinning) {
        part.kicker.textContent = t("wheel.turning");
        part.name.textContent = "…";
        part.why.textContent = t("wheel.holdOn");
        part.timing.textContent = "";
        part.others.replaceChildren();
      } else if (!d) {
        part.kicker.textContent = t("wheel.notChosen");
        part.name.textContent = items.length ? t("wheel.pressSpin") : t("wheel.nothingToSpin");
        part.facts.append(badgeOf(t("wheel.onWheel", items.length)));
        part.why.textContent = oddsLine();
        part.timing.textContent = t("wheel.timingHint");
        part.others.replaceChildren();
      } else {
        part.kicker.textContent = items.length === 1 ? t("wheel.onlyOne") : t("wheel.chose");
        part.name.textContent = d.label;
        for (const m of d.meals) part.facts.append(badgeOf(mealLabels()[m] ?? cap(m)));
        part.facts.append(badgeOf(d.recipe ? minutesText(d.minutes) : t("wheel.noRecipeBadge")));
        if (d.safe) part.facts.append(badgeOf(t("wheel.safeFavourite"), "success"));
        if (d.freezer > 0) part.facts.append(badgeOf(t("wheel.freezerPortions", d.freezer), "info"));
        if (d.prep === "none") part.facts.append(badgeOf(t("wheel.kindNoprep"), "success"));
        if (bigger(d)) part.facts.append(badgeOf(t("wheel.biggerSlice"), "warning"));
        part.why.textContent = `${lastCooked(d)} ${bigger(d) ? t("wheel.sliceBigger") : odds() === "equal" ? t("wheel.sliceSame") : t("wheel.sliceSmaller")}`;
        part.timing.textContent = d.recipe ? timingOf(d) : t("wheel.noRecipeTiming");
        // The dish's other recipes, each straight into cook mode (09:27).
        part.others.replaceChildren(...(d.others.length ? [t("wheel.otherRecipes"), " ", ...d.others.flatMap((o, i) => [i ? " · " : "", h("a", { href: `/cook?id=${encodeURIComponent(o.id)}&fresh=1` }, o.label)])] : []));
      }
      const idle = loaded && !spinning && !writing;
      const why = (/** @type {string} */ idleWhy) => (!loaded ? t("wheel.dishesLoading") : spinning ? t("wheel.wheelTurning") : writing ? t("wheel.saving") : idleWhy);
      setReason(part.yes, !d || !idle, why(t("wheel.spinFirst")));
      setReason(part.again, !idle || items.length < 2, why(t("wheel.nothingToSpinWhy")));
      setReason(part.skip, !d || !idle, why(t("wheel.spinFirstSkip")));
      const until = L.restUntil();
      part["skip-says"].textContent = t("wheel.skipSays", dmyDate(until));
      const rest = [...restItems.values()];
      part.rest.textContent = rest.length ? t("wheel.restingLabelList") : t("wheel.nothingResting");
      part.resting.replaceChildren(
        ...rest.map((item) => {
          const name = byId(item.dish_id)?.label ?? t("wheel.aDishCap");
          const until = new Date(`${item.until}T12:00:00`);
          const back = h("button", { type: "button", class: "kp-button kp-button--sm", title: t("wheel.bringBackTitle"), "aria-label": t("wheel.bringBackName", name) }, t("wheel.bringBack"));
          back.addEventListener("click", () => void bringBack(item, name));
          // Edit changes the last day it rests (Kenny, 24/10/2026 05:07: every item has full CRUD and its own page).
          const edit = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": t("wheel.changeRest", name) }, t("common.edit"));
          edit.addEventListener("click", () => openRecordEditor("resting", item));
          return h(
            "div",
            { class: "wl-rest" },
            h("span", { class: "wl-rest__name" }, h("a", { href: detailHref("resting", item.id) }, name)),
            h("span", { class: "wl-rest__until" }, Number.isNaN(until.getTime()) ? "" : dmyDate(until)),
            h("span", { class: "kp-row-actions" }, edit, back),
          );
        }),
      );
    };

    const paintList = () => {
      part.list.replaceChildren(
        ...items.map((id) => {
          const d = /** @type {Dish} */ (byId(id));
          const meta = `${d.recipe ? `${d.meals.map((m) => mealLabels()[m] ?? cap(m)).join(", ")} · ${minutesText(d.minutes)}` : t("wheel.noRecipeBadge")} · ${Number.isFinite(d.days) ? t("wheel.lastCookedShort", L.lastCookedDate(d.days)) : t("wheel.notCookedShort")}`;
          return h("li", { class: "wl-fit" }, h("span", { class: "wl-fit__text" }, h("b", null, d.label), h("span", null, meta)), h("span", { class: "wl-fit__tags" }, bigger(d) ? badgeOf(t("wheel.biggerSlice"), "warning") : null));
        }),
      );
    };

    /** The card's state follows the data and the model. */
    const syncCard = () => {
      const n = items.length;
      badge.textContent = status !== "ready" ? "" : kind === "list" ? t("wheel.nOfM", n, dishes.length) : t("wheel.dishCount", n);
      const none = status === "ready" && n === 0;
      const key = status === "ready" ? (none ? `empty:${dishes.length}:${blockText(M)}:${filterCount(M)}` : "ready") : `${status}:${failure}`;
      if (key === cardKey) return;
      cardKey = key;
      if (status === "loading") setCardState(cardEl, "loading", { words: loadingWords() });
      else if (status === "error") setCardState(cardEl, "error", { title: t("wheel.failedTitle"), text: failure });
      else if (none) {
        /** @type {HTMLElement[]} */
        const action = [];
        if (!dishes.length) {
          action.push(h("a", { class: "kp-button kp-button--primary kp-stateplate__action", href: "/dishes", title: t("wheel.openDishesTitle") }, t("wheel.openDishes")));
          setCardState(cardEl, "empty", { title: t("wheel.noDishes"), text: t("wheel.noDishesText"), action });
        } else {
          action.push(h("button", { type: "button", class: "kp-button kp-button--primary kp-stateplate__action", title: t("wheel.loosenTitle"), onclick: () => void loosenOne(say) }, t("wheel.loosen")));
          if (filterCount(M)) action.push(h("button", { type: "button", class: "kp-button kp-stateplate__action", title: t("wheel.clearTitle"), onclick: () => clearFilters() }, t("wheel.clearAll")));
          setCardState(cardEl, "empty", { title: t("wheel.noMatch"), text: `${blockText(M)} ${t("wheel.loosenAndBack")}`, action });
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
      if (status === "ready" && wheels) {
        const next = list.map((d) => ({ id: d.id, label: d.short, weight: weight(d), sides: sidesOf(d) }));
        const key = JSON.stringify(next);
        if (key !== shownKey) {
          shownKey = key;
          chosen = null;
          wheels.setDishes(next);
        }
      }
      paintAnswer();
    };

    /** The dish's sides by name, each one entry of the small wheel (js/records.js sideName). @param {Dish} d */
    const sidesOf = (d) => d.sides.map((s) => sideName(s)).filter(Boolean);
    /**
     * What the wheels did (the one component's events). The small wheel waits for the big one to stop on a dish with
     * two or more sides; the component does that, this says it in the answer column.
     * @param {import("/eten/dishwheel.js").DishChange} change
     */
    const onWheelChange = (change) => {
      if (change.phase === "turning") {
        spinning = true;
        chosen = null;
        part.sideline.textContent = "";
        paintAnswer();
      } else if (change.phase === "dish" || change.phase === "side-turning" || change.phase === "side") {
        if (change.phase === "dish") {
          spinning = false;
          chosen = change.dish?.id ?? null;
          paintAnswer();
          say(t("wheel.wheelChose", byId(/** @type {string} */ (chosen))?.label));
        }
        part.sideline.textContent = change.side ? t("wheel.withSide", change.side) : change.sides.length > 1 ? t("wheel.sideTurning") : "";
      }
    };
    if (wheels) {
      part.yes.addEventListener("click", () => {
        // The dish's recipe opens in cook mode; a dish without a recipe opens its own page, where the recipe is added.
        const d = chosen ? byId(chosen) : null;
        if (d) navigate(d.cookId ? `/cook?id=${encodeURIComponent(d.cookId)}&fresh=1` : `/dishes/${encodeURIComponent(d.id)}`);
      });
      part.again.addEventListener("click", () => void wheels?.spin());
      part.skip.addEventListener("click", () => void setAside());
    }

    async function setAside() {
      if (!chosen || writing) return;
      const d = byId(chosen);
      if (!d) return;
      const until = L.restUntil();
      writing = true;
      paintAnswer();
      try {
        await create("resting", { dish_id: d.id, until: localIso(until) });
        say(t("wheel.setAside", d.label, dmyDate(until)));
      } catch (e) {
        say(t("wheel.setAsideFailed", d.label, e instanceof Error ? e.message : String(e)));
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
        say(t("wheel.backOn", name));
      } catch (e) {
        say(t("wheel.bringBackFailed", name, e instanceof Error ? e.message : String(e)));
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
        say(t("wheel.letGoFailed", pick.label, e instanceof Error ? e.message : String(e)));
        return;
      }
    } else {
      pick.release();
      if (pick.key === "easy" || pick.key.startsWith("kind:")) paintEasy();
    }
    M.order = M.order.filter((k) => k !== pick.key);
    paintChips();
    const n = onWheel(M).length;
    say(t("wheel.letGo", pick.label, n));
  }

  function clearFilters() {
    M.meal = L.emptyTri();
    M.time = L.emptyTri();
    M.ing = L.emptyTri();
    M.cat = L.emptyTri();
    M.order = M.order.filter((k) => !L.isFilterKey(k));
    paintChips();
    filtersLive.textContent = t("wheel.allLetGo");
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
  let ingKey = L.FIRST_INGREDIENTS.join();
  let ingCounts = /** @type {Record<string, number>} */ ({});
  let catKey = "";
  function paintCounts() {
    const loading = status === "loading";
    for (const g of Object.values(groups)) g.toggleAttribute("aria-busy", loading);
    if (status === "error") return;
    if (status === "ready") {
      // The ingredient chips are the ingredients the dishes use, most used first.
      const shown = L.ingredientChips(dishes);
      ingCounts = L.countOf(dishes, "ing", shown);
      if (shown.join() !== ingKey) {
        ingKey = shown.join();
        setSegmentedItems(groups.ing, shown.map((v) => ({ value: v, label: cap(v), count: ingCounts[v] })));
        M.ing = getSegmentedTri(groups.ing);
        M.order = L.dropGone(M.order, "ing", shown);
      }
      setSegmentedCounts(groups.meal, L.countOf(dishes, "meal", Object.keys(mealLabels())));
      setSegmentedCounts(groups.time, L.countOf(dishes, "time", Object.keys(bandLabels())));
      setSegmentedCounts(groups.ing, ingCounts);
      // The category chips are the dish categories the dishes use, in their order (Kenny, 24/10/2026 09:17).
      const cats = L.categoryChips(kitchen?.dish_categories ?? [], dishes);
      const catCounts = L.countOf(dishes, "cat", cats);
      if (cats.join() !== catKey) {
        catKey = cats.join();
        setSegmentedItems(groups.cat, cats.map((v) => ({ value: v, label: catName(v), count: catCounts[v] })));
        M.cat = getSegmentedTri(groups.cat);
        M.order = L.dropGone(M.order, "cat", cats);
      }
      setSegmentedCounts(groups.cat, catCounts);
    }
  }
  function paintChips() {
    setSegmentedTri(groups.meal, M.meal);
    setSegmentedTri(groups.time, M.time);
    setSegmentedTri(groups.ing, M.ing);
    setSegmentedTri(groups.cat, M.cat);
    paintAll();
  }
  /** @param {"meal" | "time" | "ing" | "cat"} group */
  function readChips(group) {
    const now = getSegmentedTri(groups[group]);
    M.order = L.orderAfterChips(M.order, group, M[group], now);
    M[group] = now;
    paintAll();
  }
  for (const group of /** @type {const} */ (["meal", "time", "ing", "cat"])) {
    const on = () => readChips(group);
    groups[group].addEventListener(SEGMENTED_EVENT, on);
    undo.push(() => groups[group].removeEventListener(SEGMENTED_EVENT, on));
  }
  clearBtn.addEventListener("click", clearFilters);

  function describeFilters() {
    const all = constraints(M).filter((c) => L.isFilterKey(c.key));
    clearBtn.disabled = status !== "ready" || !all.length;
    clearBtn.setAttribute("data-kp-disabled-reason", status !== "ready" ? t("wheel.dishesLoading") : t("wheel.nothingFiltered"));
    if (status === "loading") filtersLive.textContent = t("wheel.loadingDot");
    else if (status === "error") filtersLive.textContent = t("wheel.failedFilter");
    else if (!all.length) filtersLive.textContent = t("wheel.nothingFilteredLive");
    else filtersLive.textContent = t("wheel.filterFit", all.map((c) => c.label).join(", "), onWheel(M).length, dishes.length);
  }

  // ---- No energy today --------------------------------------------------------------------------------------------------
  function paintEasy() {
    const ready = status === "ready";
    switchEl.disabled = !ready;
    switchEl.checked = M.easy;
    for (const b of kindButtons) {
      const tg = toggle(b);
      if (ready) tg?.setCount(dishes.filter((d) => L.isKind(d, b.dataset.kpToggleValue ?? "")).length);
      tg?.set(M.kinds.has(b.dataset.kpToggleValue ?? ""), { silent: true });
      /** @type {HTMLButtonElement} */ (b).disabled = !ready || !M.easy;
      b.setAttribute("data-kp-disabled-reason", ready ? t("wheel.turnOnFirst") : t("wheel.dishesLoading"));
    }
    const n = onWheel(M).length;
    easyLive.textContent =
      status === "loading"
        ? t("wheel.loadingDot")
        : status === "error"
          ? t("wheel.failedDot")
          : M.easy
            ? t("wheel.easyOn", n)
            : t("wheel.easyOff");
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
    for (const k of Object.keys(kindLabels())) track(`kind:${k}`, !M.kinds.has(k));
    paintAll();
  };
  switchEl.addEventListener("change", onSwitch);
  kindsEl.addEventListener("kp-toggle-changed", onKinds);
  undo.push(() => switchEl.removeEventListener("change", onSwitch), () => kindsEl.removeEventListener("kp-toggle-changed", onKinds));

  // ---- the whole screen, again, from the data and the model ------------------------------------------------------
  function paintAll() {
    derive();
    const body = root.querySelector("#wl-card-body");
    if (body) body.textContent = `${t("wheel.dinnerAt", dinnerTime())} ${t("wheel.cardBody")}`;
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
