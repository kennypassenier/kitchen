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

import { attachCardStates, setCardState } from "/kp/js/card-state.js";
import { attachActionTiles } from "/kp/js/action-tiles.js";
import { attachSegmented, setSegmentedCounts, setSegmentedValues } from "/kp/js/segmented.js";
import { attachDataTables, dataTable } from "/kp/js/datatable.js";
import { agoMoment, attachAgo } from "/kp/js/freshness.js";
import { undoToast } from "/kp/js/undo-toast.js";
import { toast } from "/kp/js/overlays.js";
import { attachFocusSteps, setFocusSteps, setFocusStepsState } from "/kp/js/focus-steps.js";
import {
  attachCalendars,
  calendarMonth,
  dayKey,
  setCalendarDays,
  setCalendarLegend,
  setCalendarState,
} from "/kp/js/calendar.js";
import { attachActionColumns } from "/kp/js/actions.js";
import { attachDatePickers, datePicker } from "/kp/js/datepicker.js";
import { attachQuantities } from "/kp/js/quantity.js";
import { attachForms, VALID_EVENT } from "/kp/js/forms.js";
import { attachLoadingPieces } from "/kp/js/loading-pieces.js";
import { attachMotion } from "/kp/js/motion.js";
import { create, daysSinceCooked, kitchenNow, loadKitchen, onKitchen, takePortions } from "../api.js";
import { h, $ } from "../dom.js";

/** @typedef {import("../api.js").Kitchen} Kitchen */
/** @typedef {import("../api.js").Item} Item */

const DAY = 86_400_000;
/** Days in the freezer before the quiet "Use these next" word shows. */
const OLD_AFTER_DAYS = 60;
/** How long Undo is offered after Take one portion (approved: 10 s, ring). */
const UNDO_MS = 10_000;

