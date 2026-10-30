// The meeting lane follows the steps before it (Kenny, 30/10/2026, "Automatisch": a step where the tracks meet moves along
// by itself when a step before it gets longer or moves, so it never overlaps one and the total stays right without dragging).
// One pure module, no DOM: the editor runs it on every edit, on every drop on the timeline and before it computes the totals,
// so the step list, the timeline and the figures agree. The kit's sequencer moves nothing across lanes, so this is where it
// happens.
//
// The rule, minutes from the recipe's start:
//   - a "meeting step" has no track (or a track that is gone) in a recipe that has tracks, and no `with`;
//   - where the flow of the list puts it (right after every step before it, on every track: schedule.js) is its earliest
//     start; a pinned `start` is "not earlier than" that: one at or before it is dropped (the step follows the flow), one
//     after it stays (a step dragged later keeps its later start);
//   - it only ever moves later. When a step before it shrinks, a step that follows the flow (no `start`) follows it back,
//     and one pinned later than the flow stays where it was dropped, because that was the person's choice.
// The steps after a moved meeting step follow it through schedule.js itself, which is why the pass goes in list order.

import { layout, lanesOf } from "./schedule.js";

/** @typedef {Record<string, any>} Step */

const hasStart = (/** @type {Step} */ s) => typeof s.start === "number" && Number.isFinite(s.start) && s.start >= 0;

/**
 * The steps with every meeting step that starts before its flow position put back on the flow (`start` null). Steps that
 * change are copies; the others are the same objects, so `settle(steps) === steps` when nothing moved.
 * @param {Step[]} steps in cooking order @param {{ id: string, name?: string }[]} tracks
 * @returns {Step[]}
 */
export function settle(steps, tracks) {
  const { lanes } = lanesOf(steps, tracks);
  if (lanes[0].id === "all") return steps; // no tracks: a single lane, nothing to meet
  const known = new Set(lanes.map((l) => l.id));
  const next = steps.slice();
  for (let i = 0; i < next.length; i++) {
    const s = next[i];
    if (known.has(s.track) || !hasStart(s) || (typeof s.with === "string" && s.with !== "")) continue;
    const flow = layout([...next.slice(0, i), { ...s, start: null }], tracks).steps.at(-1)?.start ?? 0;
    if (s.start <= flow + 1e-9) next[i] = { ...s, start: null };
  }
  return next.some((s, i) => s !== steps[i]) ? next : steps;
}
