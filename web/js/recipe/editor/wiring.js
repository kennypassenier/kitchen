// The form's events: the meeting lane follows the steps before it (recipe/meet.js), the timeline, the two times and the
// warning about imported lines are painted again after every change.

import { settle } from "../meet.js";

const CHANGE_EVENTS = ["input", "change", "kp-quantity-change", "rl-rows-change"];

/**
 * @param {{ form: HTMLFormElement, steps: ReturnType<typeof import("./steps.js").stepFields>, timeline: ReturnType<typeof import("./timeline.js").timelineFields>, times: ReturnType<typeof import("./times.js").timeFields>, lists: ReturnType<typeof import("./lists.js").listFields> }} o
 */
export function wireForm({ form, steps, timeline, times, lists }) {
  const { host: seqHost, namedTracks } = timeline;
  /** The meeting lane follows the steps before it (recipe/meet.js): a moved start is written into its field before anything is read. */
  const settleFields = (/** @type {Event} */ ev) => {
    if (timeline.syncing || seqHost.contains(/** @type {Node} */ (ev.target)) || (ev.type === "input" && steps.list.some((e) => e.start === ev.target))) return;
    const rows = steps.live();
    const now = rows.map((e) => e.get());
    const after = settle(now, namedTracks());
    after.forEach((st, i) => {
      if (st !== now[i]) /** @type {any} */ (rows[i]).set(st);
    });
  };
  for (const type of CHANGE_EVENTS) form.addEventListener(type, settleFields);
  settleFields(new Event("change"));
  for (const type of CHANGE_EVENTS) form.addEventListener(type, timeline.queuePaint);
  timeline.paint();
  for (const type of CHANGE_EVENTS) form.addEventListener(type, times.refreshTimes);
  times.refreshTimes();
  for (const type of ["input", "change", "kp-combobox-change", "rl-rows-change"]) form.addEventListener(type, () => setTimeout(lists.paintUnresolved, 0));
  lists.paintUnresolved();
}
