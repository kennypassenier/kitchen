// The recipe editor's timeline as the kit's sequencer sees it (Kenny, 30/10/2026: "a draggable timeline", kp-themes 11.3.0
// `sequencer`). Pure, no DOM: it turns the editor's steps into the sequencer's items and lanes and turns an edited set of items
// back into the step fields, so the quick-add list and the timeline are two views of the same fields and never drift apart.
//
// The mapping, minutes from the recipe's start (schedule.js lays the steps out; this only reads and writes its inputs):
//   item.id       = step.id
//   item.lane     = step.track, or MEET for a step with no track (or a track that is gone): "where the tracks meet"
//   item.start    = where schedule.js puts the step (its own `start`, its partner's, or right after the previous step of its
//                   track); the sequencer always holds absolute starts
//   item.duration = step.mins (as written: a slow day's pace is a cook-mode thing, not part of the plan)
//   item.with     = step.with
// Writing back: lane -> track (MEET -> null), duration -> mins, with -> with. `start` is written only where schedule.js would
// NOT put the step there by itself, so a recipe that nobody dragged keeps `start` empty and still flows; a step that was
// dragged away from its flow gets the start it was dropped at. Within each track the list is then put in the order of the starts
// (stable; cook mode follows the list), and `start` is checked once more on the new order so what the timeline shows is exactly
// what schedule.js computes afterwards (the total and the hands-on time are read from there).

import { layout } from "./schedule.js";

/** The lane of the steps with no track, and the only lane of a recipe without tracks. */
export const MEET = "__meet";

/** @typedef {Record<string, any>} Step */
/** @typedef {{ id: string, name?: string }} Track */
/** @typedef {{ id: string, lane: string, start: number, duration: number, with: string | null }} Changed */

/**
 * The sequencer's items and lanes for the steps as they stand.
 * @param {Step[]} steps in cooking order, only steps that have text @param {Track[]} tracks only named tracks
 * @param {{ meet: string, all: string, unnamed: string, label: (s: Step, n: number) => string }} words the lane names and the bar label
 * @returns {{ items: { id: string, lane: string, label: string, start: number, duration: number, with: string | null, series: 1 | 2 | 3 | 4 | 5 }[], lanes: { id: string, label: string }[] }}
 */
export function toItems(steps, tracks, { meet, all, unnamed, label }) {
  const known = new Set(tracks.map((t) => t.id));
  const placed = layout(steps, tracks).steps;
  /** @type {{ id: string, label: string }[]} */
  const lanes = [...tracks.map((t) => ({ id: t.id, label: t.name || unnamed })), { id: MEET, label: tracks.length ? meet : all }];
  const series = new Map(lanes.map((l, i) => [l.id, /** @type {1 | 2 | 3 | 4 | 5} */ ((i % 5) + 1)]));
  const items = placed.map((p, i) => {
    const lane = known.has(p.step.track) ? p.step.track : MEET;
    return { id: p.id, lane, label: label(p.step, i + 1), start: p.start, duration: p.mins, with: typeof p.step.with === "string" && p.step.with ? p.step.with : null, series: /** @type {1 | 2 | 3 | 4 | 5} */ (series.get(lane)) };
  });
  return { items, lanes };
}

/**
 * The steps after an edit: the fields the timeline owns written from `items`, `start` kept honest, the list in the order of the
 * starts. Steps that are not among the items (no text yet) keep their place in the list and their fields.
 * @param {Step[]} steps the editor's steps in list order (all of them) @param {Track[]} tracks only named tracks @param {Changed[]} items
 * @returns {Step[]}
 */
export function fromItems(steps, tracks, items) {
  const by = new Map(items.map((i) => [i.id, i]));
  /** @type {Step[]} */
  const next = steps.map((s) => {
    const i = by.get(s.id);
    return i ? { ...s, track: i.lane === MEET ? null : i.lane, mins: i.duration, with: i.with } : s;
  });
  // Within each lane the steps stand in the order of their starts, in the slots that lane's steps already had: a track is a
  // sequence, and cook mode follows the list. The order across lanes is left alone, so dragging one step never reshuffles
  // the steps of the other tracks; the others stay in the slots they were in.
  /** @type {Map<string, number[]>} */
  const slots = new Map();
  next.forEach((st, at) => {
    if (by.has(st.id)) slots.set(st.track ?? MEET, [...(slots.get(st.track ?? MEET) ?? []), at]);
  });
  for (const at of slots.values()) {
    const ordered = at.map((i) => next[i]).sort((x, y) => /** @type {Changed} */ (by.get(x.id)).start - /** @type {Changed} */ (by.get(y.id)).start);
    at.forEach((i, k) => (next[i] = ordered[k]));
  }
  // `start` only where the flow of the list would put the step somewhere else.
  for (let at = 0; at < next.length; at++) {
    const want = by.get(next[at].id);
    if (!want) continue;
    const here = layout(next.slice(0, at + 1).filter((s) => by.has(s.id)), tracks).steps.at(-1);
    if (here && Math.abs(here.start - want.start) > 1e-9) next[at] = { ...next[at], start: want.start };
  }
  return next;
}
