// The record editors: one form per list, opened in the shared drawer (see drawer.js).

import { getQuantity } from "/static/kp/js/quantity.js";
import { getSegmentedValues } from "/static/kp/js/segmented.js";
import { kitchenNow } from "../api.js";
import { t, lang, nameOf, textOf } from "../i18n/index.js";
import { row, input, stepper, select } from "../ui/form-parts.js";
import { today, dmy, brusselsDay } from "../format.js";
import { openDishEditor, openNameEditor, ordered } from "../dishes/editor.js";
import { LISTS, energies, feelings, dish, logWhat } from "./lists.js";
import { drawer, dateField, pair, choiceOf, dishOptions, openForm } from "./drawer.js";

/** @typedef {import("./lists.js").List} List */
/** @typedef {import("./lists.js").Item} Item */

/**
 * Open the editor for an item of `list`, or for a new one (`preset` fills a new one).
 * @param {List} list @param {Item | null} item @param {Item} [preset]
 */
export function openRecordEditor(list, item, preset = {}) {
  const k = kitchenNow();
  if (list === "dishes") {
    openDishEditor(drawer(), { dish: item, categories: ordered(k?.dish_categories ?? []) });
    return;
  }
  if (list === "dish_categories" || list === "ingredient_categories") {
    const dish = list === "dish_categories";
    openNameEditor(drawer(), { list, item, items: k?.[list] ?? [], noun: LISTS[list].noun, example: dish ? { nl: "Speciaal", en: "Special" } : { nl: "Vlees", en: "Meat" } });
    return;
  }
  if (list === "ingredients") {
    const v = { ...preset, ...(item ?? {}) };
    const nl = input(String(v.name?.nl ?? ""), "text", { autocomplete: "off", lang: "nl", placeholder: t("rec.phIngNl") });
    const en = input(String(v.name?.en ?? ""), "text", { autocomplete: "off", placeholder: t("rec.phIngEn") });
    const cats = ordered(k?.ingredient_categories ?? []);
    const cat = select(cats.map((c) => /** @type {[string, string]} */ ([c.id, nameOf(c).text])), v.category ?? cats.find((c) => c.name?.en === "Other")?.id ?? cats[0]?.id ?? "", t("rec.category"));
    openForm({
      list,
      item,
      title: t("rec.ingTitle"),
      text: t("rec.ingText"),
      rows: [
        row(t("rec.dutchName"), nl, t("rec.dutchHint")),
        row(t("rec.englishName"), en, t("rec.englishHint")),
        row(t("rec.category"), cat, t("rec.ingCatHint")),
      ],
      body: () => {
        const name = { nl: /** @type {HTMLInputElement} */ (nl).value.trim(), en: /** @type {HTMLInputElement} */ (en).value.trim() };
        if (!name.nl || !name.en) return { error: t(name.nl ? "ip.needEn" : "ip.needNl"), remedy: t("rec.fixName") };
        return { name, category: cat.value || null };
      },
      saved: (b) => t(item ? "rec.savedName" : "rec.addedName", nameOf(b).text),
    });
    return;
  }
  const v = { ...preset, ...(item ?? {}) };
  if (list === "freezer") {
    const dish = pair(v.dish, "input", t("rec.phDish"));
    const from = select([["", t("rec.noDish")], ...dishOptions()], v.dish_id ?? "", t("rec.dish"));
    const portions = stepper(Number(v.portions ?? 2), { min: 0, max: 99, unit: "portions", one: "portion", label: t("rec.portions") });
    portions.classList.add("kp-formgrid__fill");
    const frozen = dateField(v.frozen_on ? brusselsDay(v.frozen_on) : today(), { max: today(), label: t("rec.frozenOn") });
    openForm({
      list,
      item,
      title: t("rec.inFreezer"),
      text: t("rec.inFreezerText"),
      rows: [
        row(t("bad.dishNl"), dish.nl, t("rec.dishHint")),
        row(t("bad.dishEn"), dish.en, t("bad.dishEnHint")),
        row(t("rec.dishLink"), from, t("rec.dishLinkHint")),
        row(t("rec.portions"), portions, t("rec.portionsHint")),
        row(t("rec.frozenOn"), frozen.el, t("rec.frozenHint")),
      ],
      after: frozen.start,
      body: () => {
        const name = dish.get();
        const day = frozen.get();
        if (!name.nl || !name.en) return { error: t(name.nl ? "ip.needEn" : "ip.needNl"), remedy: t("rec.fixDish") };
        if (!day || day > today()) return { error: t("rec.errDay"), remedy: t("rec.fixDay") };
        // A day other than today is kept at noon, so it never slips to the day before in another time zone.
        const at = day === today() && item === null ? new Date().toISOString() : new Date(`${day}T12:00:00`).toISOString();
        return { dish: name, dish_id: from.value || null, portions: getQuantity(portions), frozen_on: at };
      },
      saved: (b) => t(item ? "rec.savedName" : "rec.addedName", textOf(b.dish)),
    });
    return;
  }
  if (list === "shelf") {
    const title = pair(v.title, "input", t("rec.phFood"));
    const text = pair(v.text, "area", "");
    const minutes = stepper(Number(v.minutes ?? 2), { min: 0, max: 60, unit: "min", label: t("rec.minutes") });
    minutes.classList.add("kp-formgrid__fill");
    const gear = pair(v.gear, "input", "");
    const energy = choiceOf(energies(), String(v.energy ?? "open"), t("rec.energy"));
    openForm({
      list,
      item,
      title: t("rec.onShelf"),
      text: t("rec.onShelfText"),
      rows: [
        row(t("rec.inNl", t("rec.name")), title.nl, t("rec.nameHint")),
        row(t("rec.inEn", t("rec.name")), title.en, ""),
        row(t("rec.inNl", t("rec.whatToDo")), text.nl, t("rec.whatToDoHint")),
        row(t("rec.inEn", t("rec.whatToDo")), text.en, ""),
        row(t("rec.minutes"), minutes, t("rec.minutesHint")),
        row(t("rec.inNl", t("rec.gear")), gear.nl, t("rec.gearHint")),
        row(t("rec.inEn", t("rec.gear")), gear.en, ""),
        row(t("rec.energy"), energy, t("rec.energyHint")),
      ],
      body: () => {
        const name = title.get();
        if (!name.nl || !name.en) return { error: t(name.nl ? "ip.needEn" : "ip.needNl"), remedy: t("rec.fixFood") };
        // Text and gear are optional, but one given in one language only is half of it.
        for (const [part, label] of /** @type {const} */ ([[text, "rec.whatToDo"], [gear, "rec.gear"]])) {
          const got = part.get();
          if ((got.nl || got.en) && (!got.nl || !got.en)) return { error: t("rec.halfText", t(label)), remedy: t("rec.fixFood") };
        }
        return {
          title: name,
          text: text.get(),
          minutes: getQuantity(minutes),
          gear: gear.get(),
          energy: getSegmentedValues(energy)[0] ?? "open",
        };
      },
      saved: (b) => t(item ? "rec.savedName" : "rec.addedName", textOf(b.title)),
    });
    return;
  }
  if (list === "recipe_sources") {
    const name = input(String(v.name ?? ""), "text", { autocomplete: "off", placeholder: t("src.name") });
    const url = input(String(v.url ?? ""), "text", { autocomplete: "off", inputmode: "url", placeholder: "https://…", spellcheck: "false" });
    const language = choiceOf({ nl: t("src.nl"), en: t("src.en") }, String(v.language ?? lang()), t("src.language"));
    const note = pair(v.note, "area", "");
    const verified = dateField(String(v.verified ?? ""), { max: today(), label: t("src.verified") });
    const how = input(String(v.verified_by ?? ""), "text", { autocomplete: "off" });
    openForm({
      list,
      item,
      title: t("src.title"),
      text: t("src.cardLede"),
      rows: [
        row(t("src.name"), name, t("src.nameHint")),
        row(t("src.url"), url, t("src.urlHint")),
        row(t("src.language"), language, t("src.langHint")),
        row(t("rec.inNl", t("src.note")), note.nl, t("src.noteHint")),
        row(t("rec.inEn", t("src.note")), note.en, ""),
        row(t("src.verified"), verified.el, t("src.verifiedHint")),
        row(t("src.how"), how, t("src.howHint")),
      ],
      after: verified.start,
      body: () => {
        const n = /** @type {HTMLInputElement} */ (name).value.trim();
        const u = /** @type {HTMLInputElement} */ (url).value.trim();
        if (!n) return { error: t("src.errName"), remedy: t("src.fix") };
        if (!u) return { error: t("src.errUrl"), remedy: t("src.fix") };
        const text = note.get();
        if ((text.nl || text.en) && (!text.nl || !text.en)) return { error: t("rec.halfText", t("src.note")), remedy: t("src.fix") };
        const day = verified.get();
        if (day && day > today()) return { error: t("rec.errDay"), remedy: t("rec.fixDay") };
        return { name: n, url: u, language: getSegmentedValues(language)[0] ?? "nl", note: text, verified: day ?? "", verified_by: /** @type {HTMLInputElement} */ (how).value.trim() };
      },
      saved: (b) => t(item ? "rec.savedName" : "rec.addedName", b.name),
    });
    return;
  }
  if (list === "resting") {
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
    return;
  }
  if (list === "log") {
    const shelf = [...(k?.shelf ?? [])].sort((a, b) => textOf(a.title).localeCompare(textOf(b.title)));
    const what = select(
      [...dishOptions().map(([id, n]) => /** @type {[string, string]} */ ([`d:${id}`, t("rec.optDish", n)])), ...shelf.map((s) => /** @type {[string, string]} */ ([`s:${s.id}`, t("rec.optShelf", textOf(s.title))]))],
      v.shelf_id ? `s:${v.shelf_id}` : v.dish_id ? `d:${v.dish_id}` : "",
      t("rec.whatEaten"),
    );
    const day = dateField(String(v.date ?? today()), { max: today(), label: t("rec.day") });
    const felt = choiceOf({ none: t("rec.noAnswer"), ...feelings() }, String(v.feeling ?? "none"), t("rec.howFelt"));
    const note = input(String(v.note ?? ""), "text", { autocomplete: "off", placeholder: t("rec.phNote") });
    openForm({
      list,
      item,
      title: t("rec.whatEaten"),
      text: t("rec.whatEatenText"),
      rows: [
        row(t("rec.what"), what, t("rec.whatHint")),
        row(t("rec.day"), day.el, t("rec.dayHint")),
        row(t("rec.howFelt"), felt, t("rec.feltHint")),
        row(t("rec.note"), note, t("rec.noteHint")),
      ],
      after: day.start,
      body: () => {
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
      },
      saved: (b) => t(item ? "rec.savedLine" : "rec.loggedLine", logWhat(b), dmy(b.date)),
    });
  }
}
