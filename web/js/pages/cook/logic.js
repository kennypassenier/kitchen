// The pure logic of cook mode: which steps the cook sees, what the package is given for them, where a finished timer
// leads, the real start and end of each step, and the plan counted on from the real clock (Kenny, 24/10/2026 05:16).
// No DOM and no browser words: the sentences are passed in, so scripts/cook.test.mjs can run all of it in node.

import { ZONE, cap } from "../../format.js";

/** @typedef {Record<string, any>} Item */
/** @typedef {{ start?: number, end?: number }} Mark */
/** @typedef {{ start: number, end: number, state: "ok" | "running" | "planned", words: string, plannedEnd?: number }} Part */

export const MIN = 60000;

/** The recipe's steps the cook sees: all, or the mini ones. @param {Item} r @param {boolean} mini */
export const stepsOf = (r, mini) => (mini ? r.steps.filter((/** @type {Item} */ s) => s.mini) : r.steps);

/** What the focus-steps component is given for each step. @param {Item} r @param {Item[]} list */
export function focusStepsOf(r, list) {
  /** @param {string | null} id */
  const trackName = (id) => (id ? (r.tracks.find((/** @type {Item} */ t) => t.id === id)?.name ?? id) : undefined);
  return list.map((s) => ({
    id: s.id,
    title: cap(s.say) || undefined,
    text: s.text,
    ingredients: (s.uses ?? []).map((/** @type {Item} */ u) => ({ amount: u.amount, name: u.name })),
    timer: s.timer ? { seconds: s.timer.seconds, name: s.timer.name } : undefined,
    note: s.note || undefined,
    noteTone: s.note_tone === "warning" ? "warning" : undefined,
    track: trackName(s.track),
  }));
}

/**
 * Where a finished timer leads: the step after the one that started it, or the next step on the same track.
 * @param {Item[]} shown @param {{ id: string }} timer @returns {{ index: number, number: number, text: string } | null}
 */
export function nextAfter(shown, timer) {
  const at = shown.findIndex((s) => s.id === timer.id);
  if (at < 0) return null;
  const track = shown[at].track;
  let to = -1;
  for (let i = at + 1; i < shown.length; i++) {
    if (!track || shown[i].track === track) {
      to = i;
      break;
    }
  }
  if (to < 0) return null;
  const lane = track ? shown.filter((s) => s.track === track) : shown;
  return { index: to, number: lane.indexOf(shown[to]) + 1, text: shown[to].text };
}

/**
 * The real times: a step's start is when it came into hand, its end when it was passed. Changes `marks` in place: a passed
 * step gets its end, a step that is not passed any more loses it, the step in hand gets a start.
 * @param {Record<string, Mark>} marks @param {Item[]} shown @param {number} active @param {Set<number>} done @param {number} now
 */
export function markSteps(marks, shown, active, done, now) {
  shown.forEach((s, i) => {
    const m = marks[s.id];
    if (done.has(i)) {
      if (!m?.end) marks[s.id] = { start: m?.start, end: now };
    } else if (m?.end) delete marks[s.id];
    if (i === active && !done.has(i) && !marks[s.id]?.start) marks[s.id] = { ...marks[s.id], start: now };
  });
}

/** The moment cooking began: the earliest real start, or now. @param {Record<string, Mark>} marks @param {number} now */
export const firstOf = (marks, now) => Math.min(now, ...Object.values(marks).map((m) => m.start ?? now));

/** A moment as the clock in Brussels shows it, HH:MM. @param {number} ms */
export const clockAt = (ms) => new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms));

/**
 * Where a step still to do starts and how long it waits. A step that runs alongside another (`with`) is planned from where
 * that one is planned; it does not push its rows back. A step with a fixed `start` (minutes from the recipe's start, Kenny
 * 29/10/2026) is planned there, counted from the moment cooking began (`first`); it cannot begin before the real now, and what
 * lies between is a planned wait (in whole minutes, only when it is longer than half a minute past the rows' own free time).
 * @param {{ start?: unknown }} step @param {{ now: number, ahead: number, first: number, partner?: number }} at
 * @returns {{ start: number, waits: number }}
 */
