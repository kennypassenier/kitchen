// The recipe page, `/recipe?id=<recipe id>`: read it, scale it, begin.
//
// Four sections on one grid: the recipe itself (title, effort, the summary,
// "Last time", the portions and the ingredients that follow them, the big
// Begin cooking button), the code that opens cook mode on a phone, the
// printable sheet, and the cooking log of this recipe. Everything the page
// draws is the package's own part: the card with its states, the lede, the
// quantity, the hover card, the flash button, the QR code, the print sheet,
// the heat grid.

import { loadKitchen, onKitchen, kitchenNow, ApiError } from "../api.js";
import { h } from "../dom.js";
import { setCardState, attachCardStates } from "/static/kp/js/card-state.js";
import { attachLedes } from "/static/kp/js/lede.js";
import { attachQuantities } from "/static/kp/js/quantity.js";
import { attachHoverCards } from "/static/kp/js/hovercard.js";
import { attachFlashButtons, runFlashButton } from "/static/kp/js/flash.js";
import { setQr } from "/static/kp/js/qr.js";
import { attachSegmented } from "/static/kp/js/segmented.js";
import { WORDS, wordsFor } from "../recipe/words.js";
import { amountOf, minutesText } from "../recipe/amounts.js";
import { createSheet } from "../recipe/sheet.js";
import { createLog, dmy } from "../recipe/log.js";

/** @typedef {import("../api.js").Kitchen} Kitchen */
/** @typedef {import("../recipe/words.js").Words} Words */

/** A card whose stage holds a header-less body or a data area. @param {string} dataClass */
const stage = (dataClass = "") => h("div", { class: "kp-card__stage" }, h("div", { class: `kp-card__data ${dataClass}`.trim() }));

/** @param {HTMLElement} card */
const dataOf = (card) => /** @type {HTMLElement} */ (card.querySelector(".kp-card__data"));

/**
 * A section card with its heading and the one sentence that says what it does.
 * @param {string} id @param {string} cls @param {Record<string, string>} [attrs] @param {...Node} body
 */
function section(id, cls, attrs, ...body) {
  const title = h("h2", { class: "kp-card__title", id: `${id}-t` });
  const lede = h("p", { class: "kp-lede", id: `${id}-d` });
  const el = h("section", { class: `kp-card ${cls}`, id, "aria-labelledby": `${id}-t`, ...attrs }, h("div", { class: "kp-card__header" }, title), lede, ...body);
  return { el, title, lede };
}

/**
 * @param {HTMLElement} root
 * @param {{ params: URLSearchParams, navigate: (href: string) => void }} ctx
 */
