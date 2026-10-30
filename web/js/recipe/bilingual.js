// A recipe's step texts and notes in one or two languages (Kenny, 30/10/2026: "Optioneel"). The other language may be added
// but is never required: a text is either a plain string (one text, shown in both languages, the shape every imported or
// older recipe has) or `{nl, en}` with both halves written. A half left empty is the same as a plain string, so the store
// needs no new rule and the format stays as it was. Pure, no DOM: the editor, the readers and scripts/bilingual.test.mjs
// all use this one module.

/** @typedef {"nl" | "en"} Lang */
/** @typedef {string | { nl?: string, en?: string }} Text */

/** The other language. @param {Lang} lang @returns {Lang} */
const otherOf = (lang) => (lang === "nl" ? "en" : "nl");

/** @param {unknown} v @param {Lang} lang the half of an object, trimmed, "" when it has none */
const half = (v, lang) => {
  const o = /** @type {Record<string, unknown> | null} */ (v && typeof v === "object" ? v : null);
  return String(o?.[lang] ?? "").trim();
};

/**
 * The text to show in `lang`: a plain string as it is, an object's half in `lang`, else the half it has in the other language.
 * @param {unknown} v @param {Lang} lang
 * @returns {string}
 */
export function pick(v, lang) {
  if (typeof v === "string") return v;
  return half(v, lang) || half(v, otherOf(lang));
}

/**
 * The two editor fields for a stored text, seen from the language the editor is shown in: `main` is the text to show in `lang`
 * (with the fallback, so an editor always shows the text there is), `other` the half in the other language, "" when there is
 * none. A plain string, or an object that has only one half, has no second text.
 * @param {unknown} v @param {Lang} lang
 * @returns {{ main: string, other: string }}
 */
export function halves(v, lang) {
  if (typeof v === "string") return { main: v, other: "" };
  const mine = half(v, lang);
  const theirs = half(v, otherOf(lang));
  return mine && theirs ? { main: mine, other: theirs } : { main: mine || theirs, other: "" };
}

/**
 * The stored text from the two editor fields: `{nl, en}` only when both halves have words, otherwise one plain string (the
 * half there is), so a text never carries an empty half. Nothing typed is "".
 * @param {string} main the field of the language the editor is shown in @param {string} other the optional second language @param {Lang} lang
 * @returns {Text}
 */
export function combine(main, other, lang) {
  const m = main.trim();
  const o = other.trim();
  if (!m || !o) return m || o;
  return lang === "nl" ? { nl: m, en: o } : { nl: o, en: m };
}

/** A stored text trimmed, in either shape. @param {Text} v @returns {Text} */
export function tidy(v) {
  if (typeof v === "string") return v.trim();
  return combine(half(v, "nl"), half(v, "en"), "nl");
}

/**
 * A step with its `text` and `note` as plain strings in `lang`, for the screens that only read (cook mode, the timing page,
 * the print sheet): every other field is passed through.
 * @template {Record<string, any>} S @param {S} step @param {Lang} lang
 * @returns {S}
 */
export function localStep(step, lang) {
  return { ...step, text: pick(step.text, lang), ...(step.note === undefined ? {} : { note: pick(step.note, lang) }) };
}
