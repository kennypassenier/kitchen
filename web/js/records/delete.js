// Delete (with what is lost and what still uses an item), duplicate, and the Edit/Delete buttons of a row.

import { openConfirmation } from "/static/kp/js/components.js";
import { toast } from "/static/kp/js/overlays.js";
import { undoToast } from "/static/kp/js/undo-toast.js";
import { h } from "../dom.js";
import { create, replace, remove, kitchenNow, ingredientName, reason } from "../api.js";
import { t, nameOf, textOf } from "../i18n/index.js";
import { openDishEditor, ordered } from "../dishes/editor.js";
import { copyRecipe, copyDish } from "../recipe/duplicate.js";
import { LISTS, dishHas } from "./lists.js";
import { drawer } from "./drawer.js";
import { openRecordEditor } from "./editors.js";
import { openRecipeEditor } from "./safe.js";

/** @typedef {import("./lists.js").List} List */
/** @typedef {import("./lists.js").Item} Item */

// ---- delete --------------------------------------------------------------------------------------------------------

/** What deleting an item loses, in one line per thing. @param {List} list @param {Item} item */
function loses(list, item) {
  const k = kitchenNow();
  switch (list) {
    case "freezer":
      return [t("rec.losesFreezer", textOf(item.dish), item.portions)];
    case "shelf":
      return [t("rec.losesShelf", (k?.log ?? []).filter((e) => e.shelf_id === item.id).length)];
    default:
      return [t(`list.${list}.loses`)];
  }
}

/** What still points at an item, by name: a category's dishes, an ingredient's dishes and recipes, an ingredient category's ingredients. @param {List} list @param {Item} item */
export function usersOf(list, item) {
  const k = kitchenNow();
  if (list === "dish_categories") return (k?.dishes ?? []).filter((d) => d.category === item.id).map((d) => nameOf(d).text);
  if (list === "ingredient_categories") return (k?.ingredients ?? []).filter((i) => i.category === item.id).map((i) => ingredientName(i.id));
  if (list === "ingredients")
    return [
      ...(k?.dishes ?? []).filter((d) => dishHas(d, item.id)).map((d) => t("rec.userDish", nameOf(d).text)),
      ...(k?.recipes ?? []).filter((r) => (r.ingredients ?? []).some((/** @type {Item} */ l) => l.ingredient === item.id)).map((r) => t("rec.userRecipe", r.name)),
    ];
  return [];
}

/** Is `item` still in use so it cannot go? Returns the sentence that says so, naming every user. @param {List} list @param {Item} item */
function inUse(list, item) {
  const users = usersOf(list, item);
  if (!users.length) return null;
  return t(`list.${list}.inUse`, LISTS[list].name(item), users.length, users.join(", "));
}

/** A log line or a resting mark goes at once, with an Undo that puts it back. @param {List} list @param {Item} item @param {string} name @param {(() => void) | undefined} after */
function deleteAtOnce(list, item, name, after) {
  void remove(list, item.id).then(
    () => {
      after?.();
      const { id, created, updated, ...rest } = item;
      undoToast(t("rec.deletedDot", name), {
        mode: "revert",
        ms: 10_000,
        clock: "ring",
        undo: async () => {
          try {
            await create(list, rest);
          } catch (e) {
            toast(t("rec.notBack", reason(e)), { live: "assertive", sticky: true });
          }
        },
      });
    },
    (e) => toast(t("rec.notDeleted", reason(e)), { live: "assertive", sticky: true }),
  );
}

/** A deleted category leaves no gap: the others close up to 1, 2, 3, …. @param {List} list */
async function closeUp(list) {
  if (list !== "dish_categories" && list !== "ingredient_categories") return;
  const rest = ordered(kitchenNow()?.[list] ?? []);
  for (const [i, x] of rest.entries()) if (x.order !== i + 1) await replace(list, { ...x, order: i + 1 });
}

/**
 * Delete an item: a log line or a resting mark at once with Undo, anything a person typed more of after the typed
 * name. `after` runs once it is gone (a detail page goes back to its list).
 * @param {HTMLElement} anchor @param {List} list @param {Item} item @param {{ after?: () => void }} [o]
 */
export function deleteRecord(anchor, list, item, { after } = {}) {
  const name = LISTS[list].name(item);
  const blocked = inUse(list, item);
  if (blocked) {
    toast(blocked, { live: "assertive" });
    return;
  }
  if (list === "log" || list === "resting") return deleteAtOnce(list, item, name, after);
  openConfirmation(anchor, {
    phrase: t("rec.deleteAsk", name),
    typeName: name,
    acceptLabel: t(`list.${list}.delete`),
    loses: loses(list, item),
    onAccept: () =>
      void remove(list, item.id)
        .then(() => closeUp(list))
        .then(
          () => {
            toast(t("rec.deleted", name));
            after?.();
          },
          (e) => toast(t("rec.notDeleted", reason(e)), { live: "assertive", sticky: true }),
        ),
  });
}

/** Duplicate a recipe (Kenny, 29/10/2026): the editor opens on an editable copy in the same dish. @param {Item} recipe */
export function duplicateRecipe(recipe) {
  openRecipeEditor(null, { ...copyRecipe(recipe), dish_id: recipe.dish_id }, String(recipe.name ?? ""));
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
  const blocked = inUse(list, item);
  if (blocked) del.setAttribute("title", blocked);
  if (list !== "dishes") return h("div", { class: "kp-row-actions" }, edit, del);
  const copy = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": t("rec.duplicateName", name) }, t("common.duplicate"));
  copy.addEventListener("click", () => duplicateDish(item));
  return h("div", { class: "kp-row-actions" }, edit, copy, del);
}
