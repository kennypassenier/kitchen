// The editors of the two things kept at home: a freezer item and a zero-prep shelf food (opened in the shared drawer).

import { getQuantity } from "/static/kp/js/quantity.js";
import { getSegmentedValues } from "/static/kp/js/segmented.js";
import { t, textOf } from "../i18n/index.js";
import { row, stepper, select } from "../ui/form-parts.js";
import { today, brusselsDay } from "../format.js";
import { energies } from "./lists.js";
import { pair, choiceOf, dateField, dishOptions, openForm } from "./drawer.js";

/** @typedef {import("./lists.js").List} List */
/** @typedef {import("./lists.js").Item} Item */

/** The fields of the freezer form. @param {Item} v */
function freezerFields(v) {
  const dish = pair(v.dish, "input", t("rec.phDish"));
  const from = select([["", t("rec.noDish")], ...dishOptions()], v.dish_id ?? "", t("rec.dish"));
  const portions = stepper(Number(v.portions ?? 2), { min: 0, max: 99, unit: "portions", one: "portion", label: t("rec.portions") });
  portions.classList.add("kp-formgrid__fill");
  const frozen = dateField(v.frozen_on ? brusselsDay(v.frozen_on) : today(), { max: today(), label: t("rec.frozenOn") });
  return { dish, from, portions, frozen };
}

/** Read the freezer form, or say what is wrong. @param {ReturnType<typeof freezerFields>} f @param {Item | null} item */
function freezerBody({ dish, from, portions, frozen }, item) {
  const name = dish.get();
  const day = frozen.get();
  if (!name.nl || !name.en) return { error: t(name.nl ? "ip.needEn" : "ip.needNl"), remedy: t("rec.fixDish") };
  if (!day || day > today()) return { error: t("rec.errDay"), remedy: t("rec.fixDay") };
  // A day other than today is kept at noon, so it never slips to the day before in another time zone.
  const at = day === today() && item === null ? new Date().toISOString() : new Date(`${day}T12:00:00`).toISOString();
  return { dish: name, dish_id: from.value || null, portions: getQuantity(portions), frozen_on: at };
}

/** @param {List} list @param {Item | null} item @param {Item} v */
export function openFreezerEditor(list, item, v) {
  const f = freezerFields(v);
  openForm({
    list,
    item,
    title: t("rec.inFreezer"),
    text: t("rec.inFreezerText"),
    rows: [
      row(t("bad.dishNl"), f.dish.nl, t("rec.dishHint")),
      row(t("bad.dishEn"), f.dish.en, t("bad.dishEnHint")),
      row(t("rec.dishLink"), f.from, t("rec.dishLinkHint")),
      row(t("rec.portions"), f.portions, t("rec.portionsHint")),
      row(t("rec.frozenOn"), f.frozen.el, t("rec.frozenHint")),
    ],
    after: f.frozen.start,
    body: () => freezerBody(f, item),
    saved: (b) => t(item ? "rec.savedName" : "rec.addedName", textOf(b.dish)),
  });
}

/** The fields of the shelf form. @param {Item} v */
function shelfFields(v) {
  const title = pair(v.title, "input", t("rec.phFood"));
  const text = pair(v.text, "area", "");
  const minutes = stepper(Number(v.minutes ?? 2), { min: 0, max: 60, unit: "min", label: t("rec.minutes") });
  minutes.classList.add("kp-formgrid__fill");
  const gear = pair(v.gear, "input", "");
  const energy = choiceOf(energies(), String(v.energy ?? "open"), t("rec.energy"));
  return { title, text, minutes, gear, energy };
}

/** Read the shelf form, or say what is wrong. @param {ReturnType<typeof shelfFields>} f */
function shelfBody({ title, text, minutes, gear, energy }) {
  const name = title.get();
  if (!name.nl || !name.en) return { error: t(name.nl ? "ip.needEn" : "ip.needNl"), remedy: t("rec.fixFood") };
  // Text and gear are optional, but one given in one language only is half of it.
  for (const [part, label] of /** @type {const} */ ([[text, "rec.whatToDo"], [gear, "rec.gear"]])) {
    const got = part.get();
    if ((got.nl || got.en) && (!got.nl || !got.en)) return { error: t("rec.halfText", t(label)), remedy: t("rec.fixFood") };
  }
  return { title: name, text: text.get(), minutes: getQuantity(minutes), gear: gear.get(), energy: getSegmentedValues(energy)[0] ?? "open" };
}

/** @param {List} list @param {Item | null} item @param {Item} v */
export function openShelfEditor(list, item, v) {
  const f = shelfFields(v);
  openForm({
    list,
    item,
    title: t("rec.onShelf"),
    text: t("rec.onShelfText"),
    rows: [
      row(t("rec.inNl", t("rec.name")), f.title.nl, t("rec.nameHint")),
      row(t("rec.inEn", t("rec.name")), f.title.en, ""),
      row(t("rec.inNl", t("rec.whatToDo")), f.text.nl, t("rec.whatToDoHint")),
      row(t("rec.inEn", t("rec.whatToDo")), f.text.en, ""),
      row(t("rec.minutes"), f.minutes, t("rec.minutesHint")),
      row(t("rec.inNl", t("rec.gear")), f.gear.nl, t("rec.gearHint")),
      row(t("rec.inEn", t("rec.gear")), f.gear.en, ""),
      row(t("rec.energy"), f.energy, t("rec.energyHint")),
    ],
    body: () => shelfBody(f),
    saved: (b) => t(item ? "rec.savedName" : "rec.addedName", textOf(b.title)),
  });
}
