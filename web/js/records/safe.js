// Safe dishes (a recipe's `safe` flag) and the zero-prep shelf's "I ate this".

import { undoToast, toast } from "/static/kp/dist/kp-themes.min.js";
import { create, replace, remove, kitchenNow, reason } from "../api.js";
import { t, textOf } from "../i18n/index.js";
import { today, dmy } from "../format.js";

/** @typedef {import("./lists.js").Item} Item */

// ---- safe dishes: a recipe's `safe` flag ----------------------------------------------------------------------------

/** Take a recipe off the safe dishes; the recipe stays, and Undo puts it back. @param {Item} r */
export function unmarkSafe(r) {
  void replace("recipes", { ...r, safe: false }).then(
    () =>
      undoToast(t("rec.notSafe", r.name), {
        mode: "revert",
        ms: 10_000,
        clock: "ring",
        undo: async () => {
          const now = kitchenNow()?.recipes.find((x) => x.id === r.id);
          if (now) await replace("recipes", { ...now, safe: true }).catch((e) => toast(t("rec.notBack", reason(e)), { live: "assertive", sticky: true }));
        },
      }),
    (e) => toast(t("rec.notChanged", reason(e)), { live: "assertive", sticky: true }),
  );
}

// ---- the zero-prep shelf: I ate this ------------------------------------------------------------------------------

/** Log a shelf food as eaten today (Kenny, 24/10/2026 05:07), with Undo. Resolves to the sentence that says so. @param {Item} s */
export async function ateShelf(s) {
  const line = await create("log", { dish_id: null, shelf_id: s.id, date: today(), feeling: null, note: "" });
  undoToast(t("rec.loggedToday", textOf(s.title)), {
    mode: "revert",
    ms: 10_000,
    clock: "ring",
    undo: async () => {
      try {
        await remove("log", line.id);
      } catch (e) {
        toast(t("rec.notTakenBack", reason(e)), { live: "assertive", sticky: true });
      }
    },
  });
  return t("rec.loggedReadout", textOf(s.title), dmy(today()));
}
