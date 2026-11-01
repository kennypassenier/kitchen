// Safe dishes (a recipe's `safe` flag) and the zero-prep shelf's "I ate this".

import { undoToast, toast, closeDialog } from "/static/kp/dist/kp-themes.min.js";
import { h } from "../dom.js";
import { create, replace, remove, kitchenNow, reason } from "../api.js";
import { t, textOf } from "../i18n/index.js";
import { row, select } from "../ui/form-parts.js";
import { today, dmy } from "../format.js";
import { openDrawer, sec } from "../dishes/editor.js";
import { newRecipe } from "../recipe/edit-nav.js";
import { drawer } from "./drawer.js";

/** @typedef {import("./lists.js").Item} Item */

// ---- safe dishes: a recipe's `safe` flag ----------------------------------------------------------------------------

/** Mark one of the recipes as a safe dish, or write a new one. */
export function openSafePicker() {
  const free = (kitchenNow()?.recipes ?? []).filter((r) => r.safe !== true).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const pick = select(free.map((r) => /** @type {[string, string]} */ ([r.id, String(r.name)])), free[0]?.id ?? "", t("rec.recipe"));
  const fresh = h("button", { type: "button", class: "kp-button" }, t("rec.writeNew"));
  fresh.addEventListener("click", () => void closeDialog(drawer()).then(() => newRecipe({ safe: true })));
  const form = /** @type {HTMLFormElement} */ (
    h(
      "form",
      { class: "kp-drawer__body rl-form", id: "rc-form", novalidate: true },
      sec(
        t("rec.safeTitle"),
        t("rec.safeText"),
        h(
          "div",
          { class: "kp-formgrid kitchen-formgrid" },
          free.length ? row(t("rec.recipe"), pick, t("rec.safeOnlyFree")) : row(t("rec.recipe"), h("p", { class: "kp-kv__none" }, t("rec.allSafe")), ""),
          h("div", { class: "kp-formgrid__row kp-formgrid__row--buttons" }, h("div", { class: "kp-formgrid__control" }, fresh)),
        ),
      ),
    )
  );
  openDrawer(drawer(), {
    title: t("rec.safeAdd"),
    text: t("rec.safeAddText"),
    form,
    saveLabel: t("rec.makeSafe"),
    onSave: async () => {
      const r = free.find((x) => x.id === pick.value);
      if (!r) return { error: t("rec.errNoRecipe"), remedy: t("rec.fixNoRecipe"), word: t("rec.notSaved") };
      try {
        await replace("recipes", { ...r, safe: true });
      } catch (e) {
        return { error: reason(e), word: t("rec.notSaved") };
      }
      toast(t("rec.isSafe", r.name));
      return t("rec.saved");
    },
  });
}

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
