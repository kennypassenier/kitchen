// The cooking log of one recipe: a heat grid of weeks, and the form that adds
// a day to it. A quiet day is a pale plate and nothing else (heat's calm
// tones): no count, no streak, never "missed".

// Split on 30/10/2026 (docs/agent/MODULARITY.md): frame.js builds the elements, paint.js draws them from a `LogState`,
// actions.js holds what the buttons do, dates.js the week arithmetic.

import { attachFlashButtons } from "/static/kp/js/flash.js";
import { setHeat } from "/static/kp/js/heat.js";
import { setCardState } from "/static/kp/js/card-state.js";
import { today } from "../../format.js";
import { h } from "../../dom.js";
import { WEEKS } from "./dates.js";
import { buildLogDom } from "./frame.js";
import { paint, drawFeelings } from "./paint.js";
import { wireActions } from "./actions.js";

/** Word the flash buttons once; they keep these faces. @param {import("./paint.js").LogState} s @param {HTMLElement} data */
function wireWords(s, data) {
  const { words, el } = s;
  if (!words) return;
  for (const [button, label, done] of /** @type {const} */ ([[el.add, words.add, words.added], [el.change, words.change, words.changed]])) {
    if (button.dataset.kpFlashWired) continue;
    button.dataset.kpFlashWired = "1";
    button.setAttribute("data-kp-flash-words", done);
    button.textContent = label;
  }
  el.drop.textContent = words.removeEntry;
  attachFlashButtons(data);
}

/**
 * Build the log into its card (a `.kp-card[data-kp-state]` with a stage).
 * @param {HTMLElement} card
 * @param {{ recipeId: string, retry: () => void }} options
 */
export function createLog(card, { recipeId, retry }) {
  const data = /** @type {HTMLElement} */ (card.querySelector(".kp-card__data"));
  /** @type {import("./paint.js").LogState} */
  const s = { words: null, kitchen: null, view: { day: today(), started: false }, feeling: "none", entries: new Map(), el: buildLogDom(data), narrow: matchMedia("(max-width: 36rem)") };
  wireActions(s, recipeId);
  card.addEventListener("kp-card-retry", retry);

  /** Under the card's empty plate the grid is not drawn at all: a grid kept behind the plate could be put in a state (loading, by a measure) that nobody can see. @param {import("../words.js").Words} w @param {() => void} again */
  function showEmpty(w, again) {
    const start = h("button", { type: "button", class: "kp-button kp-button--primary" }, w.logStart);
    start.addEventListener("click", () => {
      s.view.started = true;
      again();
    });
    s.el.grid.hidden = true;
    setCardState(card, "empty", { title: w.logEmptyTitle, text: w.logEmptyText, action: start });
  }

  const api = {
    /** Loading, from the first frame. @param {import("../words.js").Words} w */
    loading(w) {
      s.words = w;
      setCardState(card, "loading", { words: w.logLoading });
      s.el.grid.hidden = false;
      // The grid itself loads with the package's busy card over its weeks, not as a blank (kp measure-states, 24/10/2026).
      setHeat(s.el.grid, { state: "loading", message: w.logLoading, skeleton: { rows: WEEKS, columns: 7 } });
    },
    /** @param {import("../words.js").Words} w @param {string} why */
    failed(w, why) {
      s.words = w;
      setCardState(card, "error", { title: w.logFailedTitle, text: w.logFailedText(why) });
    },
    /** Draw the entries of this recipe. @param {import("../../api.js").Kitchen} k @param {import("../words.js").Words} w */
    show(k, w) {
      const first = s.words !== w;
      s.words = w;
      s.kitchen = k;
      s.entries = new Map();
      for (const e of k.log) if (e.recipe_id === recipeId && !s.entries.has(e.date)) s.entries.set(e.date, e);
      wireWords(s, data);
      if (first) drawFeelings(s);
      if (s.entries.size === 0 && !s.view.started) return showEmpty(w, () => api.show(k, w));
      s.view.started = true;
      s.el.grid.hidden = false;
      paint(s);
      setCardState(card, "ready");
    },
  };
  return api;
}