const SECTIONS = `
  <header class="bd-intro">
    <h1>Bad days: food that works when nothing else does</h1>
    <p>
      The screen for a day with no energy. Five parts, each answering one question without asking for effort: which
      dishes always work, what is in the freezer, what can be eaten without cooking, how a recipe shrinks to its
      smallest version, and when things went in. Nothing here counts calories or weight, nothing turns red, and every
      action can be taken back.
    </p>
  </header>

  <section class="bd-sec" id="safe-dishes" aria-labelledby="h-safe-dishes">
    <div class="bd-sec__head">
      <h2 id="h-safe-dishes">Safe dishes: always possible</h2>
      <p>
        A short, fixed row of dishes that work on any day, as large tiles with one sentence each. They never reorder, so
        the thumb learns where they are.
      </p>
    </div>
    <section class="kp-card bd-card" id="bd-safe-card" data-kp-state="loading" aria-labelledby="bd-safe-t"
      data-kp-loading-words="Opening your safe dishes…">
      <div class="kp-card__header">
        <h3 class="kp-card__title" id="bd-safe-t">Your safe dishes</h3>
        <div class="kp-card__actions"><span class="kp-timestamp" data-bd-safe-count></span></div>
      </div>
      <p class="kp-card__body">Pick one and that is dinner decided. Each one is a recipe you marked as a safe favourite.</p>
      <div class="kp-card__stage">
        <div class="kp-card__data">
          <ul class="kp-actions bd-safe" data-kp-action-size="large" aria-label="Safe dishes" data-bd-safe></ul>
        </div>
      </div>
    </section>
  </section>

  <section class="bd-sec" id="freezer" aria-labelledby="h-freezer">
    <div class="bd-sec__head">
      <h2 id="h-freezer">The freezer</h2>
      <p>
        A table of what is frozen: the oldest on top, how long each has been in, and one button to take a portion.
        Taking a portion can be undone; nothing asks &ldquo;are you sure&rdquo;.
      </p>
    </div>
    <div class="bd-freezer" data-bd-freezer>
      <div class="kp-datatable" id="bd-freezer" data-kp-datatable data-kp-cards data-kp-page-sizes="none"
        data-kp-key="freezer" data-kp-state="loading" data-kp-busy-overlay>
        <div class="kp-datatable__bar">
          <input class="kp-datatable__search" data-kp-datatable-search type="search" aria-label="Find a dish in the freezer"
            placeholder="Find a dish" />
          <p class="kp-datatable__status" data-kp-datatable-status role="status" aria-live="polite"></p>
        </div>
        <div class="kp-table-wrap">
          <table class="kp-table">
            <caption class="kp-sr-only">Freezer, the oldest dish first</caption>
            <thead>
              <tr>
                <th scope="col" data-kp-sort="text">Dish</th>
                <th scope="col" data-kp-sort="number">Portions</th>
                <th scope="col" data-kp-sort="number">Frozen on</th>
                <th scope="col">How long</th>
                <th scope="col">Hint</th>
                <th scope="col"><span class="kp-sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody data-bd-rows></tbody>
          </table>
        </div>
        <div class="kp-empty" data-kp-art="none" data-kp-art-size="lg" data-kp-datatable-empty hidden>
          <p class="kp-empty__title" data-kp-datatable-empty-none>The freezer is empty, and that is fine</p>
          <p class="kp-empty__body" data-kp-datatable-empty-none>
            Nothing to defrost today. The safe dishes and the zero-prep shelf work without it. Whenever you cook too
            much, put the extra here and it waits for you.
          </p>
          <button type="button" class="kp-button kp-button--primary" data-kp-datatable-empty-none data-bd-add>
            Add a portion I froze today
          </button>
          <p class="kp-empty__title" data-kp-datatable-empty-nomatch>No dish in the freezer matches that</p>
          <p class="kp-empty__body" data-kp-datatable-empty-nomatch>Try fewer letters, or clear the search to see everything.</p>
          <button type="button" class="kp-button" data-kp-datatable-empty-nomatch data-kp-datatable-clear>Clear the search</button>
        </div>
        <div class="kp-alert kp-alert--destructive" data-kp-datatable-failed role="alert" hidden>
          <p data-kp-datatable-failed-reason>The freezer list could not be read.</p>
          <button type="button" class="kp-button" data-kp-datatable-retry>Try again</button>
        </div>
      </div>
    </div>
    <div class="bd-add">
      <div class="bd-sec__head">
        <h3 id="h-freezer-add">Add something you froze</h3>
        <p>Put a dish in the list when you freeze it, so it is here on the day you need it.</p>
      </div>
      <form class="bd-add__form" data-kp-form data-bd-add-form novalidate aria-labelledby="h-freezer-add">
        <div class="kp-form__summary" data-kp-form-summary tabindex="-1" hidden></div>
        <div class="kp-formgrid" data-kp-formgrid-lines="lines">
        <div class="kp-formgrid__row" data-bd-dish-row>
          <label class="kp-formgrid__label" for="bd-add-dish">Dish</label>
          <div class="kp-formgrid__control">
            <input class="kp-field__input" id="bd-add-dish" name="dish" type="text" autocomplete="off"
              aria-describedby="bd-add-dish-note" />
          </div>
          <p class="kp-formgrid__value" id="bd-add-dish-note" role="status" aria-live="polite" data-bd-dish-note>What it is, as you would say it.</p>
        </div>
        <div class="kp-formgrid__row">
          <label class="kp-formgrid__label" for="bd-add-portions">Portions</label>
          <div class="kp-formgrid__control">
            <div class="kp-quantity kp-formgrid__short" data-kp-quantity data-kp-quantity-min="1" data-kp-quantity-max="24"
              data-kp-quantity-unit="portions" data-kp-quantity-unit-one="portion" data-kp-quantity-label="Portions" data-bd-portions>
              <input class="kp-quantity__input" id="bd-add-portions" value="2" />
            </div>
          </div>
          <p class="kp-formgrid__value">How many go into the freezer.</p>
        </div>
        <div class="kp-formgrid__row" data-bd-date-row>
          <label class="kp-formgrid__label" for="bd-add-date">Frozen on</label>
          <div class="kp-formgrid__control">
            <div class="kp-datepicker" data-kp-datepicker lang="en-GB" data-bd-date>
              <input class="kp-field__input" id="bd-add-date" type="text" inputmode="numeric" data-kp-date-input
                aria-describedby="bd-add-date-note" />
              <button type="button" class="kp-button" data-kp-date-open aria-label="Open the calendar" title="Open the calendar">
                <span aria-hidden="true">&#9638;</span>
              </button>
              <div class="kp-datepicker__panel" data-kp-date-panel hidden></div>
            </div>
          </div>
          <p class="kp-formgrid__value" id="bd-add-date-note" role="status" aria-live="polite" data-bd-date-note>Today, unless you froze it earlier.</p>
        </div>
        <div class="kp-formgrid__row kp-formgrid__row--buttons">
          <div class="kp-formgrid__control"></div>
          <div class="kp-formgrid__actions">
            <button type="submit" class="kp-button kp-button--primary" data-kp-submit data-bd-add-submit>Add to the freezer</button>
          </div>
        </div>
        </div>
      </form>
    </div>
  </section>

  <section class="bd-sec" id="zero-prep" aria-labelledby="h-zero-prep">
    <div class="bd-sec__head">
      <h2 id="h-zero-prep">The zero-prep shelf</h2>
      <p>
        Food that is eaten without cooking, sorted by how much you can manage today. Say how much that is, and the list
        shrinks to what fits.
      </p>
    </div>
    <section class="kp-card bd-card" id="bd-shelf-card" data-kp-state="loading" aria-labelledby="bd-shelf-t"
      data-kp-loading-words="Opening the shelf…">
      <div class="kp-card__header">
        <h3 class="kp-card__title" id="bd-shelf-t">What I can manage today</h3>
        <div class="kp-card__actions">
          <div class="kp-segmented" data-kp-segmented="single" role="radiogroup" aria-label="How much I can manage today" data-bd-level>
            <button type="button" class="kp-segmented__item" role="radio" aria-checked="false" data-value="open">
              <span class="kp-segmented__label">Just open it</span><span class="kp-segmented__count"></span>
            </button>
            <button type="button" class="kp-segmented__item" role="radio" aria-checked="false" data-value="easy">
              <span class="kp-segmented__label">One easy step</span><span class="kp-segmented__count"></span>
            </button>
            <button type="button" class="kp-segmented__item" role="radio" aria-checked="true" data-value="any">
              <span class="kp-segmented__label">Anything here</span><span class="kp-segmented__count"></span>
            </button>
          </div>
        </div>
      </div>
      <p class="kp-card__body">No stove, no oven, no pan. Choose what fits today, not what you think you should manage.</p>
      <div class="kp-card__stage">
        <div class="kp-card__data">
          <ul class="kp-action-list kp-action-list--lead bd-shelf" aria-label="Foods without cooking" data-bd-shelf></ul>
        </div>
      </div>
      <div class="kp-card__footer"><p class="bd-readout" role="status" data-bd-shelf-readout>Nothing chosen yet.</p></div>
    </section>
  </section>

  <section class="bd-sec" id="mini-recipe" aria-labelledby="h-mini-recipe">
    <div class="bd-sec__head">
      <h2 id="h-mini-recipe">A mini version of a recipe</h2>
      <p>
        One of your safe dishes in its smallest form: fewer steps, one pot, one portion. Switch between the mini and the
        full recipe, then follow one step at a time.
      </p>
    </div>
    <div class="bd-mini">
      <div class="bd-mini__head">
        <h3 class="bd-mini__title" data-bd-mini-title>A safe dish, made small</h3>
        <div class="kp-segmented" data-kp-segmented="single" role="radiogroup" aria-label="Which version" data-bd-version>
          <button type="button" class="kp-segmented__item" role="radio" aria-checked="true" data-value="mini">
            <span class="kp-segmented__label">Mini version</span>
          </button>
          <button type="button" class="kp-segmented__item" role="radio" aria-checked="false" data-value="full">
            <span class="kp-segmented__label">Full recipe</span>
          </button>
        </div>
        <a class="kp-button kp-button--primary bd-mini__cook" aria-disabled="true" data-bd-cook>Cook this</a>
      </div>
      <p class="kp-lede bd-mini__lede" data-bd-mini-lede></p>
      <div class="kp-focus-steps bd-mini__steps" data-kp-focus-steps aria-label="Mini recipe" data-bd-steps
        data-kp-focus-steps-empty="None of your safe dishes has written steps yet. Add the steps to one of them and its small version appears here."></div>
    </div>
  </section>

  <section class="bd-sec" id="freezer-month" aria-labelledby="h-freezer-month">
    <div class="bd-sec__head">
      <h2 id="h-freezer-month">When things went in</h2>
      <p>
        A month of days: the days you froze something are filled, every other day is quiet. It helps you remember
        cooking days, and it can never show a day as missed.
      </p>
    </div>
    <div class="bd-calwrap">
      <section class="kp-calendar kp-calendar--busy-whole" id="bd-cal" data-kp-calendar data-kp-tones="calm"
        aria-label="Days something went into the freezer"></section>
    </div>
  </section>
`;

