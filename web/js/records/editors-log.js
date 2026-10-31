// The editors of what happened in the kitchen: a dish set aside ("resting") and a line of what was eaten.

import { getSegmentedValues } from "/static/kp/dist/kp-themes.min.js";
import { kitchenNow } from "../api.js";
import { t, nameOf, textOf } from "../i18n/index.js";
import { row, input, select } from "../ui/form-parts.js";
import { today, dmy } from "../format.js";
import { dish, feelings, logWhat } from "./lists.js";
import { dateField, choiceOf, dishOptions, openForm } from "./drawer.js";

/** @typedef {import("./lists.js").List} List */
/** @typedef {import("./lists.js").Item} Item */

/** @param {List} list @param {Item | null} item @param {Item} v */
export function openRestingEditor(list, item, v) {
  const what = select(dishOptions(), v.dish_id ?? "", t("rec.dish"));
  const until = dateField(String(v.until ?? today()), { label: t("rec.restingUntil") });
  openForm({
    list,
    item,
    title: t("rec.restingTitle"),
    text: t("rec.restingText"),
    rows: [row(t("rec.dish"), what, t("rec.restingHint")), row(t("rec.until"), until.el, t("rec.untilHint"))],
    after: until.start,
    body: () => {
      const day = until.get();
      if (!what.value) return { error: t("rec.errRest"), remedy: t("rec.fixRest") };
      if (!day) return { error: t("rec.errUntil"), remedy: t("rec.fixUntil") };
      return { dish_id: what.value, until: day };
    },
    saved: (b) => t("rec.restsUntil", dish(b.dish_id) ? nameOf(dish(b.dish_id)).text : t("rec.theDish"), dmy(b.until)),
  });
}

/** The dishes and the shelf foods one can have eaten, as `d:<id>` / `s:<id>` options. */
function eatenOptions() {
  const shelf = [...(kitchenNow()?.shelf ?? [])].sort((a, b) => textOf(a.title).localeCompare(textOf(b.title)));
  return [...dishOptions().map(([id, n]) => /** @type {[string, string]} */ ([`d:${id}`, t("rec.optDish", n)])), ...shelf.map((s) => /** @type {[string, string]} */ ([`s:${s.id}`, t("rec.optShelf", textOf(s.title))]))];
}

/** The fields of the log form. @param {Item} v */
function logFields(v) {
  const what = select(eatenOptions(), v.shelf_id ? `s:${v.shelf_id}` : v.dish_id ? `d:${v.dish_id}` : "", t("rec.whatEaten"));
  const day = dateField(String(v.date ?? today()), { max: today(), label: t("rec.day") });
  const felt = choiceOf({ none: t("rec.noAnswer"), ...feelings() }, String(v.feeling ?? "none"), t("rec.howFelt"));
  const note = input(String(v.note ?? ""), "text", { autocomplete: "off", placeholder: t("rec.phNote") });
  return { what, day, felt, note };
}

/** Read the log form, or say what is wrong. @param {ReturnType<typeof logFields>} f */
function logBody({ what, day, felt, note }) {
  const [kind, id] = [what.value.slice(0, 1), what.value.slice(2)];
  const d = day.get();
  if (!id) return { error: t("rec.errWhat"), remedy: t("rec.fixWhat") };
  if (!d || d > today()) return { error: t("rec.errDay2"), remedy: t("rec.fixDay") };
  const feeling = getSegmentedValues(felt)[0] ?? "none";
  return {
    dish_id: kind === "d" ? id : null,
    shelf_id: kind === "s" ? id : null,
    date: d,
    feeling: feeling === "none" ? null : feeling,
    note: /** @type {HTMLInputElement} */ (note).value.trim(),
  };
}

/** @param {List} list @param {Item | null} item @param {Item} v */
export function openLogEditor(list, item, v) {
  const f = logFields(v);
  openForm({
    list,
    item,
    title: t("rec.whatEaten"),
    text: t("rec.whatEatenText"),
    rows: [
      row(t("rec.what"), f.what, t("rec.whatHint")),
      row(t("rec.day"), f.day.el, t("rec.dayHint")),
      row(t("rec.howFelt"), f.felt, t("rec.feltHint")),
      row(t("rec.note"), f.note, t("rec.noteHint")),
    ],
    after: f.day.start,
    body: () => logBody(f),
    saved: (b) => t(item ? "rec.savedLine" : "rec.loggedLine", logWhat(b), dmy(b.date)),
  });
}