export function plannedStart(step, { now, ahead, first, partner }) {
  const pinned = typeof step.start === "number" && Number.isFinite(step.start) && step.start >= 0;
  const fixed = pinned ? first + /** @type {number} */ (step.start) * MIN : null;
  const start = fixed !== null ? Math.max(now, fixed) : partner !== undefined ? Math.max(now, partner) : Math.max(now, ahead);
  const waits = fixed !== null && start > ahead + MIN / 2 ? Math.round((start - Math.max(now, ahead)) / MIN) : 0;
  return { start, waits };
}

/** @typedef {{ done: (how: string) => string, onIt: (how: string) => string, todo: (how: string) => string, todoAt: (how: string, at: string, waits: number) => string }} PlanText */

/**
 * One step as the plan draws it. A passed step sits where it really was, the one in hand grows (what is left of its time is
 * drawn after now, `plannedEnd`), the rest is counted on from now. `next` is when its rows are free again.
 * @param {"done" | "active" | "todo"} kind
 * @param {{ mins: number, mark?: Mark, now: number, ahead: number, first: number, partner?: number, step: { start?: unknown }, how: string }} s
 * @param {PlanText} text @returns {{ part: Part, next: number }}
 */
export function planStep(kind, { mins, mark, now, ahead, first, partner, step, how }, text) {
  if (kind === "done") {
    const start = Math.min(mark?.start ?? ahead, now - 1000);
    const end = Math.max(start + 30000, Math.min(now, mark?.end ?? start + mins * MIN));
    return { part: { start, end, state: "ok", words: text.done(how) }, next: end };
  }
  if (kind === "active") {
    const start = mark?.start ?? now;
    const planned = start + mins * MIN;
    return { part: { start, end: now, state: "running", words: text.onIt(how), plannedEnd: planned }, next: Math.max(now, planned) };
  }
  const { start, waits } = plannedStart(step, { now, ahead, first, partner });
  const words = waits > 0 ? text.todoAt(how, clockAt(start), waits) : text.todo(how);
  return { part: { start, end: start + mins * MIN, state: "planned", words }, next: partner !== undefined ? Math.max(ahead, start + mins * MIN) : start + mins * MIN };
}

/**
 * The whole plan from this moment, as the runs the timeline draws (one per row a step sits in).
 * @param {{ shown: Item[], lanes: { id: string, series?: unknown }[], rowsOf: (s: Item) => string[], marks: Record<string, Mark>, active: number, done: Set<number>, now: number, first: number }} p
 * @param {PlanText & { how: (mins: number, active: boolean) => string }} text
 */
export function planRuns({ shown, lanes, rowsOf, marks, active, done, now, first }, text) {
  /** @type {Map<string, number>} */
  const cursor = new Map(lanes.map((l) => [l.id, first]));
  /** @type {Map<string, number>} where each step starts in this plan, for the steps that run alongside it */
  const starts = new Map();
  const runs = [];
  let last = now;
  shown.forEach((s, i) => {
    const rows = rowsOf(s);
    const mins = Math.max(1, Number(s.mins) || 0);
    const ahead = Math.max(...rows.map((r) => cursor.get(r) ?? first));
    const kind = done.has(i) ? "done" : i === active ? "active" : "todo";
    const partner = typeof s.with === "string" ? starts.get(s.with) : undefined;
    const { part, next } = planStep(kind, { mins, mark: marks[s.id], now, ahead, first, partner, step: s, how: text.how(mins, s.active) }, text);
    starts.set(s.id, part.start);
    for (const row of rows) cursor.set(row, next);
    last = Math.max(last, next);
    const say = cap(s.say || String(s.text));
    for (const row of rows) {
      runs.push({ id: `${row}:${s.id}`, lane: row, label: say, start: part.start, end: part.end, state: part.state, series: lanes.find((l) => l.id === row)?.series, detail: `${say}, ${part.words}`, plannedEnd: part.plannedEnd });
    }
  });
  return { runs, last };
}

/** How many of the steps in a row are done: `[done, all]`. @param {Item[]} shown @param {(s: Item) => string[]} rowsOf @param {string} lane @param {Set<number>} done */
export function laneCounts(shown, rowsOf, lane, done) {
  const mine = shown.filter((s) => rowsOf(s).includes(lane));
  return [shown.filter((s, i) => rowsOf(s).includes(lane) && done.has(i)).length, mine.length];
}
