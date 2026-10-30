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

  const ctx = /** @type {BadDaysCtx} */ ({ page, alive: true, stops, drawn: { safe: null, freezer: null, shelf: null, mini: null, month: null }, reload: () => reload() });
  const { drawn } = ctx;

  const safe = createSafe(ctx);
  const freezer = createFreezer(ctx);
  wireFreezerForm(ctx);
  const shelf = createShelf(ctx);
  const mini = createMini(ctx);
  const month = createMonth(ctx);
  const parts = [safe, shelf, freezer, mini, month];

  function loading() {
    for (const key of Object.keys(drawn)) drawn[key] = null;
    for (const part of parts) part.loading();
  }

  /** @param {unknown} e */
  function failed(e) {
    const why = reason(e);
    for (const key of Object.keys(drawn)) drawn[key] = null;
    for (const part of parts) part.failed(why);
  }

  function reload() {
    loading();
    loadKitchen({ force: true }).then(
      (k) => ctx.alive && render(k),
      (e) => ctx.alive && failed(e),
    );
  }

  // ---- the kitchen
  /** @param {import("../../api.js").Kitchen} k */
  function render(k) {
    for (const part of [safe, freezer, shelf, mini, month]) part.render(k);
  }

  stops.push(onKitchen((k) => ctx.alive && render(k)));
  const known = kitchenNow();
  if (known) render(known);
  else {
    loading();
    loadKitchen().then(
      (k) => ctx.alive && render(k),
      (e) => ctx.alive && failed(e),
    );
  }

  return () => {
    ctx.alive = false;
    for (const stop of stops.reverse()) stop();
  };
}
