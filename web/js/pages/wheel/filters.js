// The filter chips: the counts and the chip lists the data makes, reading what the person pressed into the model (and the
// order they pressed it in), the clear button and the line that says what is filtered.

import { loadKitchen } from "../../api.js";
import { setSegmentedCounts, setSegmentedItems, setSegmentedTri, getSegmentedTri, SEGMENTED_EVENT } from "/static/kp/dist/kp-themes.min.js";
import { t } from "../../i18n/index.js";
import { cap } from "../../format.js";
import * as L from "./logic.js";
import * as C from "./constraints.js";
import { mealLabels, bandLabels } from "./labels.js";
import { catName, constraints, onWheel } from "./model.js";

/** The ingredient chips are the ingredients the dishes use, most used first. @param {import("./index.js").WheelCtx} ctx */
function paintIngredientChips(ctx) {
  const { M, dishes, el } = ctx;
  const shown = L.ingredientChips(dishes);
  const counts = L.countOf(dishes, "ing", shown);
  if (shown.join() !== ctx.chipKeys.ing) {
    ctx.chipKeys.ing = shown.join();
    setSegmentedItems(el.groups.ing, shown.map((v) => ({ value: v, label: cap(v), count: counts[v] })));
    M.ing = getSegmentedTri(el.groups.ing);
    M.order = C.dropGone(M.order, "ing", shown);
  }
  setSegmentedCounts(el.groups.meal, L.countOf(dishes, "meal", Object.keys(mealLabels())));
  setSegmentedCounts(el.groups.time, L.countOf(dishes, "time", Object.keys(bandLabels())));
  setSegmentedCounts(el.groups.ing, counts);
}

/** The category chips are the dish categories the dishes use, in their order (Kenny, 24/10/2026 09:17). @param {import("./index.js").WheelCtx} ctx */
function paintCategoryChips(ctx) {
  const { M, dishes, el } = ctx;
  const cats = L.categoryChips(ctx.kitchen?.dish_categories ?? [], dishes);
  const counts = L.countOf(dishes, "cat", cats);
  if (cats.join() !== ctx.chipKeys.cat) {
    ctx.chipKeys.cat = cats.join();
    setSegmentedItems(el.groups.cat, cats.map((v) => ({ value: v, label: catName(ctx, v), count: counts[v] })));
    M.cat = getSegmentedTri(el.groups.cat);
    M.order = C.dropGone(M.order, "cat", cats);
  }
  setSegmentedCounts(el.groups.cat, counts);
}

/** @param {import("./index.js").WheelCtx} ctx */
export function paintCounts(ctx) {
  const loading = ctx.status === "loading";
  for (const g of Object.values(ctx.el.groups)) g.toggleAttribute("aria-busy", loading);
  if (ctx.status !== "ready") return;
  paintIngredientChips(ctx);
  paintCategoryChips(ctx);
}

/** Show the model's chips on the components and paint everything again. @param {import("./index.js").WheelCtx} ctx */
export function paintChips(ctx) {
  for (const g of L.GROUPS) setSegmentedTri(ctx.el.groups[g], ctx.M[g]);
  ctx.view.paintAll();
}

/** Take what the person pressed into the model. @param {import("./index.js").WheelCtx} ctx @param {L.Group} group */
function readChips(ctx, group) {
  const now = getSegmentedTri(ctx.el.groups[group]);
  ctx.M.order = C.orderAfterChips(ctx.M.order, group, ctx.M[group], now);
  ctx.M[group] = now;
  ctx.view.paintAll();
}

/** Let go of every filter (the resting dishes and the easy switch stay). @param {import("./index.js").WheelCtx} ctx */
export function clearFilters(ctx) {
  for (const g of L.GROUPS) ctx.M[g] = L.emptyTri();
  ctx.M.order = ctx.M.order.filter((k) => !L.isFilterKey(k));
  paintChips(ctx);
  ctx.el.filtersLive.textContent = t("wheel.allLetGo");
}

/** The clear button and the live line under the chips. @param {import("./index.js").WheelCtx} ctx */
export function describeFilters(ctx) {
  const { el, status } = ctx;
  const all = constraints(ctx, ctx.M).filter((c) => L.isFilterKey(c.key));
  el.clearBtn.disabled = status !== "ready" || !all.length;
  el.clearBtn.setAttribute("data-kp-disabled-reason", status !== "ready" ? t("wheel.dishesLoading") : t("wheel.nothingFiltered"));
  if (status === "loading") el.filtersLive.textContent = t("wheel.loadingDot");
  else if (status === "error") el.filtersLive.textContent = t("wheel.failedFilter");
  else if (!all.length) el.filtersLive.textContent = t("wheel.nothingFilteredLive");
  else el.filtersLive.textContent = t("wheel.filterFit", all.map((c) => c.label).join(", "), onWheel(ctx, ctx.M).length, ctx.dishes.length);
}

/** @param {import("./index.js").WheelCtx} ctx */
export function wireFilters(ctx) {
  for (const group of L.GROUPS) {
    const on = () => readChips(ctx, group);
    ctx.el.groups[group].addEventListener(SEGMENTED_EVENT, on);
    ctx.cleanups.push(() => ctx.el.groups[group].removeEventListener(SEGMENTED_EVENT, on));
  }
  ctx.el.clearBtn.addEventListener("click", () => clearFilters(ctx));
}

/** Read the kitchen again (the cards' Try again). @param {import("./index.js").WheelCtx} ctx */
export async function reload(ctx) {
  if (ctx.status === "loading") return;
  ctx.status = "loading";
  ctx.view.paintAll();
  try {
    ctx.kitchen = await loadKitchen({ force: true });
    ctx.status = "ready";
  } catch (e) {
    ctx.failure = e instanceof Error ? e.message : String(e);
    ctx.status = "error";
  }
  ctx.view.paintAll();
}