/** "YYYY-MM-DD" as dd/mm/yyyy. @param {string} iso */
const dmy = (iso) => iso.slice(0, 10).split("-").reverse().join("/");

/** @param {number} n @param {string} one @param {string} many */
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

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
  document.title = "Bad days · Kitchen";
  const page = h("div", { class: "bd-page" });
  page.innerHTML = SECTIONS;
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
    const t = table();
    t?.busy({ text: "Looking in the freezer…", since: Date.now(), overlay: true });
    t?.state("loading");
    setFocusStepsState(miniSteps, "loading", "Opening the recipe…");
    setCalendarState(cal, "loading", "Reading the month…");
    setCook(null);
    setSegmentedDisabled(miniVersion, true);
  }

  /** @param {unknown} e */
  function failed(e) {
    const why = reason(e);
    for (const key of Object.keys(drawn)) drawn[key] = null;
    setCardState(safeCard, "error", { title: "Could not open your safe dishes", text: `${why} The dishes are still saved.` });
    setCardState(shelfCard, "error", { title: "Could not open the shelf", text: `${why} Nothing was changed.` });
    table()?.fail(`The freezer list could not be read. ${why} Your portions are still counted.`);
    setFocusStepsState(miniSteps, "error", `The recipe could not be opened. ${why}`);
    setCalendarState(cal, "error", "The month could not be read. Nothing was changed.");
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
    safeCount.textContent = count(dishes.length, "dish", "dishes");
    if (!dishes.length) {
      const pick = h("button", { type: "button", class: "kp-button kp-button--primary" }, "Pick from my recipes");
      pick.addEventListener("click", () => navigate("/recipes"));
      setCardState(safeCard, "empty", {
        title: "No safe dishes yet",
        text: "Mark three dishes as safe favourites in your recipes. They will wait here, in this exact place, and never move.",
        action: pick,
      });
      return;
    }
    safeList.replaceChildren(
      ...dishes.map((r) => {
        const made = lastMade(k, r.id);
        const text = r.summary ? firstSentence(String(r.summary)) : `Takes about ${r.minutes} minutes and uses ${r.gear}.`;
        return h(
          "li",
          null,
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
              h("span", null, made ? `last made ${dmy(made)}` : "not made yet"),
            ),
          ),
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
      h("td", null, h("strong", null, item.dish)),
      h("td", { "data-kp-sort-value": String(item.portions) }, String(item.portions)),
      h("td", { "data-kp-sort-value": String(at) }, agoMoment(at).slice(0, 10)),
      h("td", null, h("time", { class: "kp-ago", "data-kp-ago": "", "data-kp-ago-verb": "frozen", datetime: new Date(at).toISOString() }, "")),
      h(
        "td",
        null,
        h(
          "span",
          old ? { class: "kp-badge bd-hint" } : { class: "kp-badge bd-hint bd-hint--none", "aria-hidden": "true" },
          old ? "Use these next" : "Fine",
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
            { type: "button", class: "kp-button kp-button--sm", "data-bd-take": item.id, "aria-label": `Take one portion of ${item.dish}` },
            "Take one portion",
          ),
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
    const t = table();
    // The table reconciles its own rows on refresh (kp-themes 6f9301bc): write the fresh rows, ask it to re-read them.
    rows.replaceChildren(...items.map(freezerRow));
    t?.refresh({ keepPage: true });
    if (first) {
      t?.state("ready");
      t?.sort({ column: 2, direction: "ascending" });
    }
  }

  rows.addEventListener("click", async (event) => {
    const button = event.target instanceof Element ? /** @type {HTMLElement | null} */ (event.target.closest("[data-bd-take]")) : null;
    if (!button || button.getAttribute("aria-disabled") === "true") return;
    const id = button.getAttribute("data-bd-take") ?? "";
    const dish = kitchenNow()?.freezer.find((f) => f.id === id)?.dish ?? "the dish";
    button.setAttribute("aria-disabled", "true");
    try {
      const after = await takePortions(id, 1);
      undoToast(
        after.portions < 1 ? `Took the last portion of ${dish}. It leaves the list.` : `Took 1 portion of ${dish}. ${after.portions} left.`,
        {
          mode: "revert",
          ms: UNDO_MS,
          clock: "ring",
          max: 2,
          undo: async () => {
            try {
              await takePortions(id, -1);
            } catch (e) {
              toast(`Could not put it back. ${reason(e)}`, { live: "assertive", sticky: true });
            }
          },
        },
      );
    } catch (e) {
      toast(`Could not take a portion of ${dish}. ${reason(e)}`, { live: "assertive", sticky: true });
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
    mark(dishRow, dishNote, null, "What it is, as you would say it.");
  });
  dateInput.addEventListener("input", () => {
    dateInput.removeAttribute("aria-invalid");
    mark(dateRow, dateNote, null, "Today, unless you froze it earlier.");
  });
  // The package form owns the submit: it checks validity, lists what is wrong in its summary, makes the button busy and
  // fires VALID_EVENT. This listener runs first and turns the page's own rules into the browser's validity.
  const DISH_WRONG = "Say what you froze, so you can find it again.";
  const DATE_WRONG = "Use a date up to today, as dd/mm/yyyy.";
  form.addEventListener("submit", () => {
    const dish = dishField.value.trim();
    const picked = datePicker(picker)?.get() ?? null;
    dishField.setCustomValidity(dish ? "" : DISH_WRONG);
    dateInput.setCustomValidity(picked && picked.getTime() <= Date.now() + DAY ? "" : DATE_WRONG);
    mark(dishRow, dishNote, dish ? null : DISH_WRONG, "What it is, as you would say it.");
    mark(dateRow, dateNote, dateInput.validationMessage || null, "Today, unless you froze it earlier.");
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
        recipe_id: null,
        portions: Math.max(1, Number.isFinite(portions) ? portions : 1),
        frozen_on: when.toISOString(),
      });
      toast(`Added ${dish} to the freezer.`, { ms: 4000 });
      dishField.value = "";
      setToday();
      dishField.focus();
    } catch (e) {
      toast(`Could not add ${dish}. ${reason(e)}`, { live: "assertive", sticky: true });
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
    shelfReadout.textContent = "Nothing chosen yet.";
    if (!shelfItems.length) {
      const go = h("button", { type: "button", class: "kp-button kp-button--primary" }, "Look at the safe dishes");
      go.addEventListener("click", () => $("#safe-dishes", page)?.scrollIntoView({ block: "start" }));
      setCardState(shelfCard, "empty", {
        title: "The shelf is empty",
        text: "Foods that need no cooking, like yoghurt or crackers, wait here on the days you need them. Until then the safe dishes work on any day.",
        action: go,
      });
      return;
    }
    if (!shown.length) {
      const all = h("button", { type: "button", class: "kp-button kp-button--primary" }, "Show everything on the shelf");
      all.addEventListener("click", () => setSegmentedValues(shelfLevel, ["any"]));
      setCardState(shelfCard, "empty", {
        title: "Nothing here needs that little effort yet",
        text: "Nothing on the shelf can be eaten straight from its pack. The other two choices show what the shelf holds.",
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
            h("strong", { class: "kp-action-list__title" }, s.title),
            h("span", { class: "kp-action-list__text" }, s.text),
            h("span", { class: "kp-action-list__meta" }, h("span", null, s.gear)),
          ),
          h("div", { class: "kp-row-actions" }, h("button", { type: "button", class: "kp-button kp-button--sm", "data-bd-pick": s.title, "aria-label": `This one: ${s.title}` }, "This one")),
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
  shelfList.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-bd-pick]") : null;
    if (button) shelfReadout.textContent = `Chosen: ${button.getAttribute("data-bd-pick")}. A plate and you are done.`;
  });
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
      cook.textContent = "Cook this";
      return;
    }
    cook.removeAttribute("aria-disabled");
    cook.textContent = "Cook this";
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
        ? `Mini version: ${count(small.length, "step", "steps")}, about ${minutes} minutes, ${mini.gear}. ${
            mini.mini_note || `Left out of the full recipe: ${count(steps.length - small.length, "step", "steps")}.`
          }`
        : `Full recipe: ${count(steps.length, "step", "steps")}, about ${mini.minutes} minutes, ${count(mini.portions, "portion", "portions")}, ${mini.gear}.`;
    miniSteps.setAttribute("aria-label", `${mini.name}, ${version === "mini" ? "mini version" : "full recipe"}`);
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
      miniTitle.textContent = "A safe dish, made small";
      miniLede.textContent = "";
      setFocusStepsState(miniSteps, "ready");
      setFocusSteps(miniSteps, []);
      setSegmentedDisabled(miniVersion, true);
      cook.removeAttribute("aria-disabled");
      cook.textContent = "Open my recipes";
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
    { tone: "logged", label: "Something went in" },
    { tone: "quiet", label: "Nothing went in, and that is fine" },
    { tone: "paused", label: "Away" },
  ];

  /** @param {Kitchen} k */
  function monthDays(k) {
    /** @type {Record<string, { dishes: string[] }>} */
    const byDay = {};
    for (const f of k.freezer) {
      const key = dayKey(frozenAt(f));
      (byDay[key] ??= { dishes: [] }).dishes.push(f.dish);
    }
    /** @type {Record<string, import("/kp/js/calendar.js").CalendarDay>} */
    const out = {};
    for (const [key, { dishes }] of Object.entries(byDay)) {
      out[key] = {
        tone: "logged",
        count: String(dishes.length),
        label: `${count(dishes.length, "dish", "dishes")} went into the freezer: ${dishes.join(", ")}`,
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
    else setCalendarState(cal, "empty", "Nothing was frozen this month. That is fine.");
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
