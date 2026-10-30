// The recipe editor's pure logic (no DOM, no words): mapping the step rows to steps, which rows count, the two times,
// the label and dish name, and the form read back into a recipe (the saved body and the draft). Tested by
// scripts/editor.test.mjs; the editor's parts read the fields and pass plain values in.

import { effective } from "../schedule.js";
import { settle } from "../meet.js";
import { tidy } from "../bilingual.js";

/** Tracks with a name (an unnamed track row counts nowhere). @param {Record<string, any>[]} list */
export const namedOnly = (list) => list.filter((tk) => tk.name);

/** Is the Override switch on for a time? A typed figure wins; so does a stored one with nothing computed (an older recipe). */
export const timeOverride = (/** @type {number | null | undefined} */ typed, /** @type {number} */ computed, /** @type {number} */ stored) => typeof typed === "number" || (computed === 0 && stored > 0);

/** The step rows that have text: the one set the times, the timeline and the meeting-lane pass all read (empty rows count nowhere). @template {{ get: () => any }} E @param {E[]} entries */
export const liveRows = (entries) => entries.filter((e) => e.get().text);

/**
 * The two times from the steps as they stand, and what is stored: a typed override wins.
 * @param {Record<string, any>} r the recipe as it was @param {Record<string, any>[]} steps the live steps @param {Record<string, any>[]} trackList
 * @param {{ minutes: number | null, hands: number | null }} typed the typed figures, null when Override is off
 */
export function timesOf(r, steps, trackList, typed) {
  const tracks = namedOnly(trackList);
  return effective(r, { steps: settle(steps, tracks), tracks, minutes_override: typed.minutes, hands_on_override: typed.hands });
}

/**
 * One step row's fields as a step. `v` holds the raw field values; the trimming and the timer rule live here.
 * @param {{ id: string, track: string, text: import("../bilingual.js").Text, say: string, mins: number, active: boolean, hasTimer: boolean, timerName: string, timerSeconds: string, uses: [string, string][], note: import("../bilingual.js").Text, warn: boolean, mini: boolean, photos: string[], start: string, partner: string, timerDefault: string }} v
 */
export function stepFromFields(v) {
  const secs = Number(v.timerSeconds);
  const name = v.timerName.trim();
  return {
    id: v.id,
    track: v.track || null,
    // The text and the note are one plain string or `{nl, en}` (recipe/bilingual.js: the other language is optional).
    text: tidy(v.text),
    say: v.say.trim(),
    mins: v.mins,
    active: v.active,
    timer: v.hasTimer && secs > 0 ? { seconds: secs, name: name || v.timerDefault } : null,
    uses: v.uses.map(([amount, what]) => ({ amount, name: what })).filter((u) => u.amount || u.name),
    note: tidy(v.note),
    note_tone: v.warn ? "warning" : "",
    mini: v.mini,
    photos: v.photos,
    // Where the step falls in time (Kenny, 29/10/2026): recipe/schedule.js.
    start: v.start === "" ? null : Math.max(0, Number(v.start)),
    with: v.partner || null,
  };
}

/** The track select's options: the meeting lane first, then each track. @param {Record<string, any>[]} trackList @param {{ meet: string, unnamed: string }} words @returns {[string, string][]} */
export const trackChoices = (trackList, { meet, unnamed }) => [["", meet], ...trackList.map((tk) => /** @type {[string, string]} */ ([tk.id, tk.name || unnamed]))];

/** The partner list of one step: every other step, by its number and the start of its text. @param {{ id: string, text: { value: string } }[]} entries @param {string} selfId @param {{ none: string, unnamed: string }} words @returns {[string, string][]} */
export const partnerChoices = (entries, selfId, { none, unnamed }) => [
  ["", none],
  ...entries.filter((e) => e.id !== selfId).map((e) => /** @type {[string, string]} */ ([e.id, `${entries.indexOf(e) + 1}. ${e.text.value.trim().slice(0, 40) || unnamed}`])),
];

