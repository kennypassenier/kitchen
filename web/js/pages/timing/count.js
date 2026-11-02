// Which steps the timing page counts, and how long they take together. Pure: no DOM, no words
// (scripts/timing-count.test.mjs); the laying out is recipe/schedule.js, the one the plan, cook mode and the editor use.

import { layout, paced } from "../../recipe/schedule.js";

/** @typedef {import("../../api.js").Item} Item */

/** Steps that can be counted back: a recipe needs at least one step with minutes. @param {Item} recipe */
export const timedSteps = (recipe) => (recipe.steps ?? []).filter((/** @type {Item} */ s) => Number(s.mins) > 0);
/** @param {Item} recipe */
export const hasTimes = (recipe) => timedSteps(recipe).length > 0;

/**
 * The recipe's counted minutes from the first step to the plate, every track kept: the same figure the plan counts back
 * from dinner (feat-timing-durations-1), not the `minutes` stored with the recipe (an import's or a typed figure).
 * @param {Item} recipe @param {number} [pace] the stretch of the hands-on steps, 1 as written
 */
export function countedMinutes(recipe, pace = 1) {
  const sched = layout(timedSteps(recipe), /** @type {Item[]} */ (recipe.tracks ?? []), { stretch: paced(pace), align: "end" });
  // The plan starts at its first step: a recipe whose first step is placed by hand later than 0 starts there too.
  return sched.steps.length ? sched.total - Math.min(...sched.steps.map((p) => p.start)) : 0;
}
