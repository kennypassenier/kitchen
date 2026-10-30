// The planning maths of the timing page: the Brussels wall clock and the plan counted back from dinner. Pure: no DOM,
// no words, so scripts can test it (the laying out itself is recipe/schedule.js).

import { layout, lanesOf, paced } from "../../recipe/schedule.js";
import { ZONE, pad, cap } from "../../format.js";
import { lang } from "../../i18n/index.js";
import { pick } from "../../recipe/bilingual.js";

/** @typedef {import("../../api.js").Item} Item */
/** @typedef {{ id: string, label: string, steps: Step[], start: number, series: 1 | 2 | 3 | 4 | 5 }} Lane */
/** @typedef {{ id: string, lane: string, label: string, say: string, mins: number, active: boolean, start: number, end: number }} Step */
/** @typedef {{ serve: number, end: number, lanes: Lane[], start: number, total: number, first: string }} Plan */

export const MIN = 60000;
/** The slow-day pace stretches only the hands-on steps. */
export const SLOW = 1.25;
export const DEFAULTS = { dinner_time: "18:30", pace: "normal", spare: 0 };
export const SPARES = [0, 5, 10, 15];

const parts = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** @param {number} ms @returns {Record<string, number>} the Brussels wall clock at that moment */
export function wall(ms) {
  return Object.fromEntries(parts.formatToParts(new Date(ms)).filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)]));
}
/** @param {string} time `HH:MM` @returns {number} that time today in Brussels, epoch ms */
export function at(time) {
  const [hh, mm] = time.split(":").map(Number);
  const w = wall(Date.now());
  const guess = Date.UTC(w.year, w.month - 1, w.day, hh, mm);
  const seen = wall(guess);
  // The guess was read as UTC: move it by what Brussels shows against what was asked.
  return guess - (Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute) - guess);
}
/** @param {number} ms @returns {string} `HH:MM` in Brussels */
export function hm(ms) {
  const w = wall(ms);
  return `${pad(w.hour)}:${pad(w.minute)}`;
}
/** Steps that can be counted back: a recipe needs at least one step with minutes. @param {Item} recipe */
export const timedSteps = (recipe) => (recipe.steps ?? []).filter((/** @type {Item} */ s) => Number(s.mins) > 0);
/** @param {Item} recipe */
export const hasTimes = (recipe) => timedSteps(recipe).length > 0;

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
