// The package's Dutch words for calm mode, flash, themes, three-way chips, quantity and checklists.
// Part of kp-nl.js (split by component family on 30/10/2026, docs/agent/MODULARITY.md).

export const KP_NL_CONTROLS = {
  // card states, calm mode, lede, flash, themes
  stateRetry: "Opnieuw",
  stateFailedText: "Er is niets veranderd. Probeer het zo meteen opnieuw.",
  calmOn: "Rustige stand aan",
  calmOff: "Rustige stand uit",
  calmSystem: "Je systeem vraagt om minder beweging",
  ledeMore: "Meer",
  ledeLess: "Minder",
  ledeLearnMore: "Meer weten",
  flashDone: "Klaar",
  flashRefused: "Geweigerd",
  flashFailed: "Mislukt",
  pagination: "Paginering",
  themePicker: "Kies een thema",
  themeSaveFailed: "Deze keuze wordt niet onthouden: opslag is geblokkeerd in deze browser.",
  themeGroupLight: "Licht",
  themeGroupDark: "Donker",
  // three-way chips
  triInclude: "vereist",
  triExclude: "uitgesloten",
  triAny: "maakt niet uit",
  triAnnounce: (label, state) => `${label}: ${state}`,
  triHint: "Tik één keer op een chip om het te willen, twee keer om het uit te sluiten, een derde keer om los te laten.",
  triSummary: (include, exclude) => {
    const line = [include.length ? `met ${include.join(", ")}` : "", exclude.length ? `zonder ${exclude.join(", ")}` : ""].filter(Boolean).join(", ");
    return line.charAt(0).toUpperCase() + line.slice(1);
  },
  triCleared: "Elk filter is losgelaten.",
  // quantity and checklists
  quantityLess: (label) => (label ? `${label}, minder` : "Minder"),
  quantityMore: (label) => (label ? `${label}, meer` : "Meer"),
  quantityValue: (value, unit) => `${value} ${unit}`,
  checklistCount: (done, total) => `${done} van ${total}`,
  checklistSummary: (done, total) => `${done} van ${total} klaar`,
  checklistCheckAll: "Alles afvinken",
  checklistUncheckAll: "Alles uitvinken",
  checklistClear: "Afgevinkte wissen",
  checklistUndo: "Ongedaan maken",
  checklistCleared: (n) => `${n} gewist`,
  checklistRestored: (n) => `${n} terug op de lijst`,
  checklistEmpty: "Niets op de lijst.",
  checklistLoading: "De lijst wordt geladen…",
  checklistFailed: "De lijst kon niet gelezen worden.",
  checklistDone: (label) => `${label} klaar`,
  checklistDoneMoved: (label) => `${label} klaar, naar het einde verplaatst. Volgende.`,
  checklistOpen: (label) => `${label} terug op de lijst`,
};
