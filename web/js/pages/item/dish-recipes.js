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

/** Delete asks for the label; the recipe's photos are the editor's business. @param {HTMLElement} del @param {Item} r @param {Item} view @param {string} label */
function askDelete(del, r, view, label) {
  openConfirmation(del, {
    phrase: t("rec.deleteAsk", view.name),
    typeName: label,
    acceptLabel: t("list.recipes.delete"),
    loses: [t("it.recipeLoses")],
    onAccept: () => void remove("recipes", r.id).then(() => toast(t("rec.deleted", view.name)), (e) => toast(t("rec.notDeleted", e instanceof ApiError ? e.message : String(e)), { live: "assertive", sticky: true })),
  });
}

/** Edit, Duplicate and Delete for one recipe. @param {Item} r @param {Item} view @param {string} label */
function recipeButtons(r, view, label) {
  const edit = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": t("rec.editName", label) }, t("common.edit"));
  edit.addEventListener("click", () => openRecipeEditor(view));
  const copy = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": t("rec.duplicateName", label) }, t("common.duplicate"));
  copy.addEventListener("click", () => duplicateRecipe(view));
  const del = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--destructive", "aria-label": t("rec.deleteName", label) }, t("common.delete"));
  del.addEventListener("click", () => askDelete(del, r, view, label));
  return [edit, copy, del];
}

/** The "default" badge, or the button that makes this recipe the default. @param {Item} r @param {string} label @param {boolean} isDefault */
function defaultMark(r, label, isDefault) {
  if (isDefault) return h("span", { class: "kp-badge kp-badge--success" }, t("it.default"));
  const def = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": t("it.makeDefaultName", label) }, t("it.makeDefault"));
  def.addEventListener("click", () => void makeDefaultRecipe(r.id).catch((e) => toast(String(e), { live: "assertive" })));
  return def;
}

/** One recipe of the dish. @param {Item} r @param {number} i @param {Item[]} recipes @param {Kitchen} k */
function recipeRow(r, i, recipes, k) {
  const view = k.recipes.find((x) => x.id === r.id) ?? r;
  const label = recipeLabel(r, i);
  const [edit, copy, del] = recipeButtons(r, view, label);
  const isDefault = r.default === true || (i === 0 && !recipes.some((x) => x.default === true));
  return h(
    "li",
    { "data-key": r.id },
    h("span", { class: "kp-action-list__lead" }, h("span", { class: "kp-badge" }, `${r.minutes ?? 0} min`)),
    h("div", { class: "kp-action-list__main" }, h("strong", { class: "kp-action-list__title" }, h("a", { href: `/recipe?id=${encodeURIComponent(r.id)}` }, label)), h("span", { class: "kp-action-list__text" }, r.summary || "")),
    h("div", { class: "kp-row-actions" }, defaultMark(r, label, isDefault), h("a", { class: "kp-button kp-button--sm kp-button--primary", href: `/cook?id=${encodeURIComponent(r.id)}&fresh=1` }, t("it.cook")), edit, copy, del),
  );
}

/** The card with its Add and Import buttons and the list. */
function buildCard() {
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
  return { add, importer, listEl, card };
}

/**
 * A dish's recipes (Kenny, 24/10/2026 09:18, 09:27: the recipe belongs to the dish, and a dish may have several, one
 * the default): one row per recipe with its label, Open, Cook, Make default, Edit and Delete, and Add a recipe.
 * @param {HTMLElement} pageEl
 */
export function dishRecipes(pageEl) {
  const { add, importer, listEl, card } = buildCard();
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
      listEl.replaceChildren(...recipes.map((r, i) => recipeRow(r, i, recipes, k)));
      setCardState(card, "ready");
    },
    stop: stopCard,
  };
}
