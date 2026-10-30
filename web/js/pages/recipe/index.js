// The recipe page, `/recipe?id=<recipe id>`: read it, scale it, begin.
//
// Four sections on one grid: the recipe itself (title, effort, the summary,
// "Last time", the portions and the ingredients that follow them, the big
// Begin cooking button), the code that opens cook mode on a phone, the
// printable sheet, and the cooking log of this recipe. Everything the page
// draws is the package's own part: the card with its states, the lede, the
// quantity, the hover card, the flash button, the QR code, the print sheet,
// the heat grid.

// Split on 30/10/2026 (docs/agent/MODULARITY.md): this file joins the parts and reads the kitchen; the page's state is one
// `ctx` object (the words, the recipe, the portions, the elements). frame.js builds the sections, card.js the recipe
// card (ingredients.js its list), share-sheet.js the code and the printable sheet.

import { loadKitchen, onKitchen, kitchenNow, reason } from "../../api.js";
import { h } from "../../dom.js";
import { setCardState, attachCardStates } from "/static/kp/js/card-state.js";
import { attachHoverCards } from "/static/kp/js/hovercard.js";
import { setQr } from "/static/kp/js/qr.js";
import { wordsFor } from "../../recipe/words.js";
import { createLog } from "../../recipe/log/index.js";
import { paintStepPhotos } from "../../recipe/page-parts.js";
import { lang } from "../../i18n/index.js";
import { buildFrame, paintWords } from "./frame.js";
import { createCardView } from "./card.js";
import { createShare, drawPrintOptions } from "./share-sheet.js";

/** @typedef {import("../../api.js").Kitchen} Kitchen */

/**
 * @typedef {object} RecipeCtx
 * @property {string} id
 * @property {(href: string) => void} navigate
 * @property {import("../../recipe/words.js").Words} words
 * @property {Record<string, any> | null} recipe
 * @property {number} portions
 * @property {boolean} alive
 * @property {ReturnType<typeof buildFrame>} el
 */

/** The lower sections show once there is a recipe to show. @param {RecipeCtx} ctx @param {boolean} on */
function lower(ctx, on) {
  const { share, paper, logSec, stepCard } = ctx.el;
  for (const el of [share.el, paper.el, logSec.el]) el.hidden = !on;
  if (!on) stepCard.el.hidden = true;
}

/** The recipe is not in the kitchen. @param {RecipeCtx} ctx */
function showNotFound(ctx) {
  const { words } = ctx;
  ctx.recipe = null;
  lower(ctx, false);
  document.title = `${words.notFoundTitle} · Kitchen`;
  setCardState(ctx.el.card, "empty", { title: words.notFoundTitle, text: words.notFoundText, action: h("a", { class: "kp-button kp-button--primary", href: "/" }, words.wheel) });
}

/**
 * Show the recipe the kitchen holds, or say it is not there. Returns what the page remembers of the last draw.
 * @param {RecipeCtx} ctx @param {Kitchen} k @param {string} lastJson @param {ReturnType<typeof createCardView>} cardView @param {ReturnType<typeof createShare>} share @param {ReturnType<typeof createLog>} log
 * @returns {string} the recipe as drawn (empty when it is not there)
 */
function show(ctx, k, lastJson, cardView, share, log) {
  const found = k.recipes.find((r) => r.id === ctx.id) ?? null;
  const next = wordsFor(lang());
  const switched = next !== ctx.words;
  ctx.words = next;
  if (!found) {
    showNotFound(ctx);
    return "";
  }
  const json = JSON.stringify(found);
  ctx.recipe = found;
  if (ctx.portions === 0) ctx.portions = found.portions || 1;
  document.title = `${found.name} · Kitchen`;
  if (json !== lastJson || switched) {
    paintWords(ctx.el, ctx.words);
    drawPrintOptions(ctx);
    cardView.draw(found, k);
    paintStepPhotos(ctx.el.stepCard, ctx.el.stepList, found);
    share.paintShare();
    share.paintSheet();
  }
  lower(ctx, true);
  setCardState(ctx.el.card, "ready");
  log.show(k, ctx.words);
  return json;
}

/** The first frame: every section loading. @param {RecipeCtx} ctx @param {ReturnType<typeof createLog>} log */
function paintLoading(ctx, log) {
  paintWords(ctx.el, ctx.words);
  setQr(ctx.el.code, { state: "loading" });
  setCardState(ctx.el.card, "loading", { words: ctx.words.loading });
  setCardState(ctx.el.paper.el, "loading", { words: ctx.words.sheetLoading });
  log.loading(ctx.words);
}

/** The first read, a Retry and a failed read: loading states, then `draw`. @param {RecipeCtx} ctx @param {ReturnType<typeof createLog>} log @param {(k: Kitchen) => void} draw */
function createLoader(ctx, log, draw) {
  const { card, code } = ctx.el;
  /** @param {boolean} [force] */
  return async function load(force = false) {
    if (force || !kitchenNow()) {
      setCardState(card, "loading", { words: ctx.words.loading });
      setQr(code, { state: "loading" });
      log.loading(ctx.words);
      lower(ctx, true);
    }
    try {
      const k = await loadKitchen({ force });
      if (ctx.alive) draw(k);
    } catch (e) {
      if (!ctx.alive) return;
      lower(ctx, false);
      setCardState(card, "error", { title: ctx.words.failedTitle, text: reason(e) });
    }
  };
}

/**
 * @param {HTMLElement} root
 * @param {{ params: URLSearchParams, navigate: (href: string) => void }} page
 */
export function mount(root, { params, navigate }) {
  /** @type {RecipeCtx} */
  const ctx = { id: params.get("id") ?? "", navigate, words: wordsFor(lang()), recipe: null, portions: 0, alive: true, el: buildFrame() };
  let recipeJson = "";
  const { card, logSec, page } = ctx.el;
  /** @type {(force?: boolean) => Promise<void>} */
  let load = async () => {};
  const log = createLog(logSec.el, { recipeId: ctx.id, retry: () => void load(true) });
  root.replaceChildren(page);
  attachCardStates(page);
  const cleanups = [attachHoverCards(page)];
  const share = createShare(ctx);
  const cardView = createCardView(ctx, share.paintSheet);
  paintLoading(ctx, log);
  const draw = (/** @type {Kitchen} */ k) => {
    recipeJson = show(ctx, k, recipeJson, cardView, share, log);
  };
  load = createLoader(ctx, log, draw);
  card.addEventListener("kp-card-retry", () => void load(true));
  cleanups.push(
    onKitchen(() => {
      const k = kitchenNow();
      if (k && ctx.alive && recipeJson !== "") draw(k);
    }),
  );
  void load();
  return () => {
    ctx.alive = false;
    for (const clean of cleanups) clean();
  };
}
