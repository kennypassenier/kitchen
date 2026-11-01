// Tonight's wheel answer, kept so "When do I start?" can open on it (Kenny, 01/11/2026 20:21, "Eén kiezer": one picker,
// preselected from tonight's wheel answer). The wheel kept nothing before: its answer lived only on the page. Now the dish
// the wheel stops on, with the recipe "Yes, cook this" would open, is written to this browser's localStorage for the day
// it was given (Europe/Brussels); the next day it is gone. Never sent to the server: it is a convenience, not a record.
// The reading and writing rules are pure (scripts/tonight.test.mjs); the storage calls never throw (private mode, quota).

import { today } from "./format.js";

export const TONIGHT_KEY = "kitchen:tonight";

/** @typedef {{ day: string, dish: string, recipe: string }} Tonight */

/** What is written for a wheel answer, or null for a dish without a recipe. @param {{ id: string, cookId?: string | null }} dish @param {string} day @returns {Tonight | null} */
export function tonightOf(dish, day) {
  if (!dish?.id || !dish.cookId) return null;
  return { day, dish: String(dish.id), recipe: String(dish.cookId) };
}

/** The recipe of tonight's answer from what was stored, or null when there is none, it is another day's, or unreadable. @param {string | null} raw @param {string} day */
export function tonightRecipe(raw, day) {
  if (!raw) return null;
  try {
    const t = JSON.parse(raw);
    return t && typeof t === "object" && t.day === day && typeof t.recipe === "string" && t.recipe ? t.recipe : null;
  } catch {
    return null;
  }
}

/** Keep the wheel's answer for today (a dish without a recipe clears it). @param {{ id: string, cookId?: string | null }} dish */
export function rememberTonight(dish) {
  try {
    const rec = tonightOf(dish, today());
    if (rec) localStorage.setItem(TONIGHT_KEY, JSON.stringify(rec));
    else localStorage.removeItem(TONIGHT_KEY);
  } catch (e) {
    console.warn("Kitchen: tonight's wheel answer could not be kept", e);
  }
}

/** The recipe id of tonight's wheel answer, or null. */
export function tonightRecipeId() {
  try {
    return tonightRecipe(localStorage.getItem(TONIGHT_KEY), today());
  } catch {
    return null;
  }
}
