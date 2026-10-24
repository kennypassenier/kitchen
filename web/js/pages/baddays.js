// Bad days (/bad-days): the screen for a day with no energy. Five parts, each
// answering one question without asking for effort: which dishes always work,
// what is in the freezer, what can be eaten without cooking, how a recipe
// shrinks to its smallest version, and when things went in.
//
// Built as approved in kp-themes research/audhd-recepten/baddays (the zero-prep
// shelf as rebuilt in grid-fix). Every part draws loading, empty and failed at
// the footprint of the filled part, with the package's own components; a Try
// again reads the kitchen again for the whole screen. Data comes from api.js
// only; nothing is stored here but what api.js writes.

import { attachCardStates, setCardState } from "/static/kp/js/card-state.js";
import { attachActionTiles } from "/static/kp/js/action-tiles.js";
import { attachSegmented, setSegmentedCounts, setSegmentedValues } from "/static/kp/js/segmented.js";
import { attachDataTables, dataTable } from "/static/kp/js/datatable.js";
import { agoMoment, attachAgo } from "/static/kp/js/freshness.js";
import { undoToast } from "/static/kp/js/undo-toast.js";
import { toast } from "/static/kp/js/overlays.js";
import { attachFocusSteps, setFocusSteps, setFocusStepsState } from "/static/kp/js/focus-steps.js";
import {
  attachCalendars,
  calendarMonth,
  dayKey,
  setCalendarDays,
  setCalendarLegend,
  setCalendarState,
} from "/static/kp/js/calendar.js";
import { attachActionColumns } from "/static/kp/js/actions.js";
import { attachDatePickers, datePicker } from "/static/kp/js/datepicker.js";
import { attachQuantities } from "/static/kp/js/quantity.js";
import { attachForms, VALID_EVENT } from "/static/kp/js/forms.js";
import { attachLoadingPieces } from "/static/kp/js/loading-pieces.js";
import { attachMotion } from "/static/kp/js/motion.js";
import { create, daysSinceCooked, kitchenNow, loadKitchen, onKitchen, takePortions } from "../api.js";
import { h, $ } from "../dom.js";
import { openRecordEditor, deleteRecord, itemLink, openSafePicker, openRecipeEditor, unmarkSafe, ateShelf } from "../records.js";
import { t, lang, nameOf } from "../i18n/index.js";
import { attachSelects, drawnSelect } from "/static/kp/js/combobox.js";

/** @typedef {import("../api.js").Kitchen} Kitchen */
/** @typedef {import("../api.js").Item} Item */

const DAY = 86_400_000;
/** Days in the freezer before the quiet "Use these next" word shows. */
const OLD_AFTER_DAYS = 60;
/** How long Undo is offered after Take one portion (approved: 10 s, ring). */
const UNDO_MS = 10_000;

