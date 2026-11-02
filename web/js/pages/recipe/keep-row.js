// The recipe page's "Offline bewaren" / "Keep offline" toggle (feat-offline-recipe, Kenny 02/11/2026 17:25 and 19:12):
// when "Keep everything offline" is off on this device, one recipe (with its dish, which holds it, and what cook mode
// needs) can be kept on its own. Hidden while "keep everything" is on (everything is kept then).
//
// The kp switch with one line that says what it does and one that says what happened; a failure is said there and in
// the console, never swallowed.

import { h } from "../../dom.js";
import { t } from "../../i18n/index.js";
import { kitchenNow } from "../../api.js";
import { keepRecipe, recipeKeepState } from "../../api/recipe-keep.js";

/** The row, hidden until the device's setting is read. One per page; the card re-appends it on every draw. */
export function buildKeepRow() {
  const input = /** @type {HTMLInputElement} */ (h("input", { class: "kp-switch__input", type: "checkbox", role: "switch", id: "rp-keep" }));
  const said = h("p", { class: "kp-formgrid__value rp-keep__said", role: "status", "aria-live": "polite" });
  const el = h(
    "div",
    { class: "kp-formgrid rp-keep", hidden: true },
    h(
      "div",
      { class: "kp-formgrid__row" },
      h("label", { class: "kp-formgrid__label", for: "rp-keep" }, t("recipe.keepTitle")),
      h("div", { class: "kp-formgrid__control" }, h("label", { class: "kp-switch" }, input, h("span", { class: "kp-switch__state", "aria-hidden": "true" }), h("span", null, t("recipe.keepSwitch")))),
      h("div", { class: "kp-formgrid__value" }, h("p", { class: "rp-keep__text" }, t("recipe.keepText")), said),
    ),
  );
  return { el, input, said };
}

/**
 * Show the row for the dish of the recipe on the page, or hide it. A failed read hides nothing silently: the row says
 * it and the console has the cause.
 * @param {ReturnType<typeof buildKeepRow>} row @param {string} dishId
 */
export async function paintKeepRow(row, dishId) {
  try {
    const state = await recipeKeepState(dishId);
    row.el.hidden = state === "all";
    row.input.disabled = false;
    row.input.checked = state === "kept";
    row.input.dataset.dish = dishId;
  } catch (e) {
    console.warn("Kitchen: whether this recipe is kept offline could not be read", e);
    row.el.hidden = false;
    row.input.disabled = true;
    row.said.textContent = t("recipe.keepReadFailed");
  }
}

/** Wire the switch once; returns the clean-up. @param {ReturnType<typeof buildKeepRow>} row */
export function wireKeepRow(row) {
  const onChange = () => {
    const dishId = row.input.dataset.dish ?? "";
    const on = row.input.checked;
    row.input.disabled = true;
    void keepRecipe(kitchenNow()?.dishes ?? [], dishId, on)
      .then(({ kept, copied }) => {
        row.input.checked = kept;
        row.said.textContent = !on ? t("recipe.keepOff") : copied ? t("recipe.keepOn") : t("recipe.keepOnLater");
      })
      .catch((e) => {
        console.warn("Kitchen: keeping this recipe offline could not be changed", e);
        row.input.checked = !on;
        row.said.textContent = t("recipe.keepFailed");
      })
      .finally(() => {
        row.input.disabled = false;
      });
  };
  row.input.addEventListener("change", onChange);
  return () => row.input.removeEventListener("change", onChange);
}
