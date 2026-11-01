// One filter chip's three answers (Kenny, 01/11/2026 20:21, "Klein menu"): every chip opens a small menu with Want, Not and
// Either way, and the model keeps the answers as a tri ({ include, exclude }), exactly as before. This maps between the
// two; the filtering itself (logic.js fits) is unchanged. Pure: scripts/wheel-tri.test.mjs.

/** @typedef {import("./logic.js").Tri} Tri */
/** @typedef {"want" | "not" | "either"} TriState */

/** The menu's answers, in the order the menu shows them. @type {readonly TriState[]} */
export const TRI_STATES = /** @type {const} */ (["want", "not", "either"]);

/** @param {unknown} v @returns {v is TriState} */
export const isTriState = (v) => TRI_STATES.includes(/** @type {TriState} */ (v));

/** What a chip says now. @param {Tri} tri @param {string} value @returns {TriState} */
export function stateOf(tri, value) {
  if (tri.include.includes(value)) return "want";
  if (tri.exclude.includes(value)) return "not";
  return "either";
}

/**
 * The tri after one chip's answer: the value leaves both lists and joins the one its answer names; the other values keep
 * their place, so the order the person set them in survives. A new tri; the one given is not changed.
 * @param {Tri} tri @param {string} value @param {TriState} state @returns {Tri}
 */
export function withState(tri, value, state) {
  const include = tri.include.filter((v) => v !== value);
  const exclude = tri.exclude.filter((v) => v !== value);
  if (state === "want") include.push(value);
  if (state === "not") exclude.push(value);
  return { include, exclude };
}

/** The tri with only the values that still have a chip (an ingredient no dish uses any more). @param {Tri} tri @param {string[]} values @returns {Tri} */
export const keepOnly = (tri, values) => ({ include: tri.include.filter((v) => values.includes(v)), exclude: tri.exclude.filter((v) => values.includes(v)) });

/** The mark a chip shows for its answer (with the word beside it; the mark is never the only carrier). @param {TriState} state */
export const markOf = (state) => (state === "want" ? "✓" : state === "not" ? "✕" : "");
