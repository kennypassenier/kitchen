// Small pure helpers of the bad-days page: texts, dates and the safe / mini recipes.

import { daysSinceCooked } from "../../api.js";

/** @typedef {import("../../api.js").Kitchen} Kitchen */
/** @typedef {import("../../api.js").Item} Item */

export const DAY = 86_400_000;
/** Days in the freezer before the quiet "Use these next" word shows. */
export const OLD_AFTER_DAYS = 60;
/** How long Undo is offered after Take one portion (approved: 10 s, ring). */
export const UNDO_MS = 10_000;

/** The first sentence of a text. @param {string} text */
export const firstSentence = (text) => (text.trim().match(/^.+?[.!?](?=\s|$)/) ?.[0] ?? text.trim());

/** When a kitchen item was frozen, in ms. @param {Item} item */
export const frozenAt = (item) => Date.parse(item.frozen_on);

/** The newest log date of a recipe as "YYYY-MM-DD", or null. @param {Kitchen} k @param {string} id */
export function lastMade(k, id) {
  let last = "";
  for (const e of k.log) if (e.recipe_id === id && e.date > last) last = e.date;
  return last || null;
}

/** The safe recipes, by name: tiles never reorder. @param {Kitchen} k */
export const safeRecipes = (k) =>
  k.recipes.filter((r) => r.safe === true).sort((a, b) => String(a.name).localeCompare(String(b.name), "en"));

/** The safe recipe with steps that was cooked longest ago (never counts as longest). @param {Kitchen} k */
export function miniRecipe(k) {
  const withSteps = safeRecipes(k).filter((r) => Array.isArray(r.steps) && r.steps.length > 0);
  let best = null;
  let bestDays = -1;
  for (const r of withSteps) {
    const days = daysSinceCooked(k, r.id);
    if (days > bestDays) {
      best = r;
      bestDays = days;
    }
  }
  return best;
}

/** A recipe's steps as focus-steps wants them. @param {Item[]} steps */
export const toFocusSteps = (steps) =>
  steps.map((s) => ({
    id: s.id,
    text: s.text,
    ...(s.uses?.length ? { ingredients: s.uses.map((/** @type {Item} */ u) => ({ amount: u.amount, name: u.name })) } : {}),
    ...(s.timer ? { timer: { seconds: s.timer.seconds, name: s.timer.name } } : {}),
    ...(s.note ? { note: s.note, noteTone: s.note_tone === "warning" ? "warning" : "info" } : {}),
  }));
