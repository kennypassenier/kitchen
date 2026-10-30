// The recipe's details: the dish it belongs to, its names, summary, source, meals, main ingredients and photo; and the notes.

import { h } from "../../dom.js";
import { dishPicker } from "../../dishes/picker.js";
import { t, lang } from "../../i18n/index.js";
import { cap } from "../../format.js";
import { row, input, area, segmented } from "../../ui/form-parts.js";
import { photoField } from "../photos.js";
import { mealItems, MAIN } from "./consts.js";

/**
 * The dish section of the form. `restore` is a draft's form state (Kenny, 29/10/2026).
 * @param {{ r: Record<string, any>, preset: Record<string, any>, restore: Record<string, any> | null, mainOptions: string[], tracker: ReturnType<typeof import("../photos.js").photoTracker> }} o
 */
export function detailFields({ r, preset, restore, mainOptions, tracker }) {
  const recipePhoto = photoField({ ids: r.photo ? [r.photo] : [], max: 1, label: t("edit.recipePhoto"), tracker });
  const dishField = dishPicker(restore ? restore.dish_id ?? null : r.dish_id ?? preset.dish_id ?? null, { label: t("edit.dish"), id: "rl-dish", fresh: restore?.new_dish ?? null });
  const ownLabel = String(r.label?.[lang()] || r.label?.[lang() === "nl" ? "en" : "nl"] || "").trim();
  const label = input(ownLabel, "text", { autocomplete: "off", placeholder: t("edit.labelPh") });
  const short = input(r.short ?? "", "text", { autocomplete: "off" });
  const summary = area(r.summary ?? "", 3);
  // Where the recipe came from (Kenny, 29/10/2026): set by an import, editable, empty clears it.
  const source = input(typeof r.source === "string" ? r.source : "", "url", { autocomplete: "off", inputmode: "url", placeholder: t("edit.sourcePh"), spellcheck: "false" });
  const meals = segmented(mealItems(), r.meals ?? [], "multi", t("edit.meals"));
  const mainSet = [...new Set([...MAIN, ...mainOptions, ...(r.ing ?? [])])].sort();
  const mainBox = h(
    "div",
    { class: "kp-combobox", "data-kp-combobox": true, "data-kp-tags": true, "data-kp-creatable": true },
    h("ul", { class: "kp-tag-list", "data-kp-tag-list": true }, ...(r.ing ?? []).map((/** @type {string} */ tag) => h("li", { class: "kp-tag", "data-value": tag }, tag, h("button", { type: "button", class: "kp-tag__remove", "data-kp-tag-remove": true, "aria-label": t("edit.removeTag", tag) }, "×")))),
    h("input", { class: "kp-combobox__input", id: "rl-main", type: "text", role: "combobox", autocomplete: "off", "aria-expanded": "false", "aria-controls": "rl-main-list", "aria-label": t("edit.mainIng") }),
    h("ul", { class: "kp-combobox__list", id: "rl-main-list", role: "listbox", hidden: true }, ...mainSet.map((tag) => h("li", { class: "kp-combobox__option", role: "option", "data-kp-option": true, "data-value": tag }, cap(tag)))),
    h("p", { class: "kp-combobox__status", "data-kp-combobox-status": true, role: "status", "aria-live": "polite" }),
  );
  const dish = h(
    "div",
    { class: "kp-formgrid" },
    row(t("edit.dish"), dishField.el, t("edit.dishHint"), "rl-dish-l"),
    row(t("edit.label"), label, t("edit.labelHint")),
    row(t("edit.short"), short, t("edit.shortHint")),
    row(t("edit.summary"), summary, t("edit.summaryHint")),
    row(t("edit.source"), source, t("edit.sourceHint")),
    row(t("edit.meals"), meals, t("edit.mealsHint")),
    row(t("edit.mainIng"), mainBox, t("edit.mainHint")),
    row(t("edit.photo"), recipePhoto.el, t("edit.photoHint")),
  );
  return { dishField, ownLabel, label, short, summary, source, meals, mainBox, recipePhoto, el: dish };
}

/** The two notes of a recipe. @param {Record<string, any>} r */
export function noteFields(r) {
  const lastNote = area(r.last_note ?? "", 2);
  const miniNote = area(r.mini_note ?? "", 2);
  const notes = h("div", { class: "kp-formgrid" }, row(t("edit.lastTime"), lastNote, t("edit.lastHint")), row(t("bad.miniVersion"), miniNote, t("edit.miniHint")));
  return { lastNote, miniNote, el: notes };
}
