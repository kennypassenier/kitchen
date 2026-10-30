// Words added with format 4 (dishes with recipes) and after, in Dutch.
// Part of nl.js (split by page on 30/10/2026, docs/agent/MODULARITY.md); js/i18n/index.js merges the parts.

export const NL_LATER = {
  // format 4: dishes instead of recipes in the lists' editors
  "rec.noDish": "Geen gerecht",
  "rec.optDish": (n) => `Gerecht: ${n}`,
  "rec.goneDish": "Een verwijderd gerecht",
  // format 4: the freezer's dish
  "rec.dishLink": "Van het gerecht",
  "rec.dishLinkHint": "Welk gerecht het is, als het een van de jouwe is; het wiel telt zijn porties.",
  // format 4: an item's page with the dish's recipe
  "it.openRecipe": "Open het recept",
  "it.noRecipeYet": "Nog geen recept",
  "it.inRecipes": "Gerechten met het in hun recept",
  "it.inDish": "Bij het gerecht",
  "it.inRecipe": "In het recept",
  "it.addRecipe": "Recept toevoegen",
  "it.editRecipe": "Recept bewerken",
  "it.cook": "Koken",
  // wheel: the category filter (format 4)
  "wheel.fCat": "Categorie",
  // wheel: the small wheel for a dish's sides (format 4)
  "wheel.sideKicker": "Het bijgerecht",
  "wheel.sideFirst": "Draai eerst het grote wiel; dan kiest dit wiel het bijgerecht.",
  "wheel.withSide": (s) => `Met ${s.charAt(0).toLowerCase()}${s.slice(1)}`,
  "wheel.sideTurning": "Het kleine wiel kiest het bijgerecht…",
  // format 4: a dish's recipes
  "recipes.numbered": (n) => `Recept ${n}`,
  // format 4: the recipes on a dish's page
  "it.recipesLede": "Hoe dit gerecht gekookt wordt; het standaardrecept opent bij Kook dit op het wiel.",
  "it.noRecipeText": "Voeg toe hoe je het kookt; een gerecht kan meerdere recepten hebben, zoals een voor de oven en een voor de snelkookpan.",
  "it.default": "Standaard",
  "it.makeDefault": "Maak standaard",
  "it.makeDefaultName": (n) => `Maak ${n} standaard`,
  "it.recipeLoses": "Het recept, zijn stappen en foto's. Het gerecht blijft.",
  // wheel: a dish's other recipes
  "wheel.otherRecipes": "Andere recepten:",
  // the picker asks both names (10:04)
  "ip.newAsk": "Een nieuw ingrediënt: zijn Nederlandse en Engelse naam en zijn categorie.",
  "ip.needNl": "De Nederlandse naam ontbreekt.",
  "ip.needEn": "De Engelse naam ontbreekt.",
  // both names (10:04)
  "de.sideLabelHalf": (n) => `Bijgerecht ${n} heeft maar in één taal een eigen naam.`,
  "de.sideLabelFix": "Geef het beide namen, of laat beide leeg zodat het als zijn ingrediënten leest.",
  "rec.missingEn": "Ontbrekende Engelse naam",
  "rec.missingNl": "Ontbrekende Nederlandse naam",
  // bad days: the freezer's name in both languages (10:04)
  "bad.dishNl": "Gerecht (Nederlands)",
  "bad.dishEn": "Gerecht (Engels)",
  "bad.dishEnHint": "Hetzelfde in het Engels.",
  // both languages in the shelf and freezer editors (10:04)
  "rec.inNl": (x) => `${x} (Nederlands)`,
  "rec.inEn": (x) => `${x} (Engels)`,
  "rec.halfText": (x) => `${x} is maar in één taal ingevuld.`,
  // recipe editor: several ingredients at once (10:14)
  "edit.manyLabel": "Ingrediënten om als regels toe te voegen",
  "edit.manyAdd": "Als regels toevoegen",
};