/** A step that runs alongside a step that is gone (or itself) runs on its own. @param {Record<string, any>[]} list */
export const tidyWith = (list) => list.map((s) => (s.with && s.with !== s.id && list.some((x) => x.id === s.with) ? s : { ...s, with: null }));

/**
 * The recipe's label from the field: both halves or none (the server refuses one half).
 * @param {Record<string, any>} r @param {string} typed the field @param {string} ownLabel what the field showed first @param {"nl" | "en"} language
 */
export function labelOut(r, typed, ownLabel, language) {
  const text = typed.trim();
  const old = { nl: String(r.label?.nl ?? ""), en: String(r.label?.en ?? "") };
  if (text === ownLabel) return old;
  if (!text) return { nl: "", en: "" };
  const other = language === "nl" ? "en" : "nl";
  return { ...old, [language]: text, [other]: old[other].trim() || text };
}

/** The dish named in the first field, as the name to show: an existing dish's, or the new one's. @param {{ id: string | null, name: { nl: string, en: string } | null }} choice @param {Record<string, any>[]} dishes @param {"nl" | "en"} language */
export function dishText(choice, dishes, language) {
  const other = language === "nl" ? "en" : "nl";
  const d = choice.id ? dishes.find((x) => x.id === choice.id) : null;
  return String(d?.name?.[language] || d?.name?.[other] || choice.name?.[language] || "").trim();
}

/** The imported lines still without an ingredient, by what the page said. @param {Record<string, any>[]} lines */
export const unresolvedOf = (lines) => lines.filter((n) => !n.ingredient && n.proposal).map((n) => String(n.proposal.text));

/**
 * The form as a recipe body, for Save and for the draft. `forDraft` keeps imported ingredient lines the catalogue does not
 * know yet (a Save is blocked while any is left). A new recipe carries its preset along (`base`); `dish_id` puts it into a
 * dish (Kenny, 24/10/2026 09:27), `new_dish` makes a dish with it, and another dish for an existing recipe moves it.
 * @param {Record<string, any>} base the recipe, or the preset of a new one
 * @param {{ choice: { id: string | null, name: any } | null, label: { nl: string, en: string }, shortTyped: string, dishName: string, summary: string, source: string, meals: string[], ing: string[], times: Record<string, any>, portions: number, prep: string, safe: boolean, gear: string, lastNote: string, miniNote: string, trackRows: Record<string, any>[], ingredientRows: [Record<string, any>, any, any, any][], toolRows: Record<string, any>[], steps: Record<string, any>[], photo: string | null }} v
 * @param {boolean} [forDraft]
 */
export function recipeBody(base, v, forDraft = false) {
  return {
    ...base,
    dish_id: v.choice?.id ?? null,
    new_dish: v.choice?.name ?? null,
    label: v.label,
    short: v.shortTyped.trim() || v.dishName.split(/\s+/)[0] || "",
    summary: v.summary.trim(),
    source: v.source.trim() || null,
    meals: v.meals,
    ing: v.ing,
    // The two times as they are stored (Kenny, 29/10/2026): the computed figure, or the typed one when Override is on;
    // `minutes` and `hands_on` always hold the effective value so every reader keeps working.
    minutes: v.times.minutes,
    hands_on: v.times.hands_on,
    minutes_override: v.times.minutes_override,
    hands_on_override: v.times.hands_on_override,
    portions: v.portions,
    prep: v.prep,
    safe: v.safe,
    gear: v.gear.trim(),
    last_note: v.lastNote.trim(),
    mini_note: v.miniNote.trim(),
    tracks: namedOnly(v.trackRows),
    ingredients: v.ingredientRows.map(([n, amount, unit, group]) => ({ ...n, amount, unit, group })).filter((i) => i.ingredient || (forDraft && i.proposal)),
    tools: namedOnly(v.toolRows),
    steps: tidyWith(v.steps.filter((s) => s.text)),
    photo: v.photo,
  };
}
