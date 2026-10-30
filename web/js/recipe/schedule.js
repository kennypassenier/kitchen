// Where each step of a recipe falls in time (Kenny, 29/10/2026: steps get `start` and `with`, the recipe's total and
// hands-on time become computed). One pure module, no DOM, no i18n, no api: the editor shows the computed figures, the
// timing page counts a plan back from dinner and cook mode draws its lanes from it, and the editor's draggable timeline
// (recipe/sequence.js, the kit's sequencer) reads and writes the same fields.
//
// The model, minutes from the recipe's start:
//   - a recipe has tracks ("Pasta", "Sauce"); a step is on one track, or on none (or on a track that is gone): that step
//     is where the tracks meet and it is in every track's row, so it starts after every step before it, on every track;
//   - a step with `start` (a number) is placed there, whatever came before it; the steps after it follow it;
//   - a step with `with` (a step id) starts together with that step ("runs alongside") and does not push its own track's
//     next step back: that one still follows whatever was there before;
//   - any other step follows the previous step of its track ("null = right after the previous step in its track").
// A step takes `stretch(step)` minutes (the step's `mins`, or what a slow day's pace makes of it).
//
// The total is the critical path (the latest end); the hands-on time is the union of the intervals of the `active`
// steps, so two hands-on steps that run alongside count once.

/** @typedef {Record<string, any>} Step */
/** @typedef {{ id: string, step: Step, rows: string[], start: number, end: number, mins: number }} Placed */
/** @typedef {{ id: string, name: string | null, series: 1 | 2 | 3 | 4 | 5 }} Lane */
/** @typedef {{ steps: Placed[], lanes: Lane[], rowsOf: (s: Step) => string[], total: number, handsOn: number }} Schedule */

/** How long a step takes as written. @param {Step} s */
const written = (s) => Math.max(0, Number(s.mins) || 0);

/** Whole minutes of a pace: the hands-on steps are stretched, the walk-away ones are not. @param {number} pace */
export const paced = (pace) => (/** @type {Step} */ s) => Math.ceil(written(s) * (s.active ? pace : 1));

/**
 * The rows of a recipe: each track that has a step here, else one row for the whole recipe (id "all", no name: the
 * caller says what to call it). A step with no track, or a track that is gone, is in every row.
 * @param {Step[]} steps @param {{ id: string, name?: string }[]} tracks
 * @returns {{ lanes: Lane[], rowsOf: (s: Step) => string[] }}
 */
export function lanesOf(steps, tracks) {
  const own = tracks.filter((t) => steps.some((s) => s.track === t.id));
  /** @type {Lane[]} */
  const lanes = own.length ? own.map((t, i) => ({ id: t.id, name: t.name ?? "", series: /** @type {1 | 2 | 3 | 4 | 5} */ ((i % 5) + 1) })) : [{ id: "all", name: null, series: 1 }];
  const known = new Set(own.map((t) => t.id));
  const all = lanes.map((l) => l.id);
  return { lanes, rowsOf: (s) => (known.has(s.track) ? [s.track] : all) };
}

/** The union of intervals, in minutes. @param {[number, number][]} spans */
function union(spans) {
  const sorted = spans.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let sum = 0;
  let [from, to] = [0, 0];
  for (const [a, b] of sorted) {
    if (a > to || to === 0) {
      sum += to - from;
      [from, to] = [a, b];
    } else to = Math.max(to, b);
  }
  return sum + (to - from);
}

/** A step that is placed by hand: it has its own start, or runs alongside another. @param {Step} s */
const pinned = (s) => (typeof s.start === "number" && Number.isFinite(s.start) && s.start >= 0) || (typeof s.with === "string" && s.with !== "");

/**
 * Lay the steps out. `align: "start"` (the default) lets every step begin as early as it may; `"end"` lets every step
 * begin as late as it may without the recipe taking longer (the timing page counts back from dinner and starts each
 * track just in time; a step placed by hand keeps its place and one that runs alongside follows its partner).
 * @param {Step[]} steps in cooking order @param {{ id: string, name?: string }[]} tracks
 * @param {{ stretch?: (s: Step) => number, align?: "start" | "end" }} [o]
 * @returns {Schedule}
 */
