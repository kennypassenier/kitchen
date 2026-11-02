// How a recipe timeline meets the width it is given: the one place where the page's wish ("fit" or "scroll") becomes the
// kit gantt's attributes. Pure (scripts/timeline-fit.test.mjs).
//
// kp-themes 12.2.0 (gantt-fit-1101, checked against its CHANGELOG on 02/11/2026 with chassis-rs 4.2.0) adds
// `data-kp-gantt-scroll="fit"`: the whole window shown, no sideways scroll, labels never clipped, lanes only as tall as
// their rows. An older kit does not know "fit" and would treat it as its default, a 30rem plot that scrolls sideways (the
// clipped last bar Kenny saw), so "fit" is asked only from a kit that has it, and "off" (the plot takes the width it is
// given) before that. Cook mode at 390 px measured with it: 0 px sideways scroll, 0 clipped labels, 0 bars past the edge.

/** @typedef {"fit" | "scroll"} TimelineFit */

/** The first kp-themes version that carries `data-kp-gantt-scroll="fit"` (12.2.0, confirmed in its CHANGELOG). */
export const FIT_FROM = "12.2.0";

/** Whether version `v` is `min` or newer (major.minor.patch; anything unreadable counts as older). @param {string} v @param {string} min */
export function atLeast(v, min) {
  const parse = (/** @type {string} */ s) => (/^\d+\.\d+\.\d+/.test(String(s)) ? String(s).split(".").slice(0, 3).map((n) => parseInt(n, 10)) : null);
  const a = parse(v);
  const b = parse(min);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
}

/** The gantt's attributes for a wish and the kit's version. @param {TimelineFit | string | undefined} fit @param {string} kitVersion @returns {Record<string, string>} */
export function ganttFitAttrs(fit, kitVersion) {
  if (fit !== "fit") return { "data-kp-gantt-scroll": "auto" };
  return { "data-kp-gantt-scroll": atLeast(kitVersion, FIT_FROM) ? "fit" : "off" };
}

/** The attributes as markup, for the timeline's template. @param {TimelineFit | string | undefined} fit @param {string} kitVersion */
export const ganttFitMarkup = (fit, kitVersion) =>
  Object.entries(ganttFitAttrs(fit, kitVersion))
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
