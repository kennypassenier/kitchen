// The markup of the wheel page, whole, from the first frame: the wheel card, the filter chips and the list card, and the
// "No energy today" section. Every card starts in its loading state unless the kitchen is already there.

import { t } from "../../i18n/index.js";
import { cap } from "../../format.js";
import { FIRST_INGREDIENTS } from "./logic.js";
import { mealLabels, bandLabels, kindLabels, loadingWords } from "./labels.js";

const chip = (/** @type {string} */ value, /** @type {string} */ label) =>
  `<button type="button" class="kp-segmented__item" data-value="${value}"><span class="kp-segmented__label">${label}</span></button>`;
const chips = (/** @type {string} */ id, /** @type {string} */ labelId, /** @type {string} */ items) =>
  `<div class="kp-segmented kp-segmented--chips" data-kp-segmented="tri" data-kp-segmented-summary aria-labelledby="${labelId}" id="${id}">${items}</div>`;

/** @param {string} status @param {string} id @param {string} title @param {string} badge @param {string} body @param {string} [extra] */
const card = (status, id, title, badge, body, extra = "") => `
    <section class="kp-card wl-card dw-card ${extra}" id="${id}" data-kp-state="${status === "ready" ? "ready" : "loading"}" aria-labelledby="${id}-t" data-kp-loading-words="${loadingWords()}">
      <div class="kp-card__header">
        <h3 class="kp-card__title" id="${id}-t">${title}</h3>
        <div class="kp-card__actions"><span class="kp-badge" ${badge}></span></div>
      </div>
      <p class="kp-card__body" ${id === "wl-card" ? 'id="wl-card-body"' : ""}>${body}</p>
      <div class="kp-card__stage"><div class="kp-card__data"></div></div>
    </section>`;

/** A section's heading and its one sentence. @param {string} id @param {string} title @param {string} text */
const head = (id, title, text) => `
        <div class="wl-sec__head">
          <h2 id="${id}">${title}</h2>
          <p>${text}</p>
        </div>`;

/** One filter row: its name and its chips. @param {string} key @param {string} name @param {string} items */
const filterRow = (key, name, items) => `
          <div class="kp-formgrid__row">
            <p class="kp-formgrid__label wl-filters__name" id="wl-f-${key}-l">${name}</p>
            <div class="kp-formgrid__control wl-filters__row" data-kp-formgrid-span="wide">
              ${chips(`wl-f-${key}`, `wl-f-${key}-l`, items)}
            </div>
          </div>`;

/** @param {string} status */
function filtersSection(status) {
  const meals = Object.entries(mealLabels()).map(([v, l]) => chip(v, l)).join("");
  const bands = Object.entries(bandLabels()).map(([v, l]) => chip(v, cap(l))).join("");
  const ings = FIRST_INGREDIENTS.map((v) => chip(v, cap(v))).join("");
  return `
      <section class="wl-sec" id="wl-filters-sec" aria-labelledby="wl-h-filters">${head("wl-h-filters", t("wheel.secFilters"), t("wheel.secFiltersText"))}
        <div class="kp-formgrid wl-filters" id="wl-filters">${filterRow("meal", t("wheel.fMeal"), meals)}${filterRow("time", t("wheel.fTime"), bands)}${filterRow("ing", t("wheel.fIng"), ings)}${filterRow("cat", t("wheel.fCat"), "")}
          <div class="kp-formgrid__row wl-filters__foot">
            <div class="kp-formgrid__control wl-filters__foot-cell" data-kp-formgrid-span="wide">
              <button type="button" class="kp-button kp-button--sm" id="wl-f-clear" disabled data-kp-disabled-reason="${t("wheel.nothingFiltered")}" title="${t("wheel.clearTitle")}">${t("wheel.clearAll")}</button>
              <p class="wl-live" role="status" id="wl-f-live"></p>
            </div>
          </div>
        </div>
        ${card(status, "wl-fits", t("wheel.fitsTitle"), 'id="wl-fits-count"', t("wheel.fitsText"), "wl-card--list")}
      </section>`;
}

/** The kinds the "No energy today" switch counts, as pressed toggles. */
function kindToggles() {
  return Object.entries(kindLabels())
    .map(
      ([v, l]) =>
        `<button type="button" class="kp-button" data-kp-toggle data-kp-look="chip" data-kp-pressed-mark="check" aria-pressed="true" data-kp-toggle-value="${v}" data-kp-count="loading" disabled data-kp-disabled-reason="${t("wheel.turnOnFirst")}">${l}</button>`,
    )
    .join("");
}

function easySection() {
  return `
      <section class="wl-sec" id="wl-easy-sec" aria-labelledby="wl-h-easy">${head("wl-h-easy", t("wheel.secEasy"), t("wheel.secEasyText"))}
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
                ${kindToggles()}
              </div>
            </div>
          </div>
          <div class="kp-formgrid__row">
            <p class="kp-formgrid__label wl-filters__name" id="wl-easy-now-l">${t("wheel.rightNow")}</p>
            <p class="kp-formgrid__control wl-live" role="status" data-kp-formgrid-span="wide" id="wl-easy-live" aria-labelledby="wl-easy-now-l"></p>
          </div>
        </div>
      </section>`;
}

/** @param {string} status "loading" | "error" | "ready" */
export function pageHtml(status) {
  return `
    <div class="wl-page">
      <header class="wl-intro">
        <h1>${t("wheel.title")}</h1>
        <p>${t("wheel.intro")}</p>
      </header>

      <section class="wl-sec" id="wl-wheel" aria-labelledby="wl-h-wheel">${head("wl-h-wheel", t("wheel.secWheel"), t("wheel.secWheelText"))}
        ${card(status, "wl-card", t("wheel.cardTitle"), "data-wl-fitcount", t("wheel.cardBody"))}
      </section>
${filtersSection(status)}
${easySection()}
    </div>`;
}
