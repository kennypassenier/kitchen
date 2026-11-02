// What the full-viewport cook stage shows in each state (Kenny, 01/11/2026 20:21, "Volledig scherm"): the step in hand is
// always there with Back and Next pinned at the bottom; the running timers are pinned at the top only while one exists;
// the quiet "Gather first" button stands in the head until cooking has begun; the dinner offer replaces nothing and only
// shows once the last step is done. Everything else (Begin, explanations, timeline, discs, calm) is in the More sheet.
// Pure: scripts/cook-stage.test.mjs runs it in node.

/** Timer states the kit's list keeps on screen (js/timer.js): a stopped timer leaves the list. */
const LIVE_TIMER = new Set(["running", "paused", "done"]);

/**
 * @typedef {object} StageInput
 * @property {boolean} started Begin (or Skip) was pressed for this cook
 * @property {boolean} finished the last step is done
 * @property {{ state?: string }[]} timers the kit's timers now (getTimers)
 */

/**
 * @typedef {object} StageParts
 * @property {boolean} steps the step in hand (always)
 * @property {boolean} timers the timers bar pinned at the top
 * @property {boolean} gather the quiet "Gather first" button in the head
 * @property {boolean} done the "Log tonight's dinner" card
 * @property {number} running how many timers the bar holds
 */

/** @param {StageInput} input @returns {StageParts} */
export function stageParts({ started, finished, timers }) {
  const running = timers.filter((tm) => LIVE_TIMER.has(String(tm?.state ?? ""))).length;
  return { steps: true, timers: running > 0, gather: !started && !finished, done: finished, running };
}

/** The More sheet opens on the section asked for, or at its top. @param {string | null | undefined} target @param {string[]} ids */
export const sheetTarget = (target, ids) => (target && ids.includes(target) ? target : ids[0] ?? null);

/**
 * The mise en place: how many items are still to take out, and whether Start cooking is on. A recipe with nothing to take
 * out is ready at once (the readout says "Nothing to take out"); only Skip was left before. @param {{ checked?: boolean }[]} items
 * @returns {{ ready: boolean, left: number, total: number }}
 */
export function miseState(items) {
  const left = items.filter((i) => !i.checked).length;
  return { ready: left === 0, left, total: items.length };
}
