// Delete a recipe at once, with Undo (Kenny, 01/11/2026 20:21). A recipe lives inside its dish (format 4), so taking it
// out is a save of the dish and Undo is another: the recipe returns as it was, at its place, the default again if it was.
// Its photo files are deleted only when the Undo window closed (a copy that still shows a picture keeps it, see
// recipe/photo-files.js `deletePhoto`). The dish's page uses it; the Recipes page can call the same function.

import { kitchenNow, remove, replace, ApiError } from "../api.js";
import { deletePhoto, photosOf } from "../recipe/photo-files.js";
import { t } from "../i18n/index.js";
import { deleteWithUndo } from "./undo-delete.js";
import { recipeBack, placeOf } from "./undo-logic.js";

/** @typedef {Record<string, any>} Item */

/** The dish that holds recipe `id` now. @param {string} id */
const dishOf = (id) => kitchenNow()?.dishes.find((d) => (d.recipes ?? []).some((/** @type {Item} */ r) => r.id === id)) ?? null;

/**
 * Delete recipe `id` now and offer Undo; `name` is what the toast calls it. Resolves to whether it went.
 * @param {string} id @param {string} name
 */
export function deleteRecipe(id, name) {
  const dish = dishOf(id);
  const recipes = /** @type {Item[]} */ (dish?.recipes ?? []);
  const at = placeOf(recipes, id);
  const was = recipes[at];
  return deleteWithUndo({
    name,
    remove: () => remove("recipes", id),
    restore: async () => {
      const now = kitchenNow()?.dishes.find((d) => d.id === dish?.id);
      if (!now || !was) throw new ApiError(t("rec.recipeDishGone"), 404);
      await replace("dishes", { ...now, recipes: recipeBack(now.recipes ?? [], was, at) });
    },
    settle: () => {
      for (const photo of photosOf(was)) void deletePhoto(photo);
    },
  });
}

/** Once a deleted dish's window closed: the photo files of its recipes that no other recipe shows. @param {Item} dish */
export function releaseDishPhotos(dish) {
  for (const r of /** @type {Item[]} */ (dish.recipes ?? [])) for (const photo of photosOf(r)) void deletePhoto(photo);
}