export function layout(steps, tracks, { stretch = written, align = "start" } = {}) {
  const { lanes, rowsOf } = lanesOf(steps, tracks);
  /** @type {Map<string, number>} */
  const cursor = new Map(lanes.map((l) => [l.id, 0]));
  /** @type {Map<string, Placed>} */
  const byId = new Map();
  /** @type {Placed[]} */
  const placed = [];
  for (const step of steps) {
    const rows = rowsOf(step);
    const mins = Math.max(0, stretch(step));
    const ahead = Math.max(...rows.map((r) => cursor.get(r) ?? 0));
    const partner = typeof step.with === "string" ? byId.get(step.with) : undefined;
    const own = typeof step.start === "number" && Number.isFinite(step.start) && step.start >= 0;
    const start = own ? step.start : partner ? partner.start : ahead;
    const end = start + mins;
    for (const r of rows) cursor.set(r, !own && partner ? Math.max(cursor.get(r) ?? 0, end) : end);
    /** @type {Placed} */
    const p = { id: String(step.id ?? placed.length), step, rows, start, end, mins };
    placed.push(p);
    byId.set(p.id, p);
  }
  const total = Math.max(0, ...placed.map((p) => p.end));
  if (align === "end") {
    /** @type {Map<string, number>} */
    const latest = new Map(lanes.map((l) => [l.id, total]));
    for (let i = placed.length - 1; i >= 0; i--) {
      const p = placed[i];
      // A step placed by hand keeps its place and bounds nobody: the steps before it on its track are bounded by the
      // steps after it that move (one that runs alongside does not push its track, so it must not pull it either).
      if (pinned(p.step)) continue;
      p.end = Math.min(...p.rows.map((r) => latest.get(r) ?? total));
      p.start = p.end - p.mins;
      for (const r of p.rows) latest.set(r, Math.min(latest.get(r) ?? total, p.start));
    }
    for (const p of placed) {
      const partner = typeof p.step.with === "string" ? byId.get(p.step.with) : undefined;
      if (partner && !(typeof p.step.start === "number" && p.step.start >= 0)) {
        p.start = partner.start;
        p.end = p.start + p.mins;
      }
    }
  }
  const handsOn = union(placed.filter((p) => p.step.active).map((p) => /** @type {[number, number]} */ ([p.start, p.end])));
  return { steps: placed, lanes, rowsOf, total, handsOn };
}

/**
 * The recipe's computed total and hands-on minutes, and the ones to store: a typed override wins; a recipe whose steps
 * have no minutes yet (an older one, or an empty draft) keeps the figures it has.
 * @param {Record<string, any>} recipe
 * @param {{ steps?: Step[], tracks?: { id: string, name?: string }[], minutes_override?: number | null, hands_on_override?: number | null }} [now] what the editor holds, when it differs from the stored recipe
 * @returns {{ total: number, handsOn: number, minutes: number, hands_on: number, minutes_override: number | null, hands_on_override: number | null }}
 */
export function effective(recipe, now = {}) {
  const steps = now.steps ?? recipe.steps ?? [];
  const sched = layout(steps, now.tracks ?? recipe.tracks ?? []);
  const pick = (/** @type {unknown} */ typed, /** @type {number} */ computed, /** @type {unknown} */ stored) => {
    const over = typeof typed === "number" && Number.isFinite(typed) ? typed : null;
    return { over, value: over ?? (computed > 0 ? computed : Number(stored) || 0) };
  };
  const m = pick("minutes_override" in now ? now.minutes_override : recipe.minutes_override, sched.total, recipe.minutes);
  const h = pick("hands_on_override" in now ? now.hands_on_override : recipe.hands_on_override, sched.handsOn, recipe.hands_on);
  return { total: sched.total, handsOn: sched.handsOn, minutes: m.value, hands_on: h.value, minutes_override: m.over, hands_on_override: h.over };
}
