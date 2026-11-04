// The inline add row of What I ate (Kenny, 01/11/2026 20:21, "Invoerrij"): day, what was eaten, how it felt and a note
// in one row at the top of the log table; Enter adds the line. The day starts at today and stays after an Add (several
// lines of one day go in a row); the rest empties. Editing a line still opens its drawer (records/editors-log.js).

import { h } from "../dom.js";
import { create } from "../api.js";
import { t } from "../i18n/index.js";
import { today } from "../format.js";
import { input, select } from "../ui/form-parts.js";
import { dateField } from "./drawer.js";
import { feelings } from "./lists.js";
import { eatenOptions } from "./editors-log.js";
import { logLine } from "./log-line.js";
import { addLine } from "./add-line.js";

/** The row's fields. */
function fields() {
  const day = dateField(today(), { max: today(), label: t("rec.day") });
  const what = select([["", t("lg.choose")], ...eatenOptions()], "", t("rec.whatEaten"));
  const felt = select(Object.entries({ none: t("rec.noAnswer"), ...feelings() }), "none", t("lg.felt"));
  const note = /** @type {HTMLInputElement} */ (input("", "text", { autocomplete: "off", placeholder: t("rec.phNote") }));
  return { day, what, felt, note };
}

/** Put the dishes and shelf foods of the kitchen as it is now in the select, keeping the choice. @param {HTMLSelectElement} what */
function refreshOptions(what) {
  const chosen = what.value;
  what.replaceChildren(...[["", t("lg.choose")], ...eatenOptions()].map(([v, text]) => h("option", { value: v }, text)));
  what.value = chosen;
}

/** The line the fields hold, or which field is wrong. @param {ReturnType<typeof fields>} f */
const lineOf = (f) => logLine({ what: f.what.value, day: f.day.get(), feeling: f.felt.value, note: f.note.value }, today());

/** The add row of the log; `start` wires the date picker once the row is in the page. @param {string} tableId */
export function logEntry(tableId) {
  const f = fields();
  let day = "";
  const row = addLine({
    tableId,
    label: t("list.log.add"),
    submit: t("rec.addInRow"),
    // "Added <dish>": the kit says a select's chosen option by its text (kp-themes 12.7.0).
    named: "what",
    fields: [
      { name: "day", column: "day", label: t("rec.day"), control: f.day.el },
      { name: "what", column: "what", label: t("rec.whatEaten"), control: f.what },
      { name: "felt", column: "felt", label: t("lg.felt"), control: f.felt },
      { name: "note", column: "note", label: t("rec.note"), control: f.note },
    ],
    check: () => {
      const line = lineOf(f);
      return "error" in line ? { name: line.field === "what" ? "what" : "day", message: `${t(line.error)} ${t(line.remedy)}` } : null;
    },
    add: async () => {
      const line = lineOf(f);
      if ("error" in line) throw new Error(t(line.error));
      day = f.day.get() ?? "";
      await create("log", line);
    },
    // The kit empties the row; the day stays, as several lines of one day go in a row.
    onAdded: () => {
      if (day) f.day.set(day);
    },
  });
  return {
    el: row.el,
    focus: row.focus,
    start: f.day.start,
    refresh: () => refreshOptions(f.what),
  };
}
