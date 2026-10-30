// Words added with format 4 (dishes with recipes) and after, in English.
// Part of en.js (split by page on 30/10/2026, docs/agent/MODULARITY.md); js/i18n/index.js merges the parts.

export const EN_LATER = {
  // format 4: dishes instead of recipes in the lists' editors
  "rec.noDish": "No dish",
  "rec.optDish": (n) => `Dish: ${n}`,
  "rec.goneDish": "A dish that was deleted",
  // format 4: the freezer's dish
  "rec.dishLink": "From the dish",
  "rec.dishLinkHint": "The dish it is, if it is one of yours; the wheel counts its portions.",
  // format 4: an item's page with the dish's recipe
  "it.openRecipe": "Open the recipe",
  "it.noRecipeYet": "No recipe yet",
  "it.inRecipes": "Dishes with it in their recipe",
  "it.inDish": "On the dish",
  "it.inRecipe": "In the recipe",
  "it.addRecipe": "Add the recipe",
  "it.editRecipe": "Edit the recipe",
  "it.cook": "Cook it",
  // wheel: the category filter (format 4)
  "wheel.fCat": "Category",
  // wheel: the small wheel for a dish's sides (format 4)
  "wheel.sideKicker": "The side",
  "wheel.sideFirst": "Spin the big wheel first; then this wheel picks the side.",
  "wheel.withSide": (s) => `With ${s.charAt(0).toLowerCase()}${s.slice(1)}`,
  "wheel.sideTurning": "The small wheel picks the side…",
  // format 4: a dish's recipes
  "recipes.numbered": (n) => `Recipe ${n}`,
  // format 4: the recipes on a dish's page
  "it.recipesLede": "How this dish is cooked; the default is the one the wheel's Cook this opens.",
  "it.noRecipeText": "Add how you cook it; a dish can have several recipes, such as one for the oven and one for the pressure cooker.",
  "it.default": "Default",
  "it.makeDefault": "Make default",
  "it.makeDefaultName": (n) => `Make ${n} the default`,
  "it.recipeLoses": "The recipe, its steps and photos. The dish stays.",
  // wheel: a dish's other recipes
  "wheel.otherRecipes": "Other recipes:",
  // the picker asks both names (10:04)
  "ip.newAsk": "A new ingredient: its Dutch and English name and its category.",
  "ip.needNl": "The Dutch name is missing.",
  "ip.needEn": "The English name is missing.",
  // both names (10:04)
  "de.sideLabelHalf": (n) => `Side ${n} has its own name in one language only.`,
  "de.sideLabelFix": "Give it both names, or leave both empty to read as its ingredients.",
  "rec.missingEn": "Missing English name",
  "rec.missingNl": "Missing Dutch name",
  // bad days: the freezer's name in both languages (10:04)
  "bad.dishNl": "Dish (Dutch)",
  "bad.dishEn": "Dish (English)",
  "bad.dishEnHint": "The same in English.",
  // both languages in the shelf and freezer editors (10:04)
  "rec.inNl": (x) => `${x} (Dutch)`,
  "rec.inEn": (x) => `${x} (English)`,
  "rec.halfText": (x) => `${x} is filled in one language only.`,
  // recipe editor: several ingredients at once (10:14)
  "edit.manyLabel": "Ingredients to add as lines",
  "edit.manyAdd": "Add as lines",
};
