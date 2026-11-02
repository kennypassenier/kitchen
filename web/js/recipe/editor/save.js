// Reading the form back into a recipe, and Save (the editor page's unsaved bar asks for it: pages/recipe-edit/bar.js).

import { combobox, getQuantity, getSegmentedValues } from "/static/kp/dist/kp-themes.min.js";
import { create, replace, kitchenNow, ApiError } from "../../api.js";
import { t, lang } from "../../i18n/index.js";
import { on } from "../../ui/form-parts.js";
import { photosOf } from "../photos.js";
import { limitWords, withinRecipe } from "../../api/refusal.js";
import { sectionOf } from "./sections.js";
import { staleResult } from "./stale.js";
import { recipeBody, labelOut, dishText as dishNameOf } from "./logic.js";

/**
 * The form as a recipe body (`collect`), and the dish named in the first field (`dishText`).
 * @param {{ recipe: Record<string, any> | null, preset: Record<string, any>, r: Record<string, any>, details: ReturnType<typeof import("./details.js").detailFields>, notes: ReturnType<typeof import("./details.js").noteFields>, times: ReturnType<typeof import("./times.js").timeFields>, lists: ReturnType<typeof import("./lists.js").listFields>, steps: ReturnType<typeof import("./steps.js").stepFields> }} o
 */
export function createCollector({ recipe, preset, r, details, notes, times, lists, steps }) {
  /** The dish named in the first field, as the name to show. @param {{ id: string | null, name: { nl: string, en: string } | null }} choice */
  const dishText = (choice) => dishNameOf(choice, kitchenNow()?.dishes ?? [], lang());
  /** The form as a recipe body. `forDraft` keeps imported ingredient lines the catalogue does not know yet (a Save is blocked while any is left). @param {boolean} [forDraft] */
  const collect = (forDraft = false) => {
    const choice = details.dishField.get();
    return recipeBody(
      recipe ?? preset,
      {
        choice,
        label: labelOut(r, /** @type {HTMLInputElement} */ (details.label).value, details.ownLabel, lang()),
        shortTyped: /** @type {HTMLInputElement} */ (details.short).value,
        dishName: dishText(choice ?? { id: null, name: null }),
        summary: /** @type {HTMLTextAreaElement} */ (details.summary).value,
        source: /** @type {HTMLInputElement} */ (details.source).value,
        meals: getSegmentedValues(details.meals),
        ing: combobox(details.mainBox)?.values() ?? [],
        times: times.timesNow(),
        portions: getQuantity(times.portions),
        prep: getSegmentedValues(times.prep)[0] ?? "light",
        safe: on(times.safe),
        gear: /** @type {HTMLInputElement} */ (times.gear).value,
        lastNote: /** @type {HTMLTextAreaElement} */ (notes.lastNote).value,
        miniNote: /** @type {HTMLTextAreaElement} */ (notes.miniNote).value,
        trackRows: lists.tracks.get().map(([tk]) => tk),
        ingredientRows: /** @type {any} */ (lists.ingredients.get()),
        toolRows: lists.tools.get().map(([tk]) => tk),
        steps: steps.list.map((e) => e.get()),
        photo: details.recipePhoto.get()[0] ?? null,
      },
      forDraft,
    );
  };
  return { collect, dishText };
}

/** @typedef {{ ok: true, id: string, name: string } | { ok: false, section: string, message: string, stale?: boolean }} SaveResult */

/**
 * Save: check the dish, the imported lines and the source, then create or replace; the photos settle, the draft goes. A
 * refusal names the section to show it under and says what to do, as one sentence.
 * @param {{ recipe: Record<string, any> | null, collector: ReturnType<typeof createCollector>, details: ReturnType<typeof import("./details.js").detailFields>, lists: ReturnType<typeof import("./lists.js").listFields>, tracker: any, draft: ReturnType<typeof import("./draft.js").createDraft> }} o
 * @returns {() => Promise<SaveResult>}
 */
export function createSaver({ recipe, collector, details, lists, tracker, draft }) {
  const { source, dishField } = details;
  /** @param {string} section @param {string} error @param {string} [remedy] @returns {SaveResult} */
  const refuse = (section, error, remedy = "") => ({ ok: false, section, message: `${error} ${remedy}`.trim() });
  return async function save() {
    const body = collector.collect();
    if (!body.dish_id && !body.new_dish) {
      dishField.input.focus();
      return refuse("dish", t("edit.needsDish"), t("edit.needsDishFix"));
    }
    const shownName = collector.dishText({ id: body.dish_id, name: body.new_dish });
    // Imported lines still waiting for an ingredient are never dropped silently: Save waits until each is resolved.
    const open = lists.unresolvedLines().length;
    if (open) {
      lists.paintUnresolved();
      lists.unresolvedBox.scrollIntoView({ block: "center" });
      return refuse("lists", t("imp.blocked", open), t("imp.blockedFix"));
    }
    const typedSource = /** @type {HTMLInputElement} */ (source).value.trim();
    if (typedSource && !/^https?:\/\/\S+$/i.test(typedSource)) {
      source.focus();
      return refuse("dish", t("edit.sourceBad"), t("edit.sourceBadFix"));
    }
    let saved;
    try {
      // The dish's revision as this editor read it: a save made elsewhere since is refused, not overwritten (fix-stale-save-1).
      saved = recipe ? await replace("recipes", body, { ifMatch: recipe.dish_rev }) : await create("recipes", body);
    } catch (e) {
      const stale = staleResult(e, t);
      if (stale) return stale;
      if (e instanceof ApiError && e.limit) {
        // A size refusal names the field within this recipe and the section it sits in (fix-field-limits-1).
        const field = withinRecipe(e.limit.field);
        return refuse(sectionOf(field), limitWords({ ...e.limit, field }, t));
      }
      return refuse("dish", e instanceof ApiError ? e.message : String(e));
    }
    await tracker.settle(photosOf(body));
    await draft.drop();
    return { ok: true, id: String(saved?.id ?? recipe?.id ?? ""), name: shownName };
  };
}
