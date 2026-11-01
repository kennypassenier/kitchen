// The record editors: one form per list, opened in the shared drawer (see drawer.js). The dish has its own editor
// (dishes/editor.js) and a category is edited in its table (records/category-table.js); the other lists' forms are in editors-stock.js, editors-log.js and
// editors-names.js, and this file picks the one for the list.

import { kitchenNow } from "../api.js";
import { openDishEditor, ordered } from "../dishes/editor.js";
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
    // No drawer for a category (Kenny, 01/11/2026 20:21, "In de tabel"): its list page opens with the cell open, or
    // with the add row in focus for a new one (records/category-table.js reads `?edit=`).
    history.pushState(null, "", `${LISTS[list].home[0]}${item ? `?edit=${encodeURIComponent(item.id)}` : ""}`);
    dispatchEvent(new PopStateEvent("popstate"));
  } else {
    FORMS[list]?.(list, item, { ...preset, ...(item ?? {}) });
  }
}
