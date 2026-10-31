// The wheel, "What do we eat?" (route "/"): the kitchen's dishes on one wheel, the answer with when to start, the three-way
// filters, "No energy today" and the dishes that fit. Everything drawn is the package's: the one wheel component
// (web/eten/dishwheel.js, Kenny, 24/10/2026 10:27: the same wheel everywhere; this page gives it the dishes and fills its
// answer column) over js/wheel.js, js/segmented.js (three-way chips), js/toggle.js, js/card-state.js (loading, empty and failed
// states), js/art.js, js/reason.js, js/calm.js, the kp-switch and the form grid. Data comes from api.js only.
//
// What a person did that is kept: a dish set aside ("Not this one, not again this week") is a `resting` item with an `until`
// date; the filters, the switch and the spin are never stored.
//
// Split on 30/10/2026 (docs/agent/MODULARITY.md): this file joins the parts. The page's state is one `ctx` object (the kitchen,
// the status, the dishes, the model of what was asked, the elements) that every part reads; the parts repaint each other
// through `ctx.view.paintAll`, and everything live is taken down by the functions in `ctx.cleanups`. logic.js is the pure part
// (scripts/wheel.test.mjs covers it); model.js binds it to the ctx.

import { loadKitchen, kitchenNow, onKitchen } from "../../api.js";
import { attachCardStates, setCardState, attachSegmented, setSegmentedCounts, attachToggles, attachDisabledReasons } from "/static/kp/dist/kp-themes.min.js";
import { t } from "../../i18n/index.js";
import { newModel, FIRST_INGREDIENTS } from "./logic.js";
import { pageHtml } from "./template.js";
import { derive, dinnerTime } from "./model.js";
import { paintCounts, describeFilters, wireFilters } from "./filters.js";
import { paintEasy, wireEasy, releaseCalm } from "./easy.js";
import { createWheelView } from "./wheel-view.js";
import { createListView } from "./list-view.js";

/**
 * @typedef {object} WheelCtx
 * @property {HTMLElement} root
 * @property {(href: string) => void} navigate
 * @property {(() => void)[]} cleanups
 * @property {import("../../api.js").Kitchen | null} kitchen
 * @property {"loading" | "error" | "ready"} status
 * @property {string} failure
 * @property {import("./logic.js").Dish[]} dishes the dishes as the wheel reads them
 * @property {Map<string, any>} restItems dish id -> its active resting item
 * @property {import("./logic.js").Model} M what the person asked for, in memory only
 * @property {boolean} writing a write is in flight
 * @property {boolean} calmByUs calm mode was switched on by the "No energy today" switch (so switching off puts it back only then)
 * @property {{ ing: string, cat: string }} chipKeys the lists the ingredient and category chips were last given
 * @property {{ cardMain: HTMLElement, cardList: HTMLElement, groups: Record<"meal" | "time" | "ing" | "cat", HTMLElement>, clearBtn: HTMLButtonElement, filtersLive: HTMLElement, easyLive: HTMLElement, switchEl: HTMLInputElement, kindsEl: HTMLElement, kindButtons: HTMLElement[] }} el
 * @property {{ paintAll: () => void }} view
 */

/** @param {WheelCtx} ctx */
function pickElements(ctx) {
  /** @param {string} id */
  const q = (id) => /** @type {HTMLElement} */ (ctx.root.querySelector(`#${id}`));
  const kindsEl = q("wl-easy-kinds");
  ctx.el = {
    cardMain: q("wl-card"),
    cardList: q("wl-fits"),
    groups: { meal: q("wl-f-meal"), time: q("wl-f-time"), ing: q("wl-f-ing"), cat: q("wl-f-cat") },
    clearBtn: /** @type {HTMLButtonElement} */ (q("wl-f-clear")),
    filtersLive: q("wl-f-live"),
    easyLive: q("wl-easy-live"),
    switchEl: /** @type {HTMLInputElement} */ (q("wl-easy-switch")),
    kindsEl,
    kindButtons: /** @type {HTMLElement[]} */ ([...kindsEl.querySelectorAll("[data-kp-toggle]")]),
  };
}

/** The package's own attach calls, once, on this screen's markup, and the chips drawn loading. @param {WheelCtx} ctx */
function attachPackage(ctx) {
  const { root, cleanups, el } = ctx;
  cleanups.push(attachCardStates(root), attachSegmented(root), attachToggles(el.kindsEl), attachDisabledReasons(root));
  for (const g of Object.values(el.groups)) if (ctx.status === "loading") g.setAttribute("aria-busy", "true");
  for (const g of Object.values(el.groups)) setSegmentedCounts(g, Object.fromEntries([...g.querySelectorAll("[data-value]")].map((b) => [/** @type {HTMLElement} */ (b).dataset.value ?? "", null])));
}

/** The first load when the kitchen is not there yet. @param {WheelCtx} ctx */
function loadFirst(ctx) {
  loadKitchen().then(
    (k) => {
      ctx.kitchen = k;
      ctx.status = "ready";
      ctx.view.paintAll();
    },
    (e) => {
      ctx.failure = e instanceof Error ? e.message : String(e);
      ctx.status = "error";
      ctx.view.paintAll();
    },
  );
}

/** The whole screen, again, from the data and the model. @param {WheelCtx} ctx @param {{ refresh: () => void }} wheelView @param {{ refresh: () => void }} listView */
function paintAll(ctx, wheelView, listView) {
  derive(ctx);
  const body = ctx.root.querySelector("#wl-card-body");
  if (body) body.textContent = `${t("wheel.dinnerAt", dinnerTime(ctx))} ${t("wheel.cardBody")}`;
  wheelView.refresh();
  listView.refresh();
  paintCounts(ctx);
  describeFilters(ctx);
  paintEasy(ctx);
}

/** Leaving the page: stop what runs, give the calm mode back, close the busy cards the loading states opened. @param {WheelCtx} ctx */
function teardown(ctx) {
  for (const fn of ctx.cleanups) fn();
  releaseCalm(ctx);
  for (const c of [ctx.el.cardMain, ctx.el.cardList]) if (c.getAttribute("data-kp-state") === "loading") setCardState(c, "ready");
}

/** @param {HTMLElement} root @param {{ params: URLSearchParams, navigate: (href: string) => void }} page */
export function mount(root, { navigate }) {
  document.title = `${t("wheel.title")} · Kitchen`;
  const kitchen = kitchenNow();
  /** @type {WheelCtx} */
  const ctx = {
    root, navigate, cleanups: [], kitchen, status: kitchen ? "ready" : "loading", failure: "", dishes: [], restItems: new Map(), M: newModel(), writing: false, calmByUs: false,
    chipKeys: { ing: FIRST_INGREDIENTS.join(), cat: "" }, el: /** @type {any} */ ({}), view: { paintAll: () => {} },
  };
  root.innerHTML = pageHtml(ctx.status);
  pickElements(ctx);
  attachPackage(ctx);
  const wheelView = createWheelView(ctx, ctx.el.cardMain);
  const listView = createListView(ctx, ctx.el.cardList);
  wireFilters(ctx);
  wireEasy(ctx);
  ctx.view.paintAll = () => paintAll(ctx, wheelView, listView);
  ctx.cleanups.push(
    onKitchen((k) => {
      ctx.kitchen = k;
      if (ctx.status === "ready") ctx.view.paintAll();
    }),
  );
  ctx.view.paintAll();
  if (ctx.status === "loading") loadFirst(ctx);
  return () => teardown(ctx);
}
