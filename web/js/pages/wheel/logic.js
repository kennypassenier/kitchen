// The pure logic of the wheel page: which dishes fit the filters, the size of a slice (the odds), what holds dishes back and
// which of those to let go first, the "recent history" rules (days since cooked, resting dishes, the freezer's portions), the
// chips the data makes, when to start, and the dates in the cards. No DOM and no browser words (the words are passed in),
// so scripts/wheel.test.mjs runs all of it in node. The behaviour is Kenny's approved wheel (24/10/2026); nothing here is new.

import { pad, hhmm, dmyDate, localIso } from "../../format.js";

/** @typedef {{ include: string[], exclude: string[] }} Tri */
/** @typedef {Record<string, any>} Dish a dish as the wheel sees it, with what its recipe adds (see dishFrom) */
/** @typedef {{ meal: Tri, time: Tri, ing: Tri, cat: Tri, easy: boolean, kinds: Set<string>, resting: Set<string>, order: string[] }} Model what the person asked for, in memory only */
/** @typedef {"meal" | "time" | "ing" | "cat"} Group */

/** The ingredient chips before the dishes have loaded; once they have, the chips are the ingredients the dishes use. */
export const FIRST_INGREDIENTS = ["chicken", "beef", "egg", "cheese", "tomato", "potato"];
/** A dish not cooked for this many days gets a bigger slice (when the odds are not equal). */
export const LONG_DAYS = 21;
/** What "No energy today" can count as easy: the safe favourites, the freezer, the dishes with no prep. */
export const KINDS = ["safe", "freezer", "noprep"];
/** The four filter groups. */
export const GROUPS = /** @type {const} */ (["meal", "time", "ing", "cat"]);
/** A constraint key that comes from a filter chip (the others are resting dishes and the easy switch). @param {string} key */
export const isFilterKey = (key) => /^(meal|time|ing|cat):/.test(key);

/** @param {unknown} s */
export const norm = (s) => String(s ?? "").trim().toLowerCase();
/** The time band of a recipe: up to 20 min is quick, up to 45 mid, else long. @param {number} m */
export const band = (m) => (m <= 20 ? "quick" : m <= 45 ? "mid" : "long");
/** @param {Dish} d @param {string} k */
export const isKind = (d, k) => (k === "safe" ? d.safe : k === "freezer" ? d.freezer > 0 : d.prep === "none");
/** @returns {Tri} */
export const emptyTri = () => ({ include: [], exclude: [] });
/** @returns {Model} a model with nothing asked */
export const newModel = () => ({ meal: emptyTri(), time: emptyTri(), ing: emptyTri(), cat: emptyTri(), easy: false, kinds: new Set(KINDS), resting: new Set(), order: [] });

/** How many dishes each chip value would show. @param {Dish[]} dishes @param {string} group @param {string[]} values */
export function countOf(dishes, group, values) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const v of values) {
    out[v] = dishes.filter((d) => (group === "meal" ? d.meals.includes(v) : group === "time" ? band(d.minutes) === v : group === "cat" ? d.category === v : d.ing.includes(v))).length;
  }
  return out;
}

/** A date `n` days back, on the device's calendar. @param {number} n @param {Date} [now] */
export function daysAgo(n, now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return d;
}

/** The last day a dish set aside rests: a week from today, as YYYY-MM-DD. @param {Date} [now] */
export function restUntil(now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() + 7);
  return d;
}

/** The dinner time from the settings as HH:MM, 18:30 when it is missing or not a time. @param {unknown} raw */
export function dinnerTimeOf(raw) {
  const t = String(raw ?? "");
  return /^\d{1,2}:\d{2}$/.test(t) ? `${pad(Number(t.split(":")[0]))}:${t.split(":")[1]}` : "18:30";
}

/**
 * Counting back from dinner: when to start, or (too late) when it would be ready if started now.
 * @param {string} dinner HH:MM @param {number} minutes the recipe's total @param {number} nowMin minutes after midnight now
 * @returns {{ ok: true, start: string } | { ok: false, ready: string }}
 */
export function startPlan(dinner, minutes, nowMin) {
  const [hh, mm] = dinner.split(":").map(Number);
  const start = hh * 60 + mm - minutes;
  return start >= nowMin ? { ok: true, start: hhmm(start) } : { ok: false, ready: hhmm(nowMin + minutes) };
}

/** How the "last cooked" line starts: never, today, yesterday or n days ago. @param {number} days */
export const lastCookedKind = (days) => (!Number.isFinite(days) ? "never" : days === 0 ? "today" : days === 1 ? "yesterday" : "ago");

/** The date a dish was last cooked, dd/mm/yyyy. @param {number} days @param {Date} [now] */
export const lastCookedDate = (days, now) => dmyDate(daysAgo(days, now));