/** The page, whole; a function so the words are read when the page is mounted. */
const sections = () => `
  <header class="bd-intro">
    <h1>${t("bad.title")}</h1>
    <p>
      ${t("bad.intro")}
    </p>
  </header>

  <section class="bd-sec" id="safe-dishes" aria-labelledby="h-safe-dishes">
    <div class="bd-sec__head">
      <h2 id="h-safe-dishes">${t("bad.secSafe")}</h2>
      <p>
        ${t("bad.secSafeText")}
      </p>
    </div>
    <section class="kp-card bd-card" id="bd-safe-card" data-kp-state="loading" aria-labelledby="bd-safe-t"
      data-kp-loading-words="${t("bad.loadingSafe")}">
      <div class="kp-card__header">
        <h3 class="kp-card__title" id="bd-safe-t">${t("bad.safeTitle")}</h3>
        <div class="kp-card__actions"><span class="kp-timestamp" data-bd-safe-count></span><button type="button" class="kp-button kp-button--primary" data-bd-safe-add>${t("bad.addSafe")}</button></div>
      </div>
      <p class="kp-card__body">${t("bad.safeBody")}</p>
      <div class="kp-card__stage">
        <div class="kp-card__data">
          <ul class="kp-actions bd-safe" data-kp-action-size="large" aria-label="${t("bad.safeLabel")}" data-bd-safe></ul>
        </div>
      </div>
    </section>
  </section>

  <section class="bd-sec" id="freezer" aria-labelledby="h-freezer">
    <div class="bd-sec__head">
      <h2 id="h-freezer">${t("bad.secFreezer")}</h2>
      <p>
        ${t("bad.secFreezerText")}
      </p>
    </div>
    <div class="bd-freezer" data-bd-freezer>
      <div class="kp-datatable" id="bd-freezer" data-kp-datatable data-kp-cards data-kp-page-sizes="none"
        data-kp-key="freezer" data-kp-state="loading" data-kp-busy-overlay>
        <div class="kp-datatable__bar">
          <input class="kp-datatable__search" data-kp-datatable-search type="search" aria-label="${t("bad.findLabel")}"
            placeholder="${t("bad.findPh")}" />
          <p class="kp-datatable__status" data-kp-datatable-status role="status" aria-live="polite"></p>
        </div>
        <div class="kp-table-wrap">
          <table class="kp-table">
            <caption class="kp-sr-only">${t("bad.caption")}</caption>
            <thead>
              <tr>
                <th scope="col" data-kp-sort="text">${t("bad.colDish")}</th>
                <th scope="col" data-kp-sort="number">${t("bad.colPortions")}</th>
                <th scope="col" data-kp-sort="number">${t("bad.colFrozen")}</th>
                <th scope="col">${t("bad.colHow")}</th>
                <th scope="col">${t("bad.colHint")}</th>
                <th scope="col"><span class="kp-sr-only">${t("bad.colAction")}</span></th>
              </tr>
            </thead>
            <tbody data-bd-rows></tbody>
          </table>
        </div>
        <div class="kp-empty" data-kp-art="none" data-kp-art-size="lg" data-kp-datatable-empty hidden>
          <p class="kp-empty__title" data-kp-datatable-empty-none>${t("bad.freezerEmptyTitle")}</p>
          <p class="kp-empty__body" data-kp-datatable-empty-none>
            ${t("bad.freezerEmptyText")}
          </p>
          <button type="button" class="kp-button kp-button--primary" data-kp-datatable-empty-none data-bd-add>
            ${t("bad.addToday")}
          </button>
          <p class="kp-empty__title" data-kp-datatable-empty-nomatch>${t("bad.noMatchTitle")}</p>
          <p class="kp-empty__body" data-kp-datatable-empty-nomatch>${t("bad.noMatchText")}</p>
          <button type="button" class="kp-button" data-kp-datatable-empty-nomatch data-kp-datatable-clear>${t("bad.clearSearch")}</button>
        </div>
        <div class="kp-alert kp-alert--destructive" data-kp-datatable-failed role="alert" hidden>
          <p data-kp-datatable-failed-reason>${t("bad.freezerFailed")}</p>
          <button type="button" class="kp-button" data-kp-datatable-retry>${t("common.tryAgain")}</button>
        </div>
      </div>
    </div>
    <div class="bd-add">
      <div class="bd-sec__head">
        <h3 id="h-freezer-add">${t("bad.addTitle")}</h3>
        <p>${t("bad.addText")}</p>
      </div>
      <form class="bd-add__form" data-kp-form data-bd-add-form novalidate aria-labelledby="h-freezer-add">
        <div class="kp-form__summary" data-kp-form-summary tabindex="-1" hidden></div>
        <div class="kp-formgrid" data-kp-formgrid-lines="lines">
        <div class="kp-formgrid__row" data-bd-dish-row>
          <label class="kp-formgrid__label" for="bd-add-dish">${t("bad.colDish")}</label>
          <div class="kp-formgrid__control">
            <input class="kp-field__input" id="bd-add-dish" name="dish" type="text" autocomplete="off"
              aria-describedby="bd-add-dish-note" />
          </div>
          <p class="kp-formgrid__value" id="bd-add-dish-note" role="status" aria-live="polite" data-bd-dish-note>${t("bad.dishHint")}</p>
        </div>
        <div class="kp-formgrid__row">
          <label class="kp-formgrid__label" for="bd-add-from">${t("rec.dishLink")}</label>
          <div class="kp-formgrid__control">
            <select class="kp-field__input" id="bd-add-from" data-bd-from><option value="">${t("rec.noDish")}</option></select>
          </div>
          <p class="kp-formgrid__value">${t("rec.dishLinkHint")}</p>
        </div>
        <div class="kp-formgrid__row">
          <label class="kp-formgrid__label" for="bd-add-portions">${t("bad.colPortions")}</label>
          <div class="kp-formgrid__control">
            <div class="kp-quantity kp-formgrid__short" data-kp-quantity data-kp-quantity-min="1" data-kp-quantity-max="24"
              data-kp-quantity-unit="${t("bad.unitMany")}" data-kp-quantity-unit-one="${t("bad.unitOne")}" data-kp-quantity-label="${t("bad.colPortions")}" data-bd-portions>
              <input class="kp-quantity__input" id="bd-add-portions" value="2" />
            </div>
          </div>
          <p class="kp-formgrid__value">${t("bad.portionsHint")}</p>
        </div>
        <div class="kp-formgrid__row" data-bd-date-row>
          <label class="kp-formgrid__label" for="bd-add-date">${t("bad.colFrozen")}</label>
          <div class="kp-formgrid__control">
            <div class="kp-datepicker" data-kp-datepicker lang="${lang() === "nl" ? "nl-BE" : "en-GB"}" data-bd-date>
              <input class="kp-field__input" id="bd-add-date" type="text" inputmode="numeric" data-kp-date-input
                aria-describedby="bd-add-date-note" />
              <button type="button" class="kp-button" data-kp-date-open aria-label="${t("bad.openCalendar")}" title="${t("bad.openCalendar")}">
                <span aria-hidden="true">&#9638;</span>
              </button>
              <div class="kp-datepicker__panel" data-kp-date-panel hidden></div>
            </div>
          </div>
          <p class="kp-formgrid__value" id="bd-add-date-note" role="status" aria-live="polite" data-bd-date-note>${t("bad.dateHint")}</p>
        </div>
        <div class="kp-formgrid__row kp-formgrid__row--buttons">
          <div class="kp-formgrid__control">
            <button type="submit" class="kp-button kp-button--primary" data-kp-submit data-bd-add-submit>${t("bad.addSubmit")}</button>
          </div>
        </div>
        </div>
      </form>
    </div>
  </section>

  <section class="bd-sec" id="zero-prep" aria-labelledby="h-zero-prep">
    <div class="bd-sec__head">
      <h2 id="h-zero-prep">${t("bad.secShelf")}</h2>
      <p>
        ${t("bad.secShelfText")}
      </p>
    </div>
    <section class="kp-card bd-card" id="bd-shelf-card" data-kp-state="loading" aria-labelledby="bd-shelf-t"
      data-kp-loading-words="${t("bad.loadingShelf")}">
      <div class="kp-card__header">
        <h3 class="kp-card__title" id="bd-shelf-t">${t("bad.shelfTitle")}</h3>
        <div class="kp-card__actions">
          <div class="kp-segmented" data-kp-segmented="single" role="radiogroup" aria-label="${t("bad.levelLabel")}" data-bd-level>
            <button type="button" class="kp-segmented__item" role="radio" aria-checked="false" data-value="open">
              <span class="kp-segmented__label">${t("rec.energyOpen")}</span><span class="kp-segmented__count"></span>
            </button>
            <button type="button" class="kp-segmented__item" role="radio" aria-checked="false" data-value="easy">
              <span class="kp-segmented__label">${t("rec.energyEasy")}</span><span class="kp-segmented__count"></span>
            </button>
            <button type="button" class="kp-segmented__item" role="radio" aria-checked="true" data-value="any">
              <span class="kp-segmented__label">${t("rec.energyAny")}</span><span class="kp-segmented__count"></span>
            </button>
          </div>
          <button type="button" class="kp-button kp-button--primary" data-bd-shelf-add>${t("bad.addFood")}</button>
        </div>
      </div>
      <p class="kp-card__body">${t("bad.shelfBody")}</p>
      <div class="kp-card__stage">
        <div class="kp-card__data">
          <ul class="kp-action-list kp-action-list--lead bd-shelf" aria-label="${t("bad.shelfLabel")}" data-bd-shelf></ul>
        </div>
      </div>
      <div class="kp-card__footer"><p class="bd-readout" role="status" data-bd-shelf-readout>${t("bad.shelfReadout")}</p></div>
    </section>
  </section>

  <section class="bd-sec" id="mini-recipe" aria-labelledby="h-mini-recipe">
    <div class="bd-sec__head">
      <h2 id="h-mini-recipe">${t("bad.secMini")}</h2>
      <p>
        ${t("bad.secMiniText")}
      </p>
    </div>
    <div class="bd-mini">
      <div class="bd-mini__head">
        <h3 class="bd-mini__title" data-bd-mini-title>${t("bad.miniDefault")}</h3>
        <div class="kp-segmented" data-kp-segmented="single" role="radiogroup" aria-label="${t("bad.versionLabel")}" data-bd-version>
          <button type="button" class="kp-segmented__item" role="radio" aria-checked="true" data-value="mini">
            <span class="kp-segmented__label">${t("bad.miniVersion")}</span>
          </button>
          <button type="button" class="kp-segmented__item" role="radio" aria-checked="false" data-value="full">
            <span class="kp-segmented__label">${t("bad.fullRecipe")}</span>
          </button>
        </div>
        <a class="kp-button kp-button--primary bd-mini__cook" aria-disabled="true" data-bd-cook>${t("bad.cookThis")}</a>
      </div>
      <p class="kp-lede bd-mini__lede" data-bd-mini-lede></p>
      <div class="kp-focus-steps bd-mini__steps" data-kp-focus-steps aria-label="${t("bad.miniLabel")}" data-bd-steps
        data-kp-focus-steps-empty="${t("bad.noSteps")}"></div>
    </div>
  </section>

  <section class="bd-sec" id="freezer-month" aria-labelledby="h-freezer-month">
    <div class="bd-sec__head">
      <h2 id="h-freezer-month">${t("bad.secMonth")}</h2>
      <p>
        ${t("bad.secMonthText")}
      </p>
    </div>
    <div class="bd-calwrap">
      <section class="kp-calendar kp-calendar--busy-whole" id="bd-cal" data-kp-calendar data-kp-tones="calm"
        aria-label="${t("bad.calLabel")}"></section>
    </div>
  </section>
`;

