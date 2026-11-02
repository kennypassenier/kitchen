// The words of the recipe editor page (pages/recipe-edit/), English.

export const EN_EDITPAGE = {
  "ep.back": "Back",
  "ep.opening": "Opening the editor…",
  "ep.index": "On this page",
  "ep.notFoundTitle": "That recipe is not here",
  "ep.notFoundText": "It may have been deleted. The recipe list has every recipe there is.",
  "ep.openRecipes": "Open the recipes",
  "ep.failedTitle": "The editor could not open",
  "ep.wasSaved": "As saved",
  "ep.wasNone": "Not saved yet",
  "ep.nowChanged": "Changed",
  "ep.handoffFailed": (why) => `The copy could not be opened: ${why}`,
  // fix-stale-save-1: another tab or device saved this recipe after this page opened it.
  "ep.staleTitle": "This recipe was changed somewhere else in the meantime.",
  "ep.staleText": "Your version is not saved. Reload drops it and opens the saved recipe; keep it as a draft and the reloaded page offers it back.",
  "ep.staleReload": "Reload",
  "ep.staleKeep": "Keep my version as a draft",
  "ep.staleFailed": (why) => `That did not work: ${why}`,
};
