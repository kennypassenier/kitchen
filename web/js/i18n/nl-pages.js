// The words of the wheel, timing, bad days, settings, recipes, the recipe page and cook mode, in Dutch. The same keys
// as ./en-pages.js; a key missing here falls back to English.

import { NL_WHEEL } from "./nl/wheel.js";
import { NL_TIMING } from "./nl/timing.js";
import { NL_BADDAYS } from "./nl/baddays.js";
import { NL_SETTINGS } from "./nl/settings.js";
import { NL_RECIPES } from "./nl/recipes.js";
import { NL_RECIPE } from "./nl/recipe.js";
import { NL_EDITOR } from "./nl/editor.js";
import { NL_COOK } from "./nl/cook.js";
import { NL_PARENTS } from "./nl/parents.js";

export const NL_PAGES = {
  ...NL_WHEEL,
  ...NL_TIMING,
  ...NL_BADDAYS,
  ...NL_SETTINGS,
  ...NL_RECIPES,
  ...NL_RECIPE,
  ...NL_EDITOR,
  ...NL_COOK,
  ...NL_PARENTS,
};