/** The portions of a dish in the freezer: by its id, or by a name that matches in either language. @param {Dish} d @param {Record<string, any>[]} freezer the items with portions left */
export function freezerPortions(d, freezer) {
  return freezer
    .filter((f) => f.dish_id === d.id || [d.name?.nl, d.name?.en].some((n) => n && [f.dish?.nl, f.dish?.en, typeof f.dish === "string" ? f.dish : ""].some((x) => x && norm(x) === norm(n))))
    .reduce((n, f) => n + Number(f.portions), 0);
}

/**
 * A dish as the wheel sees it. The wheel picks from the dishes (Kenny, 24/10/2026 09:17): every dish is on it, whatever its
 * parents' mark. A dish's own recipe (09:18) gives what the filters and the answer need; a dish without one has no time, meal
 * or main ingredients yet, and only a filter that asks for those leaves it out. The default recipe speaks for the dish (09:27).
 * @param {Record<string, any>} d the stored dish @param {Record<string, any> | undefined} r its default recipe
 * @param {{ label: string, days: number, freezer: Record<string, any>[], recipeLabelOf: (r: any, index: number) => string }} extra
 * @returns {Dish}
 */
export function dishFrom(d, r, { label, days, freezer, recipeLabelOf }) {
  const recipes = d.recipes ?? [];
  return {
    id: d.id,
    label,
    short: label,
    meals: r?.meals ?? [],
    minutes: Number(r?.minutes) || 0,
    ing: r?.ing ?? [],
    days,
    safe: !!r?.safe,
    freezer: freezerPortions(d, freezer),
    prep: r?.prep ?? "full",
    recipe: !!r,
    cookId: r?.id ?? null,
    others: recipes.filter((/** @type {any} */ x) => x.id !== r?.id).map((/** @type {any} */ x) => ({ id: x.id, label: recipeLabelOf(x, recipes.indexOf(x)) })),
    category: d.category ?? null,
    sides: d.sides ?? [],
  };
}

/** The resting items still in force, by dish. @param {Record<string, any>[]} resting @param {Date} [now] @returns {Map<string, any>} */
export function restingByDish(resting, now = new Date()) {
  const today = localIso(now);
  const out = new Map();
  for (const r of resting) if (String(r.until) >= today && r.dish_id) out.set(r.dish_id, r);
  return out;
}

/** Whether a dish is on the wheel for this model. @param {Dish} d @param {Model} m @param {{ filters?: boolean, resting?: boolean, easy?: boolean }} [skip] */
export function fits(d, m, skip = {}) {
  if (!skip.filters) {
    if (m.meal.include.length && !m.meal.include.some((x) => d.meals.includes(x))) return false;
    if (m.meal.exclude.some((x) => d.meals.includes(x))) return false;
    if (m.time.include.length && !m.time.include.includes(band(d.minutes))) return false;
    if (m.time.exclude.includes(band(d.minutes))) return false;
    if (!m.ing.include.every((x) => d.ing.includes(x))) return false;
    if (m.ing.exclude.some((x) => d.ing.includes(x))) return false;
    if (m.cat.include.length && !m.cat.include.includes(String(d.category))) return false;
    if (m.cat.exclude.includes(String(d.category))) return false;
  }
  if (!skip.resting && m.resting.has(d.id)) return false;
  if (!skip.easy && m.easy && ![...m.kinds].some((k) => isKind(d, k))) return false;
  return true;
}

/** The size of a dish's slice: equal by default; the settings may ask for long-not-eaten or freezer first. @param {Dish} d @param {string} mode */
export function weightOf(d, mode) {
  if (mode === "equal") return 1;
  let w = Number.isFinite(d.days) ? Math.min(5, Math.max(0.6, 0.6 + d.days / 8)) : 5;
  if (mode === "freezer" && d.freezer > 0) w *= 3;
  return Math.round(w * 10) / 10;
}

/** A dish with a bigger slice because it was not cooked for a long time. @param {Dish} d @param {string} mode */
export const isBigger = (d, mode) => mode !== "equal" && d.days >= LONG_DAYS;

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

/** The ingredient chips: the ingredients the dishes use, most used first (then by name); the first six before any dish. @param {Dish[]} dishes */
export function ingredientChips(dishes) {
  const all = new Map();
  for (const d of dishes) for (const i of d.ing) all.set(i, (all.get(i) ?? 0) + 1);
  const names = [...all.keys()].sort((a, b) => all.get(b) - all.get(a) || a.localeCompare(b));
  return names.length ? names : FIRST_INGREDIENTS;
}

/** The category chips: the dish categories the dishes use, in their order (Kenny, 24/10/2026 09:17). @param {Record<string, any>[]} categories @param {Dish[]} dishes */
export function categoryChips(categories, dishes) {
  return [...categories].sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9)).map((c) => String(c.id)).filter((id) => dishes.some((d) => d.category === id));
}
