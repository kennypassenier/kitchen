// What holds dishes back and how to let it go: the constraints, which one to let go first, and the order they were set in.
// Pure (the words are passed in); the filter logic they use is in logic.js. scripts/wheel.test.mjs runs all of it in node.

import { KINDS, fits } from "./logic.js";

/** @typedef {import("./logic.js").Model} Model */
/** @typedef {import("./logic.js").Dish} Dish */
/** @typedef {import("./logic.js").Tri} Tri */
/** @typedef {import("./logic.js").Group} Group */

/** @param {Model} m @returns {Model} */
export const copyOf = (m) => ({
  meal: structuredClone(m.meal),
  time: structuredClone(m.time),
  ing: structuredClone(m.ing),
  cat: structuredClone(m.cat),
  easy: m.easy,
  kinds: new Set(m.kinds),
  resting: new Set(m.resting),
  order: [...m.order],
});

/**
 * @typedef {object} Words how the constraints are named (the page passes its translations)
 * @property {(v: string) => string} meal @property {(v: string) => string} time @property {(v: string) => string} cat
 * @property {(id: string) => string} dish a resting dish's name @property {(k: string) => string} kind
 * @property {(n: string) => string} with @property {(n: string) => string} without @property {(n: string) => string} not
 * @property {(n: string) => string} resting @property {(k: string) => string} notCounting @property {string} noEnergy
 */

/**
 * Everything that holds dishes back, each with how to let it go (on the model it is given).
 * @param {Model} m @param {Words} w @returns {{ key: string, label: string, release: () => void }[]}
 */
export function constraintsOf(m, w) {
  /** @type {{ key: string, label: string, release: () => void }[]} */
  const out = [];
  /** @param {Group} group @param {(v: string) => string} name */
  const tri = (group, name) => {
    for (const state of /** @type {const} */ (["include", "exclude"])) {
      for (const value of m[group][state]) {
        const n = name(value);
        const label = group === "ing" ? (state === "include" ? w.with(n) : w.without(n)) : state === "include" ? n : w.not(n);
        out.push({ key: `${group}:${value}`, label, release: () => (m[group][state] = m[group][state].filter((x) => x !== value)) });
      }
    }
  };
  tri("meal", w.meal);
  tri("time", w.time);
  tri("ing", (v) => v);
  tri("cat", w.cat);
  for (const id of m.resting) out.push({ key: `rest:${id}`, label: w.resting(w.dish(id)), release: () => m.resting.delete(id) });
  if (m.easy) {
    for (const k of KINDS) {
      if (!m.kinds.has(k)) out.push({ key: `kind:${k}`, label: w.notCounting(w.kind(k)), release: () => m.kinds.add(k) });
    }
  }
  if (m.easy && !out.length) out.push({ key: "easy", label: w.noEnergy, release: () => (m.easy = false) });
  return out;
}

/** The one thing that frees the most dishes when let go (the later one on a tie). @param {Model} m @param {Words} w @param {Dish[]} dishes */
export function pickToLoosen(m, w, dishes) {
  const all = constraintsOf(m, w);
  if (!all.length) return null;
  let pick = all[all.length - 1];
  let best = -1;
  for (const c of all) {
    const copy = copyOf(m);
    constraintsOf(copy, w).find((x) => x.key === c.key)?.release();
    const n = dishes.filter((d) => fits(d, copy)).length;
    if (n >= best) {
      best = n;
      pick = c;
    }
  }
  return pick;
}

/** The order the constraints were set in: this key goes last when on, and out when off. @param {string[]} order @param {string} key @param {boolean} on */
export function tracked(order, key, on) {
  const next = order.filter((k) => k !== key);
  if (on) next.push(key);
  return next;
}

/** The order after a chip group changed from `prev` to `now`: new values go last, values that left every state go. @param {string[]} order @param {Group} group @param {Tri} prev @param {Tri} now */
export function orderAfterChips(order, group, prev, now) {
  let out = order;
  for (const state of /** @type {const} */ (["include", "exclude"])) for (const v of now[state]) if (!prev[state].includes(v)) out = tracked(out, `${group}:${v}`, true);
  for (const state of /** @type {const} */ (["include", "exclude"])) for (const v of prev[state]) if (!now.include.includes(v) && !now.exclude.includes(v)) out = tracked(out, `${group}:${v}`, false);
  return out;
}

/** The order without the constraints of a group whose chip is gone. @param {string[]} order @param {string} prefix @param {string[]} keep */
export const dropGone = (order, prefix, keep) => order.filter((k) => !k.startsWith(`${prefix}:`) || keep.includes(k.slice(prefix.length + 1)));