/** "YYYY-MM-DD" as dd/mm/yyyy. @param {string} iso */
const dmy = (iso) => iso.slice(0, 10).split("-").reverse().join("/");

/** The first sentence of a text. @param {string} text */
const firstSentence = (text) => (text.trim().match(/^.+?[.!?](?=\s|$)/) ?.[0] ?? text.trim());

/** When a kitchen item was frozen, in ms. @param {Item} item */
const frozenAt = (item) => Date.parse(item.frozen_on);

/** The word for an error: api.js messages are fit to show as they are. @param {unknown} e */
const reason = (e) => (e instanceof Error ? e.message : String(e));

/** The newest log date of a recipe as "YYYY-MM-DD", or null. @param {Kitchen} k @param {string} id */
function lastMade(k, id) {
  let last = "";
  for (const e of k.log) if (e.recipe_id === id && e.date > last) last = e.date;
  return last || null;
}

/** The safe recipes, by name: tiles never reorder. @param {Kitchen} k */
const safeRecipes = (k) =>
  k.recipes.filter((r) => r.safe === true).sort((a, b) => String(a.name).localeCompare(String(b.name), "en"));

/** The safe recipe with steps that was cooked longest ago (never counts as longest). @param {Kitchen} k */
function miniRecipe(k) {
  const withSteps = safeRecipes(k).filter((r) => Array.isArray(r.steps) && r.steps.length > 0);
  let best = null;
  let bestDays = -1;
  for (const r of withSteps) {
    const days = daysSinceCooked(k, r.id);
    if (days > bestDays) {
      best = r;
      bestDays = days;
    }
  }
  return best;
}

