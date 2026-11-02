// Open the editor page from anywhere (a table row, a card, an import result), through go.js.

import { toast } from "/static/kp/dist/js/overlays.js";
import { reason } from "../api.js";
import { t } from "../i18n/index.js";
import { copyRecipe } from "./duplicate.js";
import { putHandoff } from "./edit-handoff.js";
import { go } from "../go.js";
import { editHref, here } from "./edit-route.js";
import { copyKey } from "./draft-keys.js";

/**
 * Go to the editor page; Save and Back return to the page the person is on now.
 * @param {Parameters<typeof editHref>[0]} spec
 */
export function goEdit(spec) {
  go(editHref(spec, here(location)));
}

/** @param {{ id: string }} recipe */
export const editRecipe = (recipe) => goEdit({ id: recipe.id });

/** A new recipe, in a dish and/or as a safe dish. @param {{ dishId?: string | null, safe?: boolean }} [o] */
export const newRecipe = ({ dishId = null, safe = false } = {}) => goEdit({ dish: dishId, safe });

/**
 * Duplicate (Kenny, 29/10/2026): the editor page opens on an editable copy in the same dish; nothing is stored until Save.
 * @param {Record<string, any>} recipe
 */
export function copyToEditor(recipe) {
  // Each copy has its own draft key (fix-draft-key-1): it never writes over a draft kept for a blank new recipe in the dish.
  const draftKey = copyKey(String(recipe.id), crypto.randomUUID());
  try {
    putHandoff(sessionStorage, { kind: "copy", preset: { ...copyRecipe(recipe), dish_id: recipe.dish_id }, copyOf: String(recipe.name ?? ""), draftKey });
  } catch (e) {
    toast(t("ep.handoffFailed", reason(e)), { live: "assertive", sticky: true });
    return;
  }
  goEdit({ dish: recipe.dish_id, start: "copy", draft: draftKey });
}

/**
 * An import's result opens as an unsaved draft (recipe/import.js): the form state and the cover offer travel in the handoff.
 * @param {{ dishId: string | null, restore: Record<string, any>, cover: string | null, draftKey: string }} found
 */
export function importToEditor({ dishId, restore, cover, draftKey }) {
  putHandoff(sessionStorage, { kind: "import", dishId, restore, cover, draftKey });
  goEdit({ dish: dishId, start: "import", draft: draftKey });
}
