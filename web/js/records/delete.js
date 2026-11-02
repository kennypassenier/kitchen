// Delete (at once, with Undo; refused while something still uses the item), duplicate, and the Edit/Delete buttons of a row.

import { toast } from "/static/kp/dist/js/overlays.js";
import { h } from "../dom.js";
import { replace, remove, restore, kitchenNow } from "../api.js";
import { t } from "../i18n/index.js";
import { saveFailed } from "../api/stale-notice.js";
import { openDishEditor, ordered } from "../dishes/editor.js";
import { copyDish } from "../recipe/duplicate.js";
import { LISTS } from "./lists.js";
import { inUse, markInUse } from "./in-use.js";
import { drawer } from "./drawer.js";
import { openRecordEditor } from "./editors.js";
import { copyToEditor } from "../recipe/edit-nav.js";
import { deleteWithUndo } from "./undo-delete.js";
import { releaseDishPhotos } from "./recipe-delete.js";
import { placeOf } from "./undo-logic.js";
import { byOrder, closeUp, makeRoom } from "./order.js";

/** @typedef {import("./lists.js").List} List */
/** @typedef {import("./lists.js").Item} Item */

/** Whether a list keeps its items in a numbered order (the two category lists). @param {List} list */
const numbered = (list) => list === "dish_categories" || list === "ingredient_categories";

/**
 * Save the given items' new `order`, one after the other; a refusal says so (the list then shows a gap, no loss). A
 * category saved elsewhere since this page read it is refused as stale and the stale notice says so (fix-quick-rev-1).
 * @param {List} list @param {Item[]} changes
 */
async function saveOrders(list, changes) {
  try {
    for (const x of changes) await replace(list, x);
  } catch (e) {
    saveFailed(e, () => t("rec.orderNotSaved", e instanceof Error ? e.message : String(e)));
  }
}

/**
 * Delete an item at once with Undo (Kenny, 01/11/2026 20:21: no typed name for anything that can come back, and
 * everything in these lists can). The server keeps the removed item for its undo window (src/store/undo.rs) and puts the
 * same item back at its place; a category list closes up after the delete and makes room again on Undo; a dish's
 * recipe photos are deleted only when the window closed. `after` runs once it is gone (a detail page goes back to its
 * list). An item still in use is refused with the sentence that names its users.
 * @param {HTMLElement} _anchor @param {List} list @param {Item} item @param {{ after?: () => void }} [o]
 */
export function deleteRecord(_anchor, list, item, { after } = {}) {
  const blocked = inUse(list, item);
  if (blocked) {
    toast(blocked, { live: "assertive" });
    return;
  }
  const at = placeOf(/** @type {Item[]} */ (kitchenNow()?.[list] ?? []), item.id);
  // Where the table showed it: a category returns there on Undo, whatever number it carried (records/order.js makeRoom).
  const shownAt = placeOf(byOrder(/** @type {Item[]} */ (kitchenNow()?.[list] ?? [])), item.id);
  const rest = () => /** @type {Item[]} */ (kitchenNow()?.[list] ?? []);
  void deleteWithUndo({
    name: LISTS[list].name(item),
    remove: async () => {
      await remove(list, item.id);
      after?.();
      if (numbered(list)) await saveOrders(list, closeUp(rest()));
    },
    restore: async () => {
      const back = await restore(list, item.id, at);
      if (numbered(list)) await saveOrders(list, makeRoom(rest(), back, shownAt));
    },
    settle: list === "dishes" ? () => releaseDishPhotos(item) : undefined,
  });
}

/** Duplicate a recipe (Kenny, 29/10/2026): the editor page opens on an editable copy in the same dish. @param {Item} recipe */
export function duplicateRecipe(recipe) {
  copyToEditor(recipe);
}

/** Duplicate a dish: the dish editor opens on an editable copy with its recipes. @param {Item} dishItem */
export function duplicateDish(dishItem) {
  openDishEditor(drawer(), { dish: null, from: copyDish(dishItem), categories: ordered(kitchenNow()?.dish_categories ?? []) });
}

/** Edit and Delete for one row of a list (a dish also Duplicate). @param {List} list @param {Item} item */
export function rowActions(list, item) {
  const name = LISTS[list].name(item);
  const edit = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": t("rec.editName", name) }, t("common.edit"));
  const del = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--destructive", "aria-label": t("rec.deleteName", name) }, t("common.delete"));
  edit.addEventListener("click", () => openRecordEditor(list, item));
  del.addEventListener("click", () => deleteRecord(del, list, item));
  markInUse(del, list, item);
  if (list !== "dishes") return h("div", { class: "kp-row-actions" }, edit, del);
  const copy = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": t("rec.duplicateName", name) }, t("common.duplicate"));
  copy.addEventListener("click", () => duplicateDish(item));
  return h("div", { class: "kp-row-actions" }, edit, copy, del);
}
