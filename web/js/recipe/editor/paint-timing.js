// When the editor's timeline is painted again (fix-long-recipe-1, 02/11/2026). The kit's `setSequencerItems` redraws every
// clip (~4.6 s for 40 steps in Firefox, kp-gaps 02/11/2026), so painting on every key press froze a long recipe for seconds
// per letter. Typing now waits for a pause; a picked value, an added or removed row or a stepper still paints at once (a
// drop on the timeline paints itself, recipe/editor/timeline.js). Pure; tested by scripts/paint-timing.test.mjs.

/** How long typing must pause before the timeline follows it. */
export const TYPING_PAUSE_MS = 300;

/** The wait before a paint after an event of this type: a pause for typing, none for anything else. @param {string} type */
export const paintDelay = (type) => (type === "input" ? TYPING_PAUSE_MS : 0);

/**
 * One paint for a burst of events: an immediate one in a microtask (a burst of changes paints once), a typing one after
 * the pause, restarted by every key. An immediate paint replaces a waiting typing paint, since it shows that typing too.
 * The timers are passed in so node can test this.
 * @param {() => void} paint
 * @param {{ setTimer?: (fn: () => void, ms: number) => any, clearTimer?: (id: any) => void, soon?: (fn: () => void) => void }} [timers]
 */
export function createPaintQueue(paint, { setTimer = setTimeout, clearTimer = clearTimeout, soon = queueMicrotask } = {}) {
  /** @type {any} */
  let timer = null;
  let queued = false;
  const stopTimer = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };
  const run = () => {
    stopTimer();
    queued = false;
    paint();
  };
  return {
    /** @param {string} type the event's type */
    queue(type) {
      const wait = paintDelay(type);
      if (wait === 0) {
        stopTimer();
        if (!queued) {
          queued = true;
          soon(() => queued && run());
        }
        return;
      }
      // An immediate paint is already coming and will show this key too.
      if (queued) return;
      stopTimer();
      timer = setTimer(run, wait);
    },
    /** Drop a waiting paint (the editor goes away). */
    cancel() {
      stopTimer();
      queued = false;
    },
  };
}
