// One line of What I ate from the fields a person filled in (the log drawer's edit and the inline add row on /log, Kenny
// 01/11/2026 20:21 "Invoerrij"). Pure: the words are keys, so scripts/records.test.mjs runs it in node.

/**
 * @typedef {object} LogFields
 * @property {string} what "d:<dish id>" or "s:<shelf food id>"; "" when nothing is chosen
 * @property {string | null} day YYYY-MM-DD, null when the date does not read
 * @property {string} feeling "easy", "fine", "heavy", or "none"
 * @property {string} note
 */

/**
 * The log line to save, or which field is wrong (`error` and `remedy` are word keys).
 * @param {LogFields} f @param {string} today YYYY-MM-DD in Brussels
 * @returns {{ dish_id: string | null, shelf_id: string | null, date: string, feeling: string | null, note: string } | { error: string, remedy: string, field: "what" | "day" }}
 */
export function logLine({ what, day, feeling, note }, today) {
  const [kind, id] = [what.slice(0, 1), what.slice(2)];
  if (!id || (kind !== "d" && kind !== "s")) return { error: "rec.errWhat", remedy: "rec.fixWhat", field: "what" };
  if (!day || day > today) return { error: "rec.errDay2", remedy: "rec.fixDay", field: "day" };
  return {
    dish_id: kind === "d" ? id : null,
    shelf_id: kind === "s" ? id : null,
    date: day,
    feeling: !feeling || feeling === "none" ? null : feeling,
    note: note.trim(),
  };
}
