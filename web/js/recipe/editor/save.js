// Reading the form back into a recipe, and Save.

import { combobox, getQuantity, getSegmentedValues, runFlashButton, toast } from "/static/kp/dist/kp-themes.min.js";
import { create, replace, kitchenNow, ApiError } from "../../api.js";
import { t, lang } from "../../i18n/index.js";
import { on } from "../../ui/form-parts.js";
import { photosOf } from "../photos.js";
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

/**
 * Submit: check the dish, the imported lines and the source, then create or replace; the photos settle, the draft goes.
 * @param {{ form: HTMLFormElement, save: HTMLElement, recipe: Record<string, any> | null, editing: boolean, collector: ReturnType<typeof createCollector>, details: ReturnType<typeof import("./details.js").detailFields>, lists: ReturnType<typeof import("./lists.js").listFields>, tracker: any, draft: ReturnType<typeof import("./draft.js").createDraft>, close: () => void }} o
 */
export function wireSubmit({ form, save, recipe, editing, collector, details, lists, tracker, draft, close }) {
  const { source, dishField } = details;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void runFlashButton(save, async () => {
      const body = collector.collect();
      if (!body.dish_id && !body.new_dish) {
        dishField.input.focus();
        return { error: t("edit.needsDish"), remedy: t("edit.needsDishFix"), word: t("rec.notSaved") };
      }
      const shownName = collector.dishText({ id: body.dish_id, name: body.new_dish });
      // Imported lines still waiting for an ingredient are never dropped silently: Save waits until each is resolved.
      const open = lists.unresolvedLines().length;
      if (open) {
        lists.paintUnresolved();
        lists.unresolvedBox.scrollIntoView({ block: "center" });
        return { error: t("imp.blocked", open), remedy: t("imp.blockedFix"), word: t("rec.notSaved") };
      }
      const typedSource = /** @type {HTMLInputElement} */ (source).value.trim();
      if (typedSource && !/^https?:\/\/\S+$/i.test(typedSource)) {
        source.focus();
        return { error: t("edit.sourceBad"), remedy: t("edit.sourceBadFix"), word: t("rec.notSaved") };
      }
      try {
        if (recipe) await replace("recipes", body);
        else await create("recipes", body);
      } catch (e) {
        return { error: e instanceof ApiError ? e.message : String(e), word: t("rec.notSaved") };
      }
      await tracker.settle(photosOf(body));
      await draft.drop();
      toast(editing ? t("rec.savedName", shownName) : t("rec.addedName", shownName));
      close();
      return t("set.saved");
    });
  });
}
