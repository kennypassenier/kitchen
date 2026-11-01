// The inline add row of What I ate (Kenny, 01/11/2026 20:21, "Invoerrij"): day, what was eaten, how it felt and a note
// in one row at the top of the log table; Enter adds the line. The day starts at today and stays after an Add (several
// lines of one day go in a row); the rest empties. Editing a line still opens its drawer (records/editors-log.js).

import { h } from "../dom.js";
import { create } from "../api.js";
import { t } from "../i18n/index.js";
import { today, dmy } from "../format.js";
import { input, select } from "../ui/form-parts.js";
import { dateField } from "./drawer.js";
import { feelings, logWhat } from "./lists.js";
import { eatenOptions } from "./editors-log.js";
import { logLine } from "./log-line.js";
import { addRow } from "./add-row.js";

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

/** The add row of the log; `start` wires the date picker once the row is in the page. */
export function logEntry() {
  const f = fields();
  const row = addRow({
    label: t("list.log.add"),
    submit: t("rec.addInRow"),
    fields: [
      { label: t("rec.day"), control: f.day.el, size: "short" },
      { label: t("rec.whatEaten"), control: f.what },
      { label: t("lg.felt"), control: f.felt },
      { label: t("rec.note"), control: f.note, size: "wide" },
    ],
    reset: () => {
      f.what.value = "";
      f.felt.value = "none";
      f.note.value = "";
    },
    check: () => {
      const line = logLine({ what: f.what.value, day: f.day.get(), feeling: f.felt.value, note: f.note.value }, today());
      return "error" in line ? { field: line.field === "what" ? f.what : f.day.el, message: `${t(line.error)} ${t(line.remedy)}` } : null;
    },
    add: async () => {
      const line = logLine({ what: f.what.value, day: f.day.get(), feeling: f.felt.value, note: f.note.value }, today());
      if ("error" in line) throw new Error(t(line.error));
      const made = await create("log", line);
      return t("rec.loggedLine", logWhat(made), dmy(made.date));
    },
  });
  return { el: row.el, focus: row.focus, stop: row.stop, start: f.day.start, refresh: () => refreshOptions(f.what) };
}