export function mount(root, { params, navigate }) {
  const id = params.get("id") ?? "";
  let words = wordsFor(kitchenNow()?.settings.lang);
  /** @type {Record<string, any> | null} */
  let recipe = null;
  let recipeJson = "";
  let portions = 0;
  let alive = true;
  /** @type {(() => void)[]} */
  const cleanups = [];

  // ---- the four sections, in their loading state from the first frame --------------------------------------------
  const card = h("section", { class: "kp-card rp-card", "data-kp-state": "loading", "aria-label": "Recipe" }, stage());

  const share = section("rp-share", "rp-sec");
  const code = h("div", { class: "kp-qr", "data-kp-qr": true, "data-kp-qr-retry": true });
  const scanTitle = h("h3", { class: "kp-fw-semibold" });
  const stepsTitle = h("h3", { class: "kp-fw-semibold" });
  const steps = h("ol", { class: "rp-steps" });
  const qrLine = h("p", { class: "rp-line" });
  share.el.append(
    h("div", { class: "rp-share__grid" }, h("div", { class: "rp-share__code" }, scanTitle, code), h("div", { class: "rp-share__words" }, stepsTitle, steps, qrLine)),
  );

  const paper = section("rp-paper", "rp-sec", { "data-kp-state": "loading" }, stage());
  const frame = h("iframe", { class: "rp-sheet" });
  const printTitle = h("h3", { class: "kp-fw-semibold" });
  const printText = h("p");
  const printOptions = h("div", { class: "kp-formgrid" });
  const printButton = h("button", { type: "button", class: "kp-button kp-button--primary" });
  const printLine = h("p", { class: "rp-line" });
  dataOf(paper.el).append(
    h("div", { class: "rp-print" }, frame, h("div", { class: "rp-print__words" }, printTitle, printText, printOptions, h("div", { class: "rp-print__go" }, printButton), printLine)),
  );

  const logSec = section("rp-log", "rp-logcard", { "data-kp-state": "loading" }, stage());
  const log = createLog(logSec.el, { recipeId: id, retry: () => void load(true) });

  const page = h("div", { class: "rp-page" }, card, share.el, paper.el, logSec.el);
  root.replaceChildren(page);
  attachCardStates(page);
  cleanups.push(attachHoverCards(page));

  /** @type {Awaited<ReturnType<typeof createSheet>> | null} */
  let sheet = null;
  const sheetReady = createSheet(frame).then((s) => (sheet = s), () => null);

  /** The lower sections show once there is a recipe to show. @param {boolean} on */
  const lower = (on) => {
    for (const el of [share.el, paper.el, logSec.el]) el.hidden = !on;
  };

  // ---- the words that do not depend on the recipe -----------------------------------------------------------------
  function paintWords() {
    share.title.textContent = words.shareTitle;
    share.lede.textContent = words.shareLede;
    scanTitle.textContent = words.scanTitle;
    stepsTitle.textContent = words.stepsTitle;
    steps.replaceChildren(...words.qrSteps.map((s) => h("li", null, s)));
    qrLine.textContent = words.qrLine;
    paper.title.textContent = words.sheetTitle;
    paper.lede.textContent = words.sheetLede;
    frame.setAttribute("title", words.sheetLabel);
    printTitle.textContent = words.printTitle;
    printText.textContent = words.printText;
    printButton.textContent = words.printButton;
    printLine.textContent = words.printLine;
    logSec.title.textContent = words.logTitle;
    logSec.lede.textContent = words.logLede;
  }
  paintWords();
  setQr(code, { state: "loading" });
  setCardState(card, "loading", { words: words.loading });
  setCardState(paper.el, "loading", { words: words.sheetLoading });
  log.loading(words);

  // ---- the print options: four choices on the form grid ------------------------------------------------------------
  function drawPrintOptions() {
    printOptions.replaceChildren(
      ...Object.entries(words.printOptions).map(([name, spec]) => {
        const label = h("span", { class: "kp-formgrid__label", id: `rp-print-${name}` }, spec.label);
        const group = h(
          "div",
          { class: "kp-segmented", "data-kp-segmented": "single", role: "radiogroup", "aria-labelledby": `rp-print-${name}`, "data-print-option": name },
          ...spec.items.map(([value, text], i) =>
            h("button", { type: "button", class: "kp-segmented__item", "data-value": value, role: "radio", "aria-checked": String(i === 0) }, h("span", { class: "kp-segmented__label" }, text)),
          ),
        );
        return h("div", { class: "kp-formgrid__row" }, label, h("div", { class: "kp-formgrid__control" }, group), h("p", { class: "kp-formgrid__value" }, spec.hint));
      }),
    );
    attachSegmented(printOptions);
  }
  printOptions.addEventListener("kp-segmented-change", (event) => {
    const group = /** @type {HTMLElement} */ (event.target).closest("[data-print-option]");
    const value = /** @type {CustomEvent} */ (event).detail.value;
    if (group instanceof HTMLElement && value) sheet?.option(/** @type {any} */ (group.dataset.printOption), value);
  });
  printButton.addEventListener("click", () => sheet?.print());

  // ---- the recipe card ---------------------------------------------------------------------------------------------
  /** The amount cells of the ingredient list, by ingredient id. @type {Map<string, { amount: HTMLElement, unit: HTMLElement, ing: any }>} */
  let cells = new Map();
  /** @type {HTMLElement | null} */
  let ingList = null;

  /** Write every amount for the chosen portions; a number that changed lights up for a moment. @param {boolean} lit */
  function paintAmounts(lit) {
    if (!recipe) return;
    const factor = portions / (recipe.portions || portions || 1);
    for (const { amount, unit, ing } of cells.values()) {
      const next = amountOf(ing, factor, words);
      if (lit && amount.textContent !== next.text) {
        amount.removeAttribute("data-changed");
        void amount.offsetWidth;
        amount.setAttribute("data-changed", "");
      }
      amount.textContent = next.text;
      unit.textContent = next.unit;
    }
    ingList?.setAttribute("aria-label", words.ingredients(portions));
  }

  /** @param {Record<string, any>} r @param {Kitchen} k */
  function drawCard(r, k) {
    const data = dataOf(card);
    const total = minutesText(r.minutes ?? 0, words);
    const ingredients = /** @type {import("../recipe/amounts.js").Ingredient[]} */ (r.ingredients ?? []);
    const things = ingredients.length + (r.tools?.length ?? 0);
    const effort = /** @type {Record<string, string>} */ (words.efforts)[r.prep] ?? words.efforts.light;

    const lede = h("p", { class: "kp-lede", id: "rp-lede" }, r.summary?.trim() || words.ledeFallback(r.portions ?? portions, total));
    lede.setAttribute("data-kp-lede-collapsible", "100");

    cells = new Map();
    const groups = [...new Set(ingredients.map((i) => i.group || ""))];
    ingList = h("ul", { class: "rp-ings", "aria-label": words.ingredients(portions) });
    for (const group of groups) {
      if (groups.length > 1) ingList.append(h("li", { class: "rp-ings__group" }, h("h4", { class: "kp-fw-semibold" }, group)));
      for (const ing of ingredients.filter((i) => (i.group || "") === group)) {
        const word = h("span", { class: "rp-ing__word" }, ing.name);
        const name = h("span", { class: "rp-ing__name" }, word);
        if (ing.note) {
          word.setAttribute("data-kp-hovercard", ing.note);
          word.tabIndex = 0;
        }
        const amount = h("span", { class: "rp-ing__amount" });
        const unit = h("span", { class: "rp-ing__unit" });
        cells.set(ing.id, { amount, unit, ing });
        ingList.append(h("li", { class: "rp-ing" }, amount, unit, name));
      }
    }
    if (ingredients.length === 0) ingList.append(h("li", { class: "rp-ings__none" }, words.noIngredients));

    const quantity = h(
      "div",
      {
        class: "kp-quantity",
        "data-kp-quantity": true,
        "data-kp-quantity-min": "1",
        "data-kp-quantity-max": String(Math.max(12, r.portions ?? 12, portions)),
        "data-kp-quantity-unit": words.portionsMany,
        "data-kp-quantity-unit-one": words.portionsOne,
        "data-kp-quantity-label": words.portions,
      },
      h("input", { class: "kp-quantity__input", value: String(portions) }),
    );

    const begin = h(
      "button",
      { type: "button", class: "kp-button kp-button--primary kp-button--lg", "data-kp-flash-button": true, "data-kp-flash-words": words.beginDone },
      words.begin,
    );
    const last = [...k.log].filter((e) => e.recipe_id === id).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];

    data.replaceChildren(
      h(
        "div",
        { class: "rp-recipe" },
        // The title row spans both columns, so the two columns under it start on one line.
        h("div", { class: "rp-recipe__head" }, h("h1", { id: "rp-title" }, r.name), h("span", { class: "kp-badge" }, words.effortBadge(effort))),
        h(
          "div",
          { class: "rp-recipe__main" },
          lede,
          h(
            "dl",
            { class: "rp-facts" },
            h("div", null, h("dt", null, words.total), h("dd", null, total)),
            h("div", null, h("dt", null, words.hands), h("dd", null, r.hands_on ? minutesText(r.hands_on, words) : "–")),
            h("div", null, h("dt", null, words.effortLabel), h("dd", null, effort)),
          ),
          h(
            "div",
            { class: "rp-begin" },
            begin,
            h("p", { class: "rp-begin__hint" }, words.beginHint(things)),
            h("a", { class: "kp-button rp-begin__timing", href: `/timing?id=${encodeURIComponent(id)}` }, words.timing),
            h("p", { class: "rp-begin__hint" }, words.timingHint),
          ),
          r.last_note?.trim()
            ? h("div", { class: "kp-alert kp-alert--info" }, h("div", { class: "kp-alert__body" }, h("b", null, last ? `${words.lastTime} · ${dmy(last.date)}` : words.lastTime), ` ${r.last_note}`))
            : null,
        ),
        h("div", { class: "rp-recipe__side" }, h("div", { class: "rp-portions" }, h("h3", { class: "kp-fw-semibold" }, words.portions), quantity), ingList),
      ),
    );
    paintAmounts(false);
    attachLedes(data);
    attachQuantities(data);
    attachFlashButtons(data);
    quantity.addEventListener("kp-quantity-change", (event) => {
      portions = Number(/** @type {CustomEvent} */ (event).detail.value);
      paintAmounts(true);
      paintSheet();
    });
    begin.addEventListener("click", () => {
      void runFlashButton(begin, async () => {
        navigate(`/cook?id=${encodeURIComponent(id)}`);
        return words.beginDone;
      });
    });
  }

  /** The code and the sheet, for the recipe and the portions as they are now. */
  function paintShare() {
    if (!recipe) return;
    code.setAttribute("data-kp-qr-label", words.qrLabel(recipe.name));
    setQr(code, { value: `${location.origin}/cook?id=${encodeURIComponent(id)}`, state: undefined });
  }
  function paintSheet() {
    if (!recipe) return;
    const r = recipe;
    void sheetReady.then(() => {
      if (!alive || !sheet) return;
      sheet.draw({ recipe: r, portions, words, lang: words === WORDS.nl ? "nl" : "en", total: minutesText(r.minutes ?? 0, words) });
      setCardState(paper.el, "ready");
    });
  }

  // ---- reading the kitchen -----------------------------------------------------------------------------------------
  /** @param {Kitchen} k */
  function show(k) {
    const found = k.recipes.find((r) => r.id === id) ?? null;
    const lang = wordsFor(k.settings.lang);
    const switched = lang !== words;
    words = lang;
    if (!found) {
      recipe = null;
      recipeJson = "";
      lower(false);
      document.title = `${words.notFoundTitle} · Kitchen`;
      setCardState(card, "empty", { title: words.notFoundTitle, text: words.notFoundText, action: h("a", { class: "kp-button kp-button--primary", href: "/" }, words.wheel) });
      return;
    }
    const json = JSON.stringify(found);
    const changed = json !== recipeJson || switched;
    recipe = found;
    recipeJson = json;
    if (portions === 0) portions = found.portions || 1;
    document.title = `${found.name} · Kitchen`;
    if (changed) {
      paintWords();
      drawPrintOptions();
      drawCard(found, k);
      paintShare();
      paintSheet();
    }
    lower(true);
    setCardState(card, "ready");
    log.show(k, words);
  }

  /** @param {boolean} [force] */
  async function load(force = false) {
    if (force || !kitchenNow()) {
      setCardState(card, "loading", { words: words.loading });
      setQr(code, { state: "loading" });
      log.loading(words);
      lower(true);
    }
    try {
      const k = await loadKitchen({ force });
      if (alive) show(k);
    } catch (e) {
      if (!alive) return;
      lower(false);
      setCardState(card, "error", { title: words.failedTitle, text: e instanceof ApiError || e instanceof Error ? e.message : String(e) });
    }
  }
  card.addEventListener("kp-card-retry", () => void load(true));
  cleanups.push(
    onKitchen(() => {
      const k = kitchenNow();
      if (k && alive && recipeJson !== "") show(k);
    }),
  );
  void load();

  return () => {
    alive = false;
    for (const clean of cleanups) clean();
  };
}
