// What the editor offers: meals, preparation, main ingredients, units and the two lists a recipe line may be on.

import { t, lang } from "../../i18n/index.js";
import { wordsFor } from "../words.js";

/** Meals and preparation, as the data names them. */
export const mealItems = () => [["breakfast", t("wheel.mealBreakfast")], ["lunch", t("wheel.mealLunch")], ["dinner", t("wheel.mealDinner")]];
export const prepItems = () => [["none", t("edit.prepNone")], ["light", t("edit.prepLight")], ["full", t("edit.prepFull")]];
/** Main ingredients the wheel knows; any other already in the kitchen is added to the list. */
export const MAIN = ["chicken", "beef", "pork", "fish", "egg", "cheese", "tomato", "potato", "vegetables", "pasta", "rice"];
export const UNITS = ["g", "ml", "pc", "tbsp", "tsp", "pinch", "clove", "slice", "handful"];
/** The two lists a recipe line may be on, named in the language of the screen (an older recipe's own list names stay as written). */
export const groups = () => [t("edit.groupMain"), t("edit.groupCupboard")];
/** A unit written out in the language of the screen. @param {string} unit */
export const unitName = (unit) => wordsFor(lang()).units[/** @type {"g"} */ (unit)]?.[0] ?? unit;

