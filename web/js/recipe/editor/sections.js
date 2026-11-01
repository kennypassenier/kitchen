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
 * restored draft is new work from the start): every section that holds fields counts as changed.
 * @param {Record<string, any> | null} opening @param {Record<string, any>} now @returns {string[]}
 */
export function changedSections(opening, now) {
  const held = SECTIONS.filter((s) => s.fields.length);
  if (!opening) return held.map((s) => s.key);
  return held.filter((s) => s.fields.some((f) => JSON.stringify(opening[f]) !== JSON.stringify(now[f]))).map((s) => s.key);
}
