// The words of the wheel, timing, bad days, settings, recipes, the recipe page and cook mode, in English. The same
// keys as ./nl-pages.js; js/i18n/index.js merges this with ./en.js.

import { EN_WHEEL } from "./en/wheel.js";
import { EN_TIMING } from "./en/timing.js";
import { EN_BADDAYS } from "./en/baddays.js";
import { EN_SETTINGS } from "./en/settings.js";
import { EN_RECIPES } from "./en/recipes.js";
import { EN_RECIPE } from "./en/recipe.js";
import { EN_EDITOR } from "./en/editor.js";
import { EN_COOK } from "./en/cook.js";
import { EN_PARENTS } from "./en/parents.js";

export const EN_PAGES = {
  ...EN_WHEEL,
  ...EN_TIMING,
  ...EN_BADDAYS,
  ...EN_SETTINGS,
  ...EN_RECIPES,
  ...EN_RECIPE,
  ...EN_EDITOR,
  ...EN_COOK,
  ...EN_PARENTS,
};
