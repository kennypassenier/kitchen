// The editor page's sections: which fields of the recipe body each one holds, so the unsaved bar can name the sections that
// changed (the kit's bar lists "rows"; here a row is a section). Pure; tested by scripts/edit-page.test.mjs.

/** `key` names the section, `id` is its element id, `words` the i18n keys of its title and sentence, `fields` the recipe-body keys it holds. */
export const SECTIONS = [
  { key: "dish", id: "rl-sec-dish", title: "edit.secDish", text: "edit.secDishText", fields: ["dish_id", "new_dish", "label", "short", "summary", "source", "meals", "ing", "photo"] },
  { key: "time", id: "rl-sec-time", title: "edit.secTime", text: "edit.secTimeText", fields: ["minutes", "hands_on", "minutes_override", "hands_on_override", "portions", "prep", "safe", "gear"] },
  { key: "notes", id: "rl-sec-notes", title: "edit.secNotes", text: "edit.secNotesText", fields: ["last_note", "mini_note"] },
  { key: "lists", id: "rl-sec-lists", title: "edit.secLists", text: "edit.secListsText", fields: ["tracks", "ingredients", "tools"] },
  { key: "timeline", id: "rl-sec-timeline", title: "edit.secTimeline", text: "edit.secTimelineText", fields: [] },
  { key: "steps", id: "rl-sec-steps", title: "edit.secSteps", text: "edit.secStepsText", fields: ["steps"] },
];

/**
 * The keys of the sections whose fields differ. `opening` null means there is nothing to compare with (a copy, an import or a
 * restored draft is new work from the start): every section that holds fields counts as changed. `isNew`: a recipe not saved
 * yet; once it has a dish (chosen or named) it is worth saving even with nothing else typed, so its dish section counts as
 * changed (fix-dish-only-save-1: a new recipe opened from its dish said "No changes" and could not be saved).
 * `unsaved`: a copy, an import or a restored new draft, which is new work however little differs from how it opened; it
 * counts what differs, or its dish section when nothing does, never every section (fix-change-count-1).
 * @param {Record<string, any> | null} opening @param {Record<string, any>} now @param {{ isNew?: boolean, unsaved?: boolean }} [o] @returns {string[]}
 */
export function changedSections(opening, now, { isNew = false, unsaved = false } = {}) {
  const held = SECTIONS.filter((s) => s.fields.length);
  if (!opening) return held.map((s) => s.key);
  const diff = held.filter((s) => s.fields.some((f) => JSON.stringify(opening[f]) !== JSON.stringify(now[f]))).map((s) => s.key);
  return !diff.length && isNew && (unsaved || now.dish_id || now.new_dish) ? ["dish"] : diff;
}

/**
 * The section a refused field of the recipe body sits in (fix-field-limits-1): its first key decides; a dish's name, or
 * anything the sections do not hold, belongs to the first section. `field` as the server names it, without `recipes[i].`.
 * @param {string} field @returns {string}
 */
export function sectionOf(field) {
  const top = field.split(/[.[]/)[0];
  return SECTIONS.find((s) => s.fields.includes(top))?.key ?? "dish";
}
