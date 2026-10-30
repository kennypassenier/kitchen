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

import { attachCardStates } from "/static/kp/js/card-state.js";
import { attachActionTiles } from "/static/kp/js/action-tiles.js";
import { attachSegmented } from "/static/kp/js/segmented.js";
import { attachDataTables } from "/static/kp/js/datatable.js";
import { attachAgo } from "/static/kp/js/freshness.js";
import { attachFocusSteps } from "/static/kp/js/focus-steps.js";
import { attachCalendars } from "/static/kp/js/calendar.js";
import { attachActionColumns } from "/static/kp/js/actions.js";
import { attachDatePickers } from "/static/kp/js/datepicker.js";
import { attachQuantities } from "/static/kp/js/quantity.js";
import { attachLoadingPieces } from "/static/kp/js/loading-pieces.js";
import { attachMotion } from "/static/kp/js/motion.js";
import { attachSelects } from "/static/kp/js/combobox.js";
import { kitchenNow, loadKitchen, onKitchen, reason } from "../../api.js";
import { h } from "../../dom.js";
import { t } from "../../i18n/index.js";
import { sections } from "./template.js";
import { createSafe } from "./safe.js";
import { createFreezer } from "./freezer.js";
import { wireFreezerForm } from "./freezer-form.js";
import { createShelf } from "./shelf.js";
import { createMini } from "./mini-recipe.js";
import { createMonth } from "./month.js";

// Split on 30/10/2026 (docs/agent/MODULARITY.md): this file attaches the package's behaviour and joins the five parts;
// each part is a function over one `ctx` (the page, what each part was last drawn from, reload, the stops) and returns
// render / loading / failed.

/**
 * @typedef {object} BadDaysCtx
 * @property {HTMLElement} page
 * @property {boolean} alive
 * @property {(() => void)[]} stops
 * @property {Record<string, string | null>} drawn what each part was last drawn from, to leave a part alone when its data did not change
 * @property {() => void} reload
 */

/** Attach the package's behaviour to the page; the stops are kept for the clean-up. @param {HTMLElement} page @param {(() => void)[]} stops */
function attachBehaviour(page, stops) {
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
}

/** Loading, failed and render over the five parts; a part is redrawn only when its data changed (`ctx.drawn`). @param {BadDaysCtx} ctx @param {ReturnType<typeof buildParts>} p */
function createRunner(ctx, p) {
  const { drawn } = ctx;
  const forget = () => {
    for (const key of Object.keys(drawn)) drawn[key] = null;
  };
  /** @param {import("../../api.js").Kitchen} k */
  const render = (k) => {
    for (const part of [p.safe, p.freezer, p.shelf, p.mini, p.month]) part.render(k);
  };
  const loading = () => {
    forget();
    for (const part of p.all) part.loading();
  };
  /** @param {unknown} e */
  const failed = (e) => {
    const why = reason(e);
    forget();
    for (const part of p.all) part.failed(why);
  };
  /** Read the kitchen and draw it, or say why not. @param {boolean} force */
  const read = (force) =>
    loadKitchen({ force }).then(
      (k) => ctx.alive && render(k),
      (e) => ctx.alive && failed(e),
    );
  return { render, loading, read };
}

/** @param {BadDaysCtx} ctx */
function buildParts(ctx) {
  const safe = createSafe(ctx);
  const freezer = createFreezer(ctx);
  wireFreezerForm(ctx);
  const shelf = createShelf(ctx);
  const mini = createMini(ctx);
  const month = createMonth(ctx);
  return { safe, freezer, shelf, mini, month, all: [safe, shelf, freezer, mini, month] };
}

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
  attachBehaviour(page, stops);
  /** @type {{ read: (force: boolean) => unknown, loading: () => void, render: (k: import("../../api.js").Kitchen) => void }} */
  let run;
  const ctx = /** @type {BadDaysCtx} */ ({ page, alive: true, stops, drawn: { safe: null, freezer: null, shelf: null, mini: null, month: null }, reload: () => { run.loading(); void run.read(true); } });
  run = createRunner(ctx, buildParts(ctx));
  stops.push(onKitchen((k) => ctx.alive && run.render(k)));
  const known = kitchenNow();
  if (known) run.render(known);
  else {
    run.loading();
    void run.read(false);
  }
  return () => {
    ctx.alive = false;
    for (const stop of stops.reverse()) stop();
  };
}
