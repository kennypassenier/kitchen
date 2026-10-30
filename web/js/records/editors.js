// The record editors: one form per list, opened in the shared drawer (see drawer.js). The dish and the two category lists
// have their own editors (dishes/editor.js); the other lists' forms are in editors-stock.js, editors-log.js and
// editors-names.js, and this file picks the one for the list.

import { kitchenNow } from "../api.js";
import { openDishEditor, openNameEditor, ordered } from "../dishes/editor.js";
import { LISTS } from "./lists.js";
import { drawer } from "./drawer.js";
import { openFreezerEditor, openShelfEditor } from "./editors-stock.js";
import { openRestingEditor, openLogEditor } from "./editors-log.js";
import { openIngredientEditor, openSourceEditor } from "./editors-names.js";

/** @typedef {import("./lists.js").List} List */
/** @typedef {import("./lists.js").Item} Item */

/** The editors that take the list, the item (or null) and the item merged over the preset. @type {Record<string, (list: List, item: Item | null, v: Item) => void>} */
const FORMS = {
  ingredients: openIngredientEditor,
  freezer: openFreezerEditor,
  shelf: openShelfEditor,
  recipe_sources: openSourceEditor,
  resting: openRestingEditor,
  log: openLogEditor,
};

/**
 * Open the editor for an item of `list`, or for a new one (`preset` fills a new one).
 * @param {List} list @param {Item | null} item @param {Item} [preset]
 */
export function openRecordEditor(list, item, preset = {}) {
  const k = kitchenNow();
  if (list === "dishes") {
    openDishEditor(drawer(), { dish: item, categories: ordered(k?.dish_categories ?? []) });
  } else if (list === "dish_categories" || list === "ingredient_categories") {
    const dish = list === "dish_categories";
    openNameEditor(drawer(), { list, item, items: k?.[list] ?? [], noun: LISTS[list].noun, example: dish ? { nl: "Speciaal", en: "Special" } : { nl: "Vlees", en: "Meat" } });
  } else {
    FORMS[list]?.(list, item, { ...preset, ...(item ?? {}) });
  }
}