/** A recipe's steps as focus-steps wants them. @param {Item[]} steps */
const toFocusSteps = (steps) =>
  steps.map((s) => ({
    id: s.id,
    text: s.text,
    ...(s.uses?.length ? { ingredients: s.uses.map((/** @type {Item} */ u) => ({ amount: u.amount, name: u.name })) } : {}),
    ...(s.timer ? { timer: { seconds: s.timer.seconds, name: s.timer.name } } : {}),
    ...(s.note ? { note: s.note, noteTone: s.note_tone === "warning" ? "warning" : "info" } : {}),
  }));

/**
 * @param {HTMLElement} root
 * @param {{ params: URLSearchParams, navigate: (href: string) => void }} ctx
 * @returns {() => void}
 */
export function mount(root, { navigate }) {
  document.title = `${t("nav.baddays")} · Kitchen`;
  const page = h("div", { class: "bd-page" });
  page.innerHTML = sections();
  root.replaceChildren(page);

  /** @type {(() => void)[]} */
  const stops = [];
  let alive = true;
  for (const attach of [
    attachCardStates,
    attachActionTiles,
    attachSegmented,
    attachDataTables,
    attachAgo,
    attachFocusSteps,
    attachCalendars,
    attachActionColumns,
    attachDatePickers,
    attachQuantities,
    attachSelects,
    attachLoadingPieces,
    attachMotion,
  ]) {
    const stop = /** @type {unknown} */ (attach(page));
    if (typeof stop === "function") stops.push(/** @type {() => void} */ (stop));
  }

  // ---- the parts
  const safeCard = /** @type {HTMLElement} */ ($("#bd-safe-card", page));
  const safeList = /** @type {HTMLElement} */ ($("[data-bd-safe]", page));
  const safeCount = /** @type {HTMLElement} */ ($("[data-bd-safe-count]", page));
  const freezerTable = /** @type {HTMLElement} */ ($("#bd-freezer", page));
  const rows = /** @type {HTMLElement} */ ($("[data-bd-rows]", page));
  const shelfCard = /** @type {HTMLElement} */ ($("#bd-shelf-card", page));
  const shelfList = /** @type {HTMLElement} */ ($("[data-bd-shelf]", page));
  const shelfLevel = /** @type {HTMLElement} */ ($("[data-bd-level]", page));
  const shelfReadout = /** @type {HTMLElement} */ ($("[data-bd-shelf-readout]", page));
  const miniTitle = /** @type {HTMLElement} */ ($("[data-bd-mini-title]", page));
  const miniVersion = /** @type {HTMLElement} */ ($("[data-bd-version]", page));
  const miniLede = /** @type {HTMLElement} */ ($("[data-bd-mini-lede]", page));
  const miniSteps = /** @type {HTMLElement} */ ($("[data-bd-steps]", page));
  const cook = /** @type {HTMLAnchorElement} */ ($("[data-bd-cook]", page));
  const cal = /** @type {HTMLElement} */ ($("#bd-cal", page));

  /** What each part was last drawn from, to leave a part alone when its data did not change. @type {Record<string, string | null>} */
  const drawn = { safe: null, freezer: null, shelf: null, mini: null, month: null };

  // ---- loading and failed, for every part at once
  const table = () => dataTable(freezerTable);

  function loading() {
    for (const key of Object.keys(drawn)) drawn[key] = null;
    setCardState(safeCard, "loading");
    setCardState(shelfCard, "loading");
    const tb = table();
    tb?.busy({ text: t("bad.loadingFreezer"), since: Date.now(), overlay: true });
    tb?.state("loading");
    setFocusStepsState(miniSteps, "loading", t("bad.loadingRecipe"));
    setCalendarState(cal, "loading", t("bad.loadingMonth"));
    setCook(null);
    setSegmentedDisabled(miniVersion, true);
  }

  /** @param {unknown} e */
  function failed(e) {
    const why = reason(e);
    for (const key of Object.keys(drawn)) drawn[key] = null;
    setCardState(safeCard, "error", { title: t("bad.safeFailed"), text: `${why} ${t("bad.stillSaved")}` });
    setCardState(shelfCard, "error", { title: t("bad.shelfFailed"), text: `${why} ${t("bad.nothingChanged")}` });
    table()?.fail(`${t("bad.freezerFailed")} ${why} ${t("bad.stillCounted")}`);
    setFocusStepsState(miniSteps, "error", `${t("bad.recipeFailed")} ${why}`);
    setCalendarState(cal, "error", `${t("bad.monthFailed")} ${t("bad.nothingChanged")}`);
    setCook(null);
  }

  function reload() {
    loading();
    loadKitchen({ force: true }).then(
      (k) => alive && render(k),
      (e) => alive && failed(e),
    );
  }

  // ---- 1 · safe dishes
  /** @param {Kitchen} k */
  function renderSafe(k) {
    const dishes = safeRecipes(k);
    const signature = JSON.stringify(dishes.map((r) => [r.id, r.name, r.summary, r.minutes, r.gear, lastMade(k, r.id)]));
    if (signature === drawn.safe) return;
    drawn.safe = signature;
    safeCount.textContent = t("bad.dishCount", dishes.length);
    if (!dishes.length) {
      const pick = h("button", { type: "button", class: "kp-button kp-button--primary" }, t("bad.addSafe"));
      pick.addEventListener("click", () => openSafePicker());
      setCardState(safeCard, "empty", {
        title: t("bad.noSafe"),
        text: t("bad.noSafeText"),
        action: pick,
      });
      return;
    }
    safeList.replaceChildren(
      ...dishes.map((r) => {
        const made = lastMade(k, r.id);
        const text = r.summary ? firstSentence(String(r.summary)) : t("bad.takesAbout", r.minutes, r.gear);
        const edit = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": t("rec.editName", r.name) }, t("common.edit"));
        const unsafe = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": t("bad.notSafeName", r.name) }, t("bad.notSafe"));
        edit.addEventListener("click", () => openRecipeEditor(r));
        unsafe.addEventListener("click", () => unmarkSafe(r));
        return h(
          "li",
          { class: "bd-safe__item" },
          h(
            "a",
            { class: "kp-action", href: `/recipe?id=${encodeURIComponent(r.id)}` },
            h("strong", { class: "kp-action__title" }, r.name),
            h("span", { class: "kp-action__mark", "aria-hidden": "true" }),
            h("span", { class: "kp-action__text" }, text),
            h(
              "span",
              { class: "kp-action__meta" },
              h("span", null, `${r.minutes} min, ${r.gear}`),
              h("span", null, made ? t("bad.lastMade", dmy(made)) : t("bad.notMade")),
            ),
          ),
          h("div", { class: "kp-row-actions" }, edit, unsafe),
        );
      }),
    );
    setCardState(safeCard, "ready");
  }

  // ---- 2 · the freezer
  /** @param {Item} item */
  function freezerRow(item) {
    const at = frozenAt(item);
    const old = (Date.now() - at) / DAY >= OLD_AFTER_DAYS;
    const tr = h("tr", { "data-key": item.id });
    tr.append(
      h("td", null, h("strong", null, itemLink("freezer", item))),
      h("td", { "data-kp-sort-value": String(item.portions) }, String(item.portions)),
      h("td", { "data-kp-sort-value": String(at) }, agoMoment(at).slice(0, 10)),
      h("td", null, h("time", { class: "kp-ago", "data-kp-ago": "", "data-kp-ago-verb": t("bad.frozenVerb"), datetime: new Date(at).toISOString() }, "")),
      h(
        "td",
        null,
        h(
          "span",
          old ? { class: "kp-badge bd-hint" } : { class: "kp-badge bd-hint bd-hint--none", "aria-hidden": "true" },
          old ? t("bad.useNext") : t("bad.fine"),
        ),
      ),
      h(
        "td",
        null,
        h(
          "div",
          { class: "kp-row-actions" },
          h(
            "button",
            { type: "button", class: "kp-button kp-button--sm", "data-bd-take": item.id, "aria-label": t("bad.takeName", item.dish) },
            t("bad.takeOne"),
          ),
          h("button", { type: "button", class: "kp-button kp-button--sm", "data-bd-edit": item.id, "aria-label": t("rec.editName", item.dish) }, t("common.edit")),
          h("button", { type: "button", class: "kp-button kp-button--sm kp-button--destructive", "data-bd-delete": item.id, "aria-label": t("rec.deleteName", item.dish) }, t("common.delete")),
        ),
      ),
    );
    return tr;
  }

  /** @param {Kitchen} k */
  function renderFreezer(k) {
    const items = k.freezer.filter((f) => f.portions > 0).sort((a, b) => frozenAt(a) - frozenAt(b));
    const signature = JSON.stringify(items.map((f) => [f.id, f.dish, f.portions, f.frozen_on]));
    if (signature === drawn.freezer) return;
    const first = drawn.freezer === null;
    drawn.freezer = signature;
    const tb = table();
    // The table reconciles its own rows on refresh (kp-themes 6f9301bc): write the fresh rows, ask it to re-read them.
    rows.replaceChildren(...items.map(freezerRow));
    tb?.refresh({ keepPage: true });
    if (first) {
      tb?.state("ready");
      tb?.sort({ column: 2, direction: "ascending" });
    }
  }

  // Edit and Delete of a freezer row: the shared drawer and the typed-name confirmation (js/records.js).
  rows.addEventListener("click", (event) => {
    const el = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest("[data-bd-edit], [data-bd-delete]")) : null;
    if (!el) return;
    const id = el.getAttribute("data-bd-edit") ?? el.getAttribute("data-bd-delete");
    const item = kitchenNow()?.freezer.find((f) => f.id === id);
    if (!item) return;
    if (el.hasAttribute("data-bd-edit")) openRecordEditor("freezer", item);
    else deleteRecord(el, "freezer", item);
  });
  rows.addEventListener("click", async (event) => {
    const button = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest("[data-bd-take]")) : null;
    if (!button || button.getAttribute("aria-disabled") === "true") return;
    const id = button.getAttribute("data-bd-take") ?? "";
    const dish = kitchenNow()?.freezer.find((f) => f.id === id)?.dish ?? t("bad.theDish");
    button.setAttribute("aria-disabled", "true");
    try {
      const after = await takePortions(id, 1);
      undoToast(
        after.portions < 1 ? t("bad.tookLast", dish) : t("bad.took", after.portions, dish),
        {
          mode: "revert",
          ms: UNDO_MS,
          clock: "ring",
          max: 2,
          undo: async () => {
            try {
              await takePortions(id, -1);
            } catch (e) {
              toast(t("rec.notBack", reason(e)), { live: "assertive", sticky: true });
            }
          },
        },
      );
    } catch (e) {
      toast(t("bad.takeFailed", dish, reason(e)), { live: "assertive", sticky: true });
    } finally {
      button.removeAttribute("aria-disabled");
    }
  });

  // The empty freezer's one action: the add form below.
  freezerTable.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest("[data-bd-add]")) return;
    const field = /** @type {HTMLInputElement | null} */ ($("#bd-add-dish", page));
    field?.scrollIntoView({ block: "center" });
    field?.focus();
  });
  freezerTable.addEventListener("kp-datatable-retry", reload);

  // The add form: a real freezer gets filled.
  const form = /** @type {HTMLFormElement} */ ($("[data-bd-add-form]", page));
  const dishField = /** @type {HTMLInputElement} */ ($("#bd-add-dish", page));
  // Which of Kenny's dishes it is (Kenny, 24/10/2026 09:17): the wheel counts its portions for that dish. Picking one
  // with the name field still empty fills it in.
  const fromField = /** @type {HTMLSelectElement} */ ($("[data-bd-from]", page));
  const fillDishes = () => {
    const was = fromField.value;
    fromField.replaceChildren(
      h("option", { value: "" }, t("rec.noDish")),
      ...[...(kitchenNow()?.dishes ?? [])].map((d) => [d.id, nameOf(d).text]).sort((a, b) => a[1].localeCompare(b[1])).map(([id, n]) => h("option", { value: id }, n)),
    );
    fromField.value = was;
    drawnSelect(fromField)?.refresh();
  };
  fromField.addEventListener("change", () => {
    const d = kitchenNow()?.dishes.find((x) => x.id === fromField.value);
    if (d && !dishField.value.trim()) dishField.value = nameOf(d).text;
  });
  stops.push(onKitchen(() => alive && fillDishes()));
  fillDishes();
  const dishRow = /** @type {HTMLElement} */ ($("[data-bd-dish-row]", page));
  const dishNote = /** @type {HTMLElement} */ ($("[data-bd-dish-note]", page));
  const dateInput = /** @type {HTMLInputElement} */ ($("#bd-add-date", page));
  const dateRow = /** @type {HTMLElement} */ ($("[data-bd-date-row]", page));
  const dateNote = /** @type {HTMLElement} */ ($("[data-bd-date-note]", page));
  const portionsInput = /** @type {HTMLInputElement} */ ($("#bd-add-portions", page));
  const picker = /** @type {HTMLElement} */ ($("[data-bd-date]", page));
  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Brussels" });
  picker.setAttribute("data-kp-max", todayIso);
  const setToday = () => datePicker(picker)?.set(todayIso);
  setToday();
  if (!dateInput.value) dateInput.value = dmy(todayIso);

  /** @param {HTMLElement} row @param {HTMLElement} note @param {string | null} message @param {string} plain */
  const mark = (row, note, message, plain) => {
    if (message) row.setAttribute("data-kp-state", "error");
    else row.removeAttribute("data-kp-state");
    note.textContent = message ?? plain;
  };
  dishField.addEventListener("input", () => {
    dishField.removeAttribute("aria-invalid");
    mark(dishRow, dishNote, null, t("bad.dishHint"));
  });
  dateInput.addEventListener("input", () => {
    dateInput.removeAttribute("aria-invalid");
    mark(dateRow, dateNote, null, t("bad.dateHint"));
  });
  // The package form owns the submit: it checks validity, lists what is wrong in its summary, makes the button busy and
  // fires VALID_EVENT. This listener runs first and turns the page's own rules into the browser's validity.
  const DISH_WRONG = t("bad.dishWrong");
  const DATE_WRONG = t("bad.dateWrong");
  form.addEventListener("submit", (event) => {
    // The package's form fires its valid event and leaves the browser's own submit running, which reloaded the page
    // (a GET to /bad-days?dish=…) before the save went out: since 1.0.0 nothing was ever added (found 24/10/2026).
    event.preventDefault();
    const dish = dishField.value.trim();
    const picked = datePicker(picker)?.get() ?? null;
    dishField.setCustomValidity(dish ? "" : DISH_WRONG);
    dateInput.setCustomValidity(picked && picked.getTime() <= Date.now() + DAY ? "" : DATE_WRONG);
    mark(dishRow, dishNote, dish ? null : DISH_WRONG, t("bad.dishHint"));
    mark(dateRow, dateNote, dateInput.validationMessage || null, t("bad.dateHint"));
  });
  dishField.addEventListener("input", () => dishField.setCustomValidity(""));
  dateInput.addEventListener("input", () => dateInput.setCustomValidity(""));
  const stopForms = attachForms(page, { wrapper: ".kp-formgrid__row", validateOn: "submit", revalidateOn: "none" });
  stops.push(stopForms);
  form.addEventListener(VALID_EVENT, async (event) => {
    const { done } = /** @type {CustomEvent<{ done: () => void }>} */ (event).detail;
    const dish = dishField.value.trim();
    const portions = Math.round(Number(portionsInput.value.replace(",", ".")));
    const picked = /** @type {Date} */ (datePicker(picker)?.get());
    const sameDay = picked.toLocaleDateString("en-CA") === new Date().toLocaleDateString("en-CA");
    const when = sameDay ? new Date() : new Date(picked.getFullYear(), picked.getMonth(), picked.getDate(), 12, 0, 0);
    try {
      await create("freezer", {
        dish,
        dish_id: fromField.value || null,
        portions: Math.max(1, Number.isFinite(portions) ? portions : 1),
        frozen_on: when.toISOString(),
      });
      toast(t("bad.added", dish), { ms: 4000 });
      dishField.value = "";
      setToday();
      dishField.focus();
    } catch (e) {
      toast(t("bad.addFailed", dish, reason(e)), { live: "assertive", sticky: true });
    } finally {
      done();
    }
  });

  // ---- 3 · the zero-prep shelf
  /** @type {Item[]} */
  let shelfItems = [];
  /** @type {"open" | "easy" | "any"} */
  let level = "any";
  const LEVELS = { open: ["open"], easy: ["open", "easy"], any: ["open", "easy", "any"] };

  function drawShelf() {
    const shown = shelfItems.filter((s) => LEVELS[level].includes(s.energy));
    if (!shelfItems.length) {
      const go = h("button", { type: "button", class: "kp-button kp-button--primary" }, t("bad.addFood"));
      go.addEventListener("click", () => openRecordEditor("shelf", null));
      setCardState(shelfCard, "empty", {
        title: t("bad.shelfEmpty"),
        text: t("bad.shelfEmptyText"),
        action: go,
      });
      return;
    }
    if (!shown.length) {
      const all = h("button", { type: "button", class: "kp-button kp-button--primary" }, t("bad.showAll"));
      all.addEventListener("click", () => setSegmentedValues(shelfLevel, ["any"]));
      setCardState(shelfCard, "empty", {
        title: t("bad.littleTitle"),
        text: t("bad.littleText"),
        action: all,
      });
      return;
    }
    shelfList.replaceChildren(
      ...shown.map((s) =>
        h(
          "li",
          { "data-key": s.id },
          h("span", { class: "kp-action-list__lead" }, h("span", { class: "kp-badge" }, `${s.minutes} min`)),
          h(
            "div",
            { class: "kp-action-list__main" },
            h("strong", { class: "kp-action-list__title" }, itemLink("shelf", s)),
            h("span", { class: "kp-action-list__text" }, s.text),
            h("span", { class: "kp-action-list__meta" }, h("span", null, s.gear)),
          ),
          h(
            "div",
            { class: "kp-row-actions" },
            h("button", { type: "button", class: "kp-button kp-button--sm kp-button--primary", "data-bd-pick": s.id, "aria-label": t("bad.ateName", s.title) }, t("bad.ate")),
            h("button", { type: "button", class: "kp-button kp-button--sm", "data-bd-shelf-edit": s.id, "aria-label": t("rec.editName", s.title) }, t("common.edit")),
            h("button", { type: "button", class: "kp-button kp-button--sm kp-button--destructive", "data-bd-shelf-delete": s.id, "aria-label": t("rec.deleteName", s.title) }, t("common.delete")),
          ),
        ),
      ),
    );
    setCardState(shelfCard, "ready");
  }

  /** @param {Kitchen} k */
  function renderShelf(k) {
    const signature = JSON.stringify(k.shelf.map((s) => [s.id, s.title, s.text, s.minutes, s.gear, s.energy]));
    if (signature === drawn.shelf) return;
    drawn.shelf = signature;
    shelfItems = [...k.shelf];
    const open = shelfItems.filter((s) => s.energy === "open").length;
    const easy = shelfItems.filter((s) => s.energy === "easy").length;
    setSegmentedCounts(shelfLevel, { open, easy: open + easy, any: shelfItems.length });
    drawShelf();
  }

  shelfLevel.addEventListener("kp-segmented-change", (event) => {
    const value = /** @type {CustomEvent} */ (event).detail.value;
    if (value !== "open" && value !== "easy" && value !== "any") return;
    level = value;
    drawShelf();
  });
  // I ate this writes a log line for today (Kenny, 24/10/2026 05:07), with Undo; the footer says what was logged.
  shelfList.addEventListener("click", async (event) => {
    const el = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest("[data-bd-pick], [data-bd-shelf-edit], [data-bd-shelf-delete]")) : null;
    if (!el || el.getAttribute("aria-disabled") === "true") return;
    const id = el.getAttribute("data-bd-pick") ?? el.getAttribute("data-bd-shelf-edit") ?? el.getAttribute("data-bd-shelf-delete");
    const item = kitchenNow()?.shelf.find((x) => x.id === id);
    if (!item) return;
    if (el.hasAttribute("data-bd-shelf-edit")) return openRecordEditor("shelf", item);
    if (el.hasAttribute("data-bd-shelf-delete")) return deleteRecord(el, "shelf", item);
    el.setAttribute("aria-disabled", "true");
    try {
      shelfReadout.textContent = await ateShelf(item);
    } catch (e) {
      toast(t("bad.notLogged", reason(e)), { live: "assertive", sticky: true });
    } finally {
      el.removeAttribute("aria-disabled");
    }
  });
  $("[data-bd-shelf-add]", page)?.addEventListener("click", () => openRecordEditor("shelf", null));
  $("[data-bd-safe-add]", page)?.addEventListener("click", () => openSafePicker());
  shelfCard.addEventListener("kp-card-retry", reload);
  safeCard.addEventListener("kp-card-retry", reload);

  // ---- 4 · the mini recipe
  /** @type {Item | null} */
  let mini = null;
  /** @type {"mini" | "full"} */
  let version = "mini";

  /** @param {HTMLElement} group @param {boolean} off */
  function setSegmentedDisabled(group, off) {
    if (off) group.setAttribute("aria-disabled", "true");
    else group.removeAttribute("aria-disabled");
  }

  /** @param {Item | null} recipe */
  function setCook(recipe) {
    if (!recipe) {
      cook.removeAttribute("href");
      cook.setAttribute("aria-disabled", "true");
      cook.textContent = t("bad.cookThis");
      return;
    }
    cook.removeAttribute("aria-disabled");
    cook.textContent = t("bad.cookThis");
    cook.href = `/cook?id=${encodeURIComponent(recipe.id)}${version === "mini" ? "&mini=1" : ""}`;
  }

  function drawMini() {
    if (!mini) return;
    const steps = /** @type {Item[]} */ (mini.steps);
    const small = steps.filter((s) => s.mini);
    const hasMini = small.length > 0;
    if (!hasMini) version = "full";
    const shown = version === "mini" ? small : steps;
    const minutes = shown.reduce((sum, s) => sum + (Number(s.mins) || 0), 0);
    miniLede.textContent =
      version === "mini"
        ? t("bad.miniLede", small.length, minutes, mini.gear, mini.mini_note || t("bad.leftOut", steps.length - small.length))
        : t("bad.fullLede", steps.length, mini.minutes, mini.portions, mini.gear);
    miniSteps.setAttribute("aria-label", `${mini.name}, ${version === "mini" ? t("bad.miniVersion").toLowerCase() : t("bad.fullRecipe").toLowerCase()}`);
    setFocusStepsState(miniSteps, "ready");
    setFocusSteps(miniSteps, toFocusSteps(shown));
    setSegmentedValues(miniVersion, [version]);
    const miniItem = /** @type {HTMLButtonElement | null} */ ($('[data-value="mini"]', miniVersion));
    if (miniItem) miniItem.disabled = !hasMini;
    setSegmentedDisabled(miniVersion, false);
    setCook(mini);
  }

  /** @param {Kitchen} k */
  function renderMini(k) {
    const recipe = miniRecipe(k);
    const signature = JSON.stringify(recipe ? [recipe.id, recipe.name, recipe.steps, recipe.mini_note, recipe.gear, recipe.minutes, recipe.portions] : null);
    if (signature === drawn.mini) return;
    drawn.mini = signature;
    mini = recipe;
    version = "mini";
    if (!recipe) {
      miniTitle.textContent = t("bad.miniDefault");
      miniLede.textContent = "";
      setFocusStepsState(miniSteps, "ready");
      setFocusSteps(miniSteps, []);
      setSegmentedDisabled(miniVersion, true);
      cook.removeAttribute("aria-disabled");
      cook.textContent = t("bad.openMine");
      cook.href = "/recipes";
      return;
    }
    miniTitle.textContent = recipe.name;
    drawMini();
  }

  miniVersion.addEventListener("kp-segmented-change", (event) => {
    const value = /** @type {CustomEvent} */ (event).detail.value;
    if (!mini || (value !== "mini" && value !== "full") || value === version) return;
    version = value;
    drawMini();
  });
  miniSteps.addEventListener("kp-focus-steps-retry", reload);
  cook.addEventListener("click", (event) => {
    if (cook.getAttribute("aria-disabled") === "true") event.preventDefault();
  });

  // ---- 5 · when things went in
  /** @type {Kitchen | null} */
  let latest = null;
  const legend = [
    { tone: "logged", label: t("bad.legendLogged") },
    { tone: "quiet", label: t("bad.legendQuiet") },
    { tone: "paused", label: t("bad.legendAway") },
  ];

  /** @param {Kitchen} k */
  function monthDays(k) {
    /** @type {Record<string, { dishes: string[] }>} */
    const byDay = {};
    for (const f of k.freezer) {
      const key = dayKey(frozenAt(f));
      (byDay[key] ??= { dishes: [] }).dishes.push(f.dish);
    }
    /** @type {Record<string, import("/static/kp/js/calendar.js").CalendarDay>} */
    const out = {};
    for (const [key, { dishes }] of Object.entries(byDay)) {
      out[key] = {
        tone: "logged",
        count: String(dishes.length),
        label: t("bad.wentIn", dishes.length, dishes.join(", ")),
      };
    }
    return out;
  }

  /** The month on show as "YYYY-MM". */
  let shown = dayKey(Date.now()).slice(0, 7);

  /** Empty says so when the month on show has nothing in it. */
  function paintMonth() {
    if (!latest) return;
    const days = monthDays(latest);
    const any = Object.keys(days).some((d) => d.startsWith(shown));
    setCalendarDays(cal, days);
    if (any) setCalendarState(cal, "ready");
    else setCalendarState(cal, "empty", t("bad.monthEmpty"));
  }

  /** @param {Kitchen} k */
  function renderMonth(k) {
    const signature = JSON.stringify(k.freezer.map((f) => [f.id, f.dish, f.frozen_on]));
    if (signature === drawn.month) return;
    const first = drawn.month === null;
    drawn.month = signature;
    latest = k;
    if (first) {
      const [year, month] = dayKey(Date.now()).split("-").map(Number);
      calendarMonth(cal, { year, month });
      setCalendarLegend(cal, /** @type {any} */ (legend));
    }
    paintMonth();
  }
  cal.addEventListener("kp-calendar-month", (event) => {
    const { year, month } = /** @type {CustomEvent} */ (event).detail;
    shown = `${year}-${String(month).padStart(2, "0")}`;
    paintMonth();
  });
  cal.addEventListener("kp-calendar-retry", reload);

  // ---- the kitchen
  /** @param {Kitchen} k */
  function render(k) {
    renderSafe(k);
    renderFreezer(k);
    renderShelf(k);
    renderMini(k);
    renderMonth(k);
  }

  stops.push(onKitchen((k) => alive && render(k)));
  const known = kitchenNow();
  if (known) render(known);
  else {
    loading();
    loadKitchen().then(
      (k) => alive && render(k),
      (e) => alive && failed(e),
    );
  }

  return () => {
    alive = false;
    for (const stop of stops.reverse()) stop();
  };
}
