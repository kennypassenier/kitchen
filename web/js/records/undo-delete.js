// Delete at once, with Undo (Kenny, 01/11/2026 20:21, "Ongedaan maken"; the shelf and the log did it first): the item
// goes the moment Delete is pressed and the kit's undo toast offers it back for 10 s. Every list that can be restored
// goes through here: the records (dish, category, ingredient, source, freezer, shelf, log, resting) and a recipe
// (records/recipe-delete.js), so the Recipes page can use the same call. What only the end of the window may do (delete
// a recipe's photo files) waits for it in `settle`; Undo skips it, so a restored recipe keeps its pictures.

import { toast, undoToast } from "/static/kp/dist/kp-themes.min.js";
import { reason } from "../api.js";
import { t } from "../i18n/index.js";
import { saveFailed } from "../api/stale-notice.js";

/** How long Undo is offered (Kenny's choice: 10 s, as the shelf and the log). */
export const UNDO_MS = 10_000;

/**
 * @typedef {object} UndoDelete
 * @property {string} name what the toast calls the item: "Deleted <name>."
 * @property {() => Promise<unknown>} remove takes it away now
 * @property {() => Promise<unknown>} restore puts it back on Undo
 * @property {() => unknown} [settle] runs once the window closed without Undo
 */

/**
 * Remove an item now and offer Undo. Resolves to whether the item went: a refused delete says why in a toast and
 * leaves everything as it was.
 * @param {UndoDelete} o
 * @returns {Promise<boolean>}
 */
export async function deleteWithUndo({ name, remove, restore, settle }) {
  try {
    await remove();
  } catch (e) {
    toast(t("rec.notDeleted", reason(e)), { live: "assertive", sticky: true });
    return false;
  }
  const run = undoToast(t("rec.deleted", name), {
    mode: "revert",
    ms: UNDO_MS,
    clock: "ring",
    undo: async () => {
      try {
        await restore();
      } catch (e) {
        // A recipe's Undo saves its dish: changed elsewhere since, it is refused as stale (fix-quick-rev-1).
        saveFailed(e, () => t("rec.notBack", reason(e)));
      }
    },
  });
  if (settle) void run.done.then((how) => how === "committed" && settle());
  return true;
}
