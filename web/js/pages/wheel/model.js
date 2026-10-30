// The page's data as the wheel reads it, and what fits it: the dishes derived from the kitchen, the odds and the dinner time
// from the settings, and the model's constraints. The rules themselves are in logic.js; this binds them to the page's ctx.

import { daysSinceCooked, defaultRecipe, recipeLabel } from "../../api.js";
import { nameOf, t } from "../../i18n/index.js";
import * as L from "./logic.js";
import { constraintWords } from "./labels.js";

/** @typedef {import("./logic.js").Dish} Dish */
/** @typedef {import("./logic.js").Model} Model */

export const odds = (/** @type {import("./index.js").WheelCtx} */ ctx) => String(ctx.kitchen?.settings?.odds ?? "equal");
export const dinnerTime = (/** @type {import("./index.js").WheelCtx} */ ctx) => L.dinnerTimeOf(ctx.kitchen?.settings?.dinner_time);

/** Read the dishes and the resting items from the kitchen again. @param {import("./index.js").WheelCtx} ctx */
export function derive(ctx) {
  const k = ctx.kitchen;
  const freezer = (k?.freezer ?? []).filter((f) => Number(f.portions) > 0);
  ctx.restItems = L.restingByDish(k?.resting ?? []);
  ctx.M.resting = new Set(ctx.restItems.keys());
  ctx.dishes = (k?.dishes ?? []).map((d) => L.dishFrom(d, defaultRecipe(d), { label: nameOf(d).text, days: k ? daysSinceCooked(k, d.id) : Infinity, freezer, recipeLabelOf: recipeLabel }));
}

/** @param {import("./index.js").WheelCtx} ctx @param {string} id */
export const byId = (ctx, id) => ctx.dishes.find((d) => d.id === id);

/** A dish category's name in the language shown. @param {import("./index.js").WheelCtx} ctx @param {string} id */
export function catName(ctx, id) {
  const c = ctx.kitchen?.dish_categories.find((x) => x.id === id);
  return c ? nameOf(c).text : id;
}

/** @param {import("./index.js").WheelCtx} ctx @param {Model} m */
export const onWheel = (ctx, m) => ctx.dishes.filter((d) => L.fits(d, m));
/** @param {import("./index.js").WheelCtx} ctx @param {Dish} d */
export const weight = (ctx, d) => L.weightOf(d, odds(ctx));
/** @param {import("./index.js").WheelCtx} ctx @param {Dish} d */
export const bigger = (ctx, d) => L.isBigger(d, odds(ctx));

/** @param {import("./index.js").WheelCtx} ctx */
const wordsOf = (ctx) => constraintWords((id) => byId(ctx, id)?.label, (v) => catName(ctx, v));
/** @param {import("./index.js").WheelCtx} ctx @param {Model} m */
export const constraints = (ctx, m) => L.constraintsOf(m, wordsOf(ctx));
/** @param {import("./index.js").WheelCtx} ctx @param {Model} m */
export const filterCount = (ctx, m) => constraints(ctx, m).filter((c) => L.isFilterKey(c.key)).length;
/** @param {import("./index.js").WheelCtx} ctx @param {Model} m */
export function blockText(ctx, m) {
  const all = constraints(ctx, m);
  return all.length ? t("wheel.noFitAll", all.map((c) => c.label).join(", ")) : t("wheel.noneLeft");
}
/** Note that a constraint was set (goes last) or let go. @param {import("./index.js").WheelCtx} ctx @param {string} key @param {boolean} on */
export const track = (ctx, key, on) => (ctx.M.order = L.tracked(ctx.M.order, key, on));
/** @param {import("./index.js").WheelCtx} ctx */
export const pickToLoosen = (ctx) => L.pickToLoosen(ctx.M, wordsOf(ctx), ctx.dishes);
