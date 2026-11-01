// How a recipe timeline meets the width it is given: the one place where the page's wish ("fit" or "scroll") becomes the
// kit gantt's attributes. Pure (scripts/timeline-fit.test.mjs).
//
// HOOK (Kenny, 01/11/2026 "Passend maken"; docs/OPEN.md, ~/Projects/kp-gaps/kitchen.md): kp-themes has built a gantt
// fit-to-width mode for narrow screens on its main, not released. Adopt it here when it reaches Kitchen through a
// chassis-rs release: add its attribute to the "fit" branch below (and drop the lower rows in css/pages/cook.css if the
// kit's mode makes them unnecessary). Until then "fit" uses what the kit has today: `data-kp-gantt-scroll="off"`, so the
// plot is the width it is given and no bar runs out of a scrolled frame.

/** @typedef {"fit" | "scroll"} TimelineFit */

/** @param {TimelineFit | string | undefined} fit @returns {Record<string, string>} */
export function ganttFitAttrs(fit) {
  if (fit === "fit") return { "data-kp-gantt-scroll": "off" };
  return { "data-kp-gantt-scroll": "auto" };
}

/** The attributes as markup, for the timeline's template. @param {TimelineFit | string | undefined} fit */
export const ganttFitMarkup = (fit) =>
  Object.entries(ganttFitAttrs(fit))
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
