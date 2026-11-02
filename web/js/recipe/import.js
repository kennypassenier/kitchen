// Import a recipe (Kenny, 29/10/2026 14:27): ask the kitchen to read a web address or pasted text (POST /data/import,
// src/import.rs) and open the recipe editor page on what came back, as an UNSAVED draft: the dish stays empty (or is the
// dish the import was started from) and required, nothing is stored until Save, and Discard clears the draft like any
// other. What the result becomes is recipe/import-plan.js (pure, tested); the reading of lines is import-lines.js; the
// cover photo is offered in the editor (cover.js). The field that starts it is pages/recipes/import-field.js.

import { importRecipe, kitchenNow, saveDraft } from "../api.js";
import { importToEditor } from "./edit-nav.js";
import { planImport } from "./import-plan.js";
import { t } from "../i18n/index.js";

/**
 * Read `body` (a web address or pasted text), write the draft, and open the editor page on it. Throws what the kitchen
 * refused with (an ApiError whose message is the error code).
 * @param {{ url: string } | { text: string }} body @param {string | null} dishId
 */
export async function runImport(body, dishId) {
  /** @type {import("./import-plan.js").Imported} */
  const found = await importRecipe(body);
  const plan = planImport(found, dishId, kitchenNow()?.ingredients ?? [], t("edit.groupMain"), crypto.randomUUID());
  // The draft is written first, as the editor would after the first change, under the import's own key: it can never
  // write over a draft kept for a blank new recipe or another import (fix-draft-key-1).
  await saveDraft(plan.key, plan.restore).catch((e) => console.error("the import's draft was not saved", e));
  importToEditor({ dishId, restore: plan.restore, cover: plan.cover, draftKey: plan.key });
}
