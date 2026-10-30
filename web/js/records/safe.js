// Safe dishes (a recipe's `safe` flag), the recipe editor/import openers and the zero-prep shelf's "I ate this".

import { undoToast } from "/static/kp/js/undo-toast.js";
import { toast } from "/static/kp/js/overlays.js";
import { h } from "../dom.js";
import { create, replace, remove, kitchenNow, reason } from "../api.js";
import { t, textOf } from "../i18n/index.js";
import { row, select } from "../ui/form-parts.js";
import { today, dmy } from "../format.js";
import { openDrawer, sec } from "../dishes/editor.js";
import { openEditor } from "../recipe/editor.js";
import { openImport } from "../recipe/import.js";
import { drawer } from "./drawer.js";

/** @typedef {import("./lists.js").Item} Item */

// ---- safe dishes: a recipe's `safe` flag ----------------------------------------------------------------------------

/** An empty recipe, for a dish that has none yet. */
export const BLANK_RECIPE = { short: "", summary: "", meals: ["dinner"], ing: [], minutes: 0, hands_on: 0, portions: 2, prep: "light", safe: false, gear: "", last_note: "", mini_note: "", tracks: [], ingredients: [], tools: [], steps: [] };

/** Open the recipe editor for a recipe, or a new one that starts with `preset` (a new safe dish: `{ safe: true }`). `copyOf` names the recipe a copy is made of. @param {Item | null} r @param {Item} [preset] @param {string} [copyOf] */
export function openRecipeEditor(r, preset = {}, copyOf = "") {
  const k = kitchenNow();
  openEditor(drawer(), { recipe: r, preset, copyOf, mainOptions: [...new Set((k?.recipes ?? []).flatMap((x) => x.ing ?? []))] });
}

/** Open the import drawer; a recipe imported from a dish's page goes into that dish (Kenny, 29/10/2026 14:27). `site` is a recipe source the drawer points at. @param {string | null} [dishId] @param {Item | null} [site] */
export function openRecipeImport(dishId = null, site = null) {
  const k = kitchenNow();
  openImport(drawer(), { dishId, site, mainOptions: [...new Set((k?.recipes ?? []).flatMap((x) => x.ing ?? []))] });
}

/** Mark one of the recipes as a safe dish, or write a new one. */
export function openSafePicker() {
  const free = (kitchenNow()?.recipes ?? []).filter((r) => r.safe !== true).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const pick = select(free.map((r) => /** @type {[string, string]} */ ([r.id, String(r.name)])), free[0]?.id ?? "", t("rec.recipe"));
  const fresh = h("button", { type: "button", class: "kp-button" }, t("rec.writeNew"));
  fresh.addEventListener("click", () => openRecipeEditor(null, { safe: true }));
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
