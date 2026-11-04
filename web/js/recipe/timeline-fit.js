// How a recipe timeline meets the width it is given: the one place where the page's wish ("fit" or "scroll") becomes the
// kit gantt's attributes. Pure (scripts/timeline-fit.test.mjs).
//
// "fit" is the kit's `data-kp-gantt-scroll="fit"`: the whole window shown, no sideways scroll, labels never clipped,
// lanes only as tall as their rows (cook mode at 390 px: 0 px sideways scroll, 0 clipped labels, 0 bars past the edge).
// "scroll" keeps the kit's readable plot that scrolls sideways inside its frame.

/** @typedef {"fit" | "scroll"} TimelineFit */

/** The gantt's attributes for a wish. @param {TimelineFit | string | undefined} fit @returns {Record<string, string>} */
export function ganttFitAttrs(fit) {
  return { "data-kp-gantt-scroll": fit === "fit" ? "fit" : "auto" };
}

/** The attributes as markup, for the timeline's template. @param {TimelineFit | string | undefined} fit */
export const ganttFitMarkup = (fit) =>
  Object.entries(ganttFitAttrs(fit))
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
