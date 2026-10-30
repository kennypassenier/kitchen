// Kitchen in Dutch or English (Kenny, 24/10/2026 05:12): a toggle top right, left of the theme picker, switches every
// page's words and which name of a dish, side, ingredient or category is shown. Every word a page shows lives in one
// place per language (./en.js and ./en-pages.js, ./nl.js and ./nl-pages.js) and is read with `t("page.key", …args)`;
// the package's own words (tables, forms, dialogs, the wheel) come from ./kp-nl.js through kp's `setStrings`. Dates
// stay dd/mm/yyyy in both.
//
// The choice is the kitchen's `settings.lang` (kitchen.json, the same key the recipe page has read since 1.0.0), so it
// follows Kenny from the phone to the PC; the browser keeps a copy only to draw the first frame in the right language
// before the kitchen has loaded. English is the default. The parents' page on eten.kp-soft.dev stays Dutch.

import { pick } from "../recipe/bilingual.js";
import { setStrings, DEFAULT_STRINGS } from "/static/kp/js/strings.js";
import { EN as EN_CORE } from "./en.js";
import { NL as NL_CORE } from "./nl.js";
import { EN_PAGES } from "./en-pages.js";
import { NL_PAGES } from "./nl-pages.js";
import { KP_NL } from "./kp-nl.js";

/** @typedef {"en" | "nl"} Lang */

const KEY = "kitchen:lang";
// The shell, the lists' editors and the dish and ingredient screens (en.js, nl.js); the wheel, timing, bad days,
// settings, recipes, the recipe page and cook mode (en-pages.js, nl-pages.js).
const EN = { ...EN_CORE, ...EN_PAGES };
const NL = { ...NL_CORE, ...NL_PAGES };
const BOOKS = /** @type {Record<Lang, Record<string, any>>} */ ({ en: EN, nl: NL });

/** @type {Lang} */
let current = readKept();
/** @type {Set<(lang: Lang) => void>} */
const listeners = new Set();

/** @returns {Lang} */
function readKept() {
  try {
    return localStorage.getItem(KEY) === "nl" ? "nl" : "en";
  } catch {
    return "en";
  }
}

/** The language Kitchen is shown in. */
export const lang = () => current;

/**
 * The words for `key` in the current language, else in English, else the key itself (so a missing word shows up
 * instead of hiding). A word may be a function of the arguments: `t("log.count", 3)`.
 * @param {string} key @param {...any} args
 * @returns {string}
 */
export function t(key, ...args) {
  const word = BOOKS[current][key] ?? EN[key];
  if (word === undefined) return key;
  return typeof word === "function" ? word(...args) : String(word);
}

/** Change the package's words with the language. @param {Lang} l */
function applyKp(l) {
  setStrings(l === "nl" ? KP_NL : DEFAULT_STRINGS);
  document.documentElement.lang = l;
}

/**
 * Show Kitchen in `l`. `kept` is what the kitchen's settings say: it wins over the browser's copy once loaded.
 * @param {Lang} l
 */
export function useLang(l) {
  const next = l === "nl" ? "nl" : "en";
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* a private window: the settings still keep it */
  }
  if (next === current) return;
  current = next;
  applyKp(next);
  for (const fn of listeners) fn(next);
}

/** Run `fn` when the language changes; returns what stops it. @param {(lang: Lang) => void} fn */
export function onLang(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * The name of an item with `{name: {nl, en}}` in the current language, else its other half. `other` tells whether the
 * other half stood in, so a list can mark it with a small language badge.
 * @param {Record<string, any> | null | undefined} item
 * @returns {{ text: string, other: Lang | null }}
 */
export function nameOf(item) {
  const mine = String(item?.name?.[current] ?? "").trim();
  if (mine) return { text: mine, other: null };
  const o = current === "nl" ? "en" : "nl";
  const theirs = String(item?.name?.[o] ?? "").trim();
  return theirs ? { text: theirs, other: o } : { text: t("common.noName"), other: null };
}

/**
 * A text kept in both languages (`{nl, en}`, Kenny 24/10/2026 10:04) in the language shown, else its other half; a
 * plain string, from before, as it is.
 * @param {unknown} v
 * @returns {string}
 */
export function textOf(v) {
  return pick(v, current);
}

applyKp(current);
