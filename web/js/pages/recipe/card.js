// The recipe card: title and effort, the summary, the facts, the Begin cooking button, the portions and the ingredients.

import { h } from "../../dom.js";
import { attachLedes } from "/static/kp/js/lede.js";
import { attachQuantities } from "/static/kp/js/quantity.js";
import { attachFlashButtons, runFlashButton } from "/static/kp/js/flash.js";
import { minutesText } from "../../recipe/amounts.js";
import { dmy } from "../../format.js";
import { dataOf } from "../../ui/cards.js";
import { showPhotos } from "../../recipe/photos.js";
import { STEP_WORDS, sourceRow } from "../../recipe/page-parts.js";
import { lang } from "../../i18n/index.js";
import { buildIngredients, paintAmounts } from "./ingredients.js";

/** The summary, folded after a hundred characters. @param {import("./index.js").RecipeCtx} ctx @param {Record<string, any>} r @param {string} total */
function ledeOf(ctx, r, total) {
  const lede = h("p", { class: "kp-lede", id: "rp-lede" }, r.summary?.trim() || ctx.words.ledeFallback(r.portions ?? ctx.portions, total));
  lede.setAttribute("data-kp-lede-collapsible", "100");
  return lede;
}

/** The portions stepper. @param {import("./index.js").RecipeCtx} ctx @param {Record<string, any>} r */
function quantityOf(ctx, r) {
  const { words, portions } = ctx;
  return h(
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
}

/** Total time, hands-on time, effort and source. @param {import("./index.js").RecipeCtx} ctx @param {Record<string, any>} r @param {string} total @param {string} effort */
function factsOf(ctx, r, total, effort) {
  const { words } = ctx;
  return h(
    "dl",
    { class: "rp-facts" },
    h("div", null, h("dt", null, words.total), h("dd", null, total)),
    h("div", null, h("dt", null, words.hands), h("dd", null, r.hands_on ? minutesText(r.hands_on, words) : "–")),
    h("div", null, h("dt", null, words.effortLabel), h("dd", null, effort)),
    sourceRow(r.source),
  );
}

/** Begin cooking, and the link to the timing page. @param {import("./index.js").RecipeCtx} ctx @param {HTMLElement} begin @param {number} things */
function beginBlock(ctx, begin, things) {
  const { words } = ctx;
  return h(
    "div",
    { class: "rp-begin" },
    begin,
    h("p", { class: "rp-begin__hint" }, words.beginHint(things)),
    h("a", { class: "kp-button rp-begin__timing", href: `/timing?id=${encodeURIComponent(ctx.id)}` }, words.timing),
    h("p", { class: "rp-begin__hint" }, words.timingHint),
  );
}

/** "Last time" note, dated by the latest log line of this recipe. @param {import("./index.js").RecipeCtx} ctx @param {Record<string, any>} r @param {import("../../api.js").Kitchen} k */
function lastNote(ctx, r, k) {
  if (!r.last_note?.trim()) return null;
  const { words } = ctx;
  const last = [...k.log].filter((e) => e.recipe_id === ctx.id).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  return h("div", { class: "kp-alert kp-alert--info" }, h("div", { class: "kp-alert__body" }, h("b", null, last ? `${words.lastTime} · ${dmy(last.date)}` : words.lastTime), ` ${r.last_note}`));
}

/** The whole recipe block of the card: title row, photo, the main column and the portions side. @param {import("./index.js").RecipeCtx} ctx @param {Record<string, any>} r @param {import("../../api.js").Kitchen} k @param {{ begin: HTMLElement, quantity: HTMLElement, list: HTMLElement }} parts */
function recipeBlock(ctx, r, k, { begin, quantity, list }) {
  const { words } = ctx;
  const total = minutesText(r.minutes ?? 0, words);
  const ingredients = /** @type {import("../../recipe/amounts.js").Ingredient[]} */ (r.ingredients ?? []);
  const things = ingredients.length + (r.tools?.length ?? 0);
  const effort = /** @type {Record<string, string>} */ (words.efforts)[r.prep] ?? words.efforts.light;
  return h(
    "div",
    { class: "rp-recipe" },
    // The title row spans both columns, so the two columns under it start on one line.
    h("div", { class: "rp-recipe__head" }, h("h1", { id: "rp-title" }, r.name), h("span", { class: "kp-badge" }, words.effortBadge(effort))),
    r.photo ? h("div", { class: "rp-recipe__photo" }, showPhotos(null, [r.photo], STEP_WORDS[lang()].photo)) : null,
    h("div", { class: "rp-recipe__main" }, ledeOf(ctx, r, total), factsOf(ctx, r, total, effort), beginBlock(ctx, begin, things), lastNote(ctx, r, k)),
    h("div", { class: "rp-recipe__side" }, h("div", { class: "rp-portions" }, h("h3", { class: "kp-fw-semibold" }, words.portions), quantity), list),
  );
}

/** The portions stepper repaints the amounts and the sheet; Begin cooking opens cook mode fresh. @param {import("./index.js").RecipeCtx} ctx @param {HTMLElement} begin @param {HTMLElement} quantity @param {(lit: boolean) => void} paint @param {() => void} paintSheet */
function wireCard(ctx, begin, quantity, paint, paintSheet) {
  quantity.addEventListener("kp-quantity-change", (event) => {
    ctx.portions = Number(/** @type {CustomEvent} */ (event).detail.value);
    paint(true);
    paintSheet();
  });
  begin.addEventListener("click", () => {
    void runFlashButton(begin, async () => {
      ctx.navigate(`/cook?id=${encodeURIComponent(ctx.id)}&fresh=1`);
      return ctx.words.beginDone;
    });
  });
}

/**
 * The card's content and its listeners. `paintSheet` follows the portions.
 * @param {import("./index.js").RecipeCtx} ctx @param {() => void} paintSheet
 */
export function createCardView(ctx, paintSheet) {
  /** @type {import("./ingredients.js").Cells} */
  let cells = new Map();
  /** @type {HTMLElement | null} */
  let list = null;
  const paint = (/** @type {boolean} */ lit) => paintAmounts(ctx, cells, list, lit);

  /** @param {Record<string, any>} r @param {import("../../api.js").Kitchen} k */
  function draw(r, k) {
    const { words } = ctx;
    const data = dataOf(ctx.el.card);
    const built = buildIngredients(ctx, /** @type {import("../../recipe/amounts.js").Ingredient[]} */ (r.ingredients ?? []));
    ({ list, cells } = built);
    const quantity = quantityOf(ctx, r);
    const begin = h("button", { type: "button", class: "kp-button kp-button--primary kp-button--lg", "data-kp-flash-button": true, "data-kp-flash-words": words.beginDone }, words.begin);
    data.replaceChildren(recipeBlock(ctx, r, k, { begin, quantity, list: built.list }));
    paint(false);
    attachLedes(data);
    attachQuantities(data);
    attachFlashButtons(data);
    wireCard(ctx, begin, quantity, paint, paintSheet);
  }
  return { draw };
}
