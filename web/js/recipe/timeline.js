// The recipe timeline: the kp gantt set up the one way both screens use it (Kenny, 24/10/2026 05:16). The timing page
// counts a plan back from dinner; cook mode follows the plan as the steps are finished. Both show the recipe's tracks as
// rows and every step as a bar, so the setup lives here once: the markup, the loading frame, the redraw when the width
// changes, and the package's calls that paint lanes, bars, marks, stretches and the legend. A page builds its lanes and
// runs and hands them to drawTimeline(); the package does the rest (axis, line for now, states, hover cards, keys).

import { attachGantts, setGanttWindow, setGanttKinds, setGanttLegend, setGanttPoints, setGanttRuns, setGanttState, setGanttZones } from "/static/kp/dist/kp-themes.min.js";

export { setGanttState as setTimelineState };

/** @typedef {import("/static/kp/dist/kp-themes.min.js").GanttRun} TimelineRun */
/** @typedef {import("/static/kp/dist/kp-themes.min.js").GanttLane} TimelineLane */
/** @typedef {import("/static/kp/dist/kp-themes.min.js").GanttPoint} TimelinePoint */
/** @typedef {import("/static/kp/dist/kp-themes.min.js").GanttKind} TimelineKind */
/** @typedef {import("/static/kp/dist/kp-themes.min.js").GanttZone} TimelineZone */

/**
 * Put the timeline into `slot` (already in the page), attached and in its loading frame with the lane names and the axis
 * beside the busy card. `redraw` is called when the width changes enough to move the bar labels.
 * @param {HTMLElement} slot
 * @param {{ label: string, loading: string, legend?: "off" | "on", strings?: Record<string, string>, redraw?: () => void }} o
 * @returns {{ el: HTMLElement, detach: () => void }}
 */
export function mountTimeline(slot, { label, loading, legend = "off", strings = {}, redraw }) {
  const safe = label.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  slot.innerHTML = `<section class="kp-gantt" data-kp-gantt data-kp-gantt-range="all" data-kp-gantt-toolbar="off" data-kp-gantt-legend="${legend}" data-kp-gantt-hint="off" data-kp-gantt-ghosts="1 1 1" aria-label="${safe}"></section>`;
  const el = /** @type {HTMLElement} */ (slot.firstElementChild);
  const off = attachGantts(slot, { strings: { ganttLoading: loading, ...strings } });
  setGanttState(el, "loading");
  let width = 0;
  const watch = new ResizeObserver(() => {
    const now = Math.round(el.clientWidth / 40);
    if (width && now !== width) redraw?.();
    width = now;
  });
  watch.observe(el);
  return {
    el,
    detach: () => {
      watch.disconnect();
      off();
    },
  };
}

/**
 * Paint the plan: the lanes, the runs (one bar per step), optional marks and stretches, and the legend of the tracks.
 * The window is fixed on the plan (`from` to `to`, epoch ms), never the whole day up to the real now.
 * @param {HTMLElement} el
 * @param {{ lanes: (TimelineLane & { series: 1 | 2 | 3 | 4 | 5 })[], runs: TimelineRun[], from: number, to: number, points?: TimelinePoint[], kinds?: TimelineKind[], zones?: TimelineZone[] }} o
 */
export function drawTimeline(el, { lanes, runs, from, to, points = [], kinds = [], zones = [] }) {
  el.setAttribute("data-kp-gantt-ghosts", lanes.map(() => "1").join(" "));
  setGanttRuns(el, runs, lanes);
  setGanttPoints(el, points, lanes);
  setGanttWindow(el, { span: Math.max(60, Math.round((to - from) / 1000)), live: false, to });
  setGanttKinds(el, kinds);
  setGanttZones(el, zones);
  setGanttLegend(el, lanes.length > 1 ? lanes.map((l) => ({ series: l.series, label: l.label })) : []);
}
