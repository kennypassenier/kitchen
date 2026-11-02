// The planning maths of the timing page: the plan counted back from dinner (the wall clock is clock.js). Pure: no DOM,
// no words, so scripts can test it (the laying out itself is recipe/schedule.js).

import { layout, lanesOf, paced } from "../../recipe/schedule.js";
import { cap } from "../../format.js";
import { wall, at, hm } from "./clock.js";
import { timedSteps, hasTimes, countedMinutes } from "./count.js";
import { lang } from "../../i18n/index.js";
import { pick } from "../../recipe/bilingual.js";

// The wall clock lives in clock.js (pure, tested on its own); the pages import it from here.
export { wall, at, hm };
// Which steps count and their counted total live in count.js (pure, tested on its own).
export { timedSteps, hasTimes, countedMinutes };

/** @typedef {import("../../api.js").Item} Item */
/** @typedef {{ id: string, label: string, steps: Step[], start: number, series: 1 | 2 | 3 | 4 | 5 }} Lane */
/** @typedef {{ id: string, lane: string, label: string, say: string, mins: number, active: boolean, start: number, end: number }} Step */
/** @typedef {{ serve: number, end: number, lanes: Lane[], start: number, total: number, first: string }} Plan */

export const MIN = 60000;
/** The slow-day pace stretches only the hands-on steps. */
export const SLOW = 1.25;
export const DEFAULTS = { dinner_time: "18:30", pace: "normal", spare: 0 };
export const SPARES = [0, 5, 10, 15];


/**
 * Count back from dinner: every lane ends `spare` minutes before it, each step takes its minutes (hands-on ones
 * stretched by the pace) and a lane starts where its first step starts. The laying out is recipe/schedule.js (the
 * one cook mode and the editor use too): a step without a track is where the tracks meet and closes every lane, a
 * recipe without tracks is one lane, and a step with its own `start` or one that runs alongside another keeps that.
 * @param {Item} recipe
 * @param {{ serve: number, spare: number, pace: number, dropped: Set<string> }} input
 * @returns {Plan | null}
 */
export function planFor(recipe, { serve, spare, pace, dropped }) {
  const timed = timedSteps(recipe);
  if (timed.length === 0) return null;
  const tracks = /** @type {Item[]} */ (recipe.tracks ?? []);
  const every = lanesOf(timed, tracks).lanes;
  // A lane the person dropped goes with its own steps; the steps where the tracks meet stay.
  const kept = every.filter((l) => !dropped.has(l.id));
  const dropIds = kept.length > 0 ? new Set(every.filter((l) => !kept.includes(l)).map((l) => l.id)) : new Set();
  const steps = timed.filter((s) => !dropIds.has(s.track));
  const sched = layout(steps, tracks, { stretch: paced(pace), align: "end" });
  const end = serve - spare * MIN;
  const origin = end - sched.total * MIN;
  const lanes = sched.lanes.map((src) => {
    const own = sched.steps
      .filter((p) => p.rows.includes(src.id))
      .map((p) => {
        const s = p.step;
        const mins = p.mins;
        return { id: `${src.id}:${s.id}`, lane: src.id, label: cap(s.say || pick(s.text, lang())), say: s.say || pick(s.text, lang()).toLowerCase(), mins, active: Boolean(s.active), start: origin + p.start * MIN, end: origin + p.end * MIN };
      });
    return { id: src.id, label: src.name ?? (recipe.short || recipe.name), series: src.series, steps: own, start: Math.min(...own.map((x) => x.start)) };
  });
  const start = Math.min(...lanes.map((l) => l.start));
  const first = lanes.flatMap((l) => l.steps).find((s) => s.start === start);
  return { serve, end, lanes, start, total: end - start, first: first?.say ?? "" };
}
