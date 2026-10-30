// The recipes card on a dish's page.

import { attachCardStates, setCardState } from "/static/kp/js/card-state.js";
import { toast } from "/static/kp/js/overlays.js";
import { openConfirmation } from "/static/kp/js/components.js";
import { makeDefaultRecipe, recipeLabel, remove, ApiError } from "../../api.js";
import { h } from "../../dom.js";
import { openRecipeEditor, openRecipeImport, duplicateRecipe, BLANK_RECIPE } from "../../records/index.js";
import { t } from "../../i18n/index.js";

/** @typedef {import("../../api.js").Kitchen} Kitchen */
/** @typedef {Record<string, any>} Item */

/**
 * A dish's recipes (Kenny, 24/10/2026 09:18, 09:27: the recipe belongs to the dish, and a dish may have several, one
 * the default): one row per recipe with its label, Open, Cook, Make default, Edit and Delete, and Add a recipe.
 * @param {HTMLElement} pageEl
 */
export function dishRecipes(pageEl) {
  const add = h("button", { type: "button", class: "kp-button kp-button--primary" }, t("it.addRecipe"));
  const importer = h("button", { type: "button", class: "kp-button" }, t("imp.button"));
  const listEl = h("ul", { class: "kp-action-list it-recipes" });
  const card = h(
    "section",
    { class: "kp-card it-card", "data-kp-state": "ready", "aria-labelledby": "it-recipes-t" },
    h("div", { class: "kp-card__header" }, h("h2", { class: "kp-card__title", id: "it-recipes-t" }, t("nav.recipes")), h("div", { class: "kp-card__actions" }, importer, add)),
    h("p", { class: "kp-card__body" }, t("it.recipesLede")),
    h("div", { class: "kp-card__stage" }, h("div", { class: "kp-card__data" }, listEl)),
  );
  pageEl.append(card);
  const stopCard = attachCardStates(card);
  /** @type {Item | null} */
  let dish = null;
  add.addEventListener("click", () => {
    if (!dish) return;
    openRecipeEditor(null, { ...BLANK_RECIPE, dish_id: dish.id });
  });
  importer.addEventListener("click", () => {
    if (dish) openRecipeImport(dish.id);
  });
  return {
    /** @param {Kitchen} k @param {Item} d */
    show(k, d) {
      dish = d;
      const recipes = /** @type {Item[]} */ (d.recipes ?? []);
      if (!recipes.length) {
        const first = h("button", { type: "button", class: "kp-button kp-button--primary" }, t("it.addRecipe"));
        first.addEventListener("click", () => add.click());
        setCardState(card, "empty", { title: t("it.noRecipeYet"), text: t("it.noRecipeText"), action: first });
        return;
      }
      listEl.replaceChildren(
        ...recipes.map((r, i) => {
          const view = k.recipes.find((x) => x.id === r.id) ?? r;
          const label = recipeLabel(r, i);
          const edit = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": t("rec.editName", label) }, t("common.edit"));
          edit.addEventListener("click", () => openRecipeEditor(view));
          const copy = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": t("rec.duplicateName", label) }, t("common.duplicate"));
          copy.addEventListener("click", () => duplicateRecipe(view));
          const del = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--destructive", "aria-label": t("rec.deleteName", label) }, t("common.delete"));
          del.addEventListener("click", () =>
            openConfirmation(del, {
              phrase: t("rec.deleteAsk", view.name),
              typeName: label,
              acceptLabel: t("list.recipes.delete"),
              loses: [t("it.recipeLoses")],
              onAccept: () => void remove("recipes", r.id).then(() => toast(t("rec.deleted", view.name)), (e) => toast(t("rec.notDeleted", e instanceof ApiError ? e.message : String(e)), { live: "assertive", sticky: true })),
            }),
          );
          const isDefault = r.default === true || (i === 0 && !recipes.some((x) => x.default === true));
          const def = isDefault
            ? h("span", { class: "kp-badge kp-badge--success" }, t("it.default"))
            : h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": t("it.makeDefaultName", label) }, t("it.makeDefault"));
          if (!isDefault) def.addEventListener("click", () => void makeDefaultRecipe(r.id).catch((e) => toast(String(e), { live: "assertive" })));
          return h(
            "li",
            { "data-key": r.id },
            h("span", { class: "kp-action-list__lead" }, h("span", { class: "kp-badge" }, `${r.minutes ?? 0} min`)),
            h("div", { class: "kp-action-list__main" }, h("strong", { class: "kp-action-list__title" }, h("a", { href: `/recipe?id=${encodeURIComponent(r.id)}` }, label)), h("span", { class: "kp-action-list__text" }, r.summary || "")),
            h("div", { class: "kp-row-actions" }, def, h("a", { class: "kp-button kp-button--sm kp-button--primary", href: `/cook?id=${encodeURIComponent(r.id)}&fresh=1` }, t("it.cook")), edit, copy, del),
          );
        }),
      );
      setCardState(card, "ready");
    },
    stop: stopCard,
  };
}

