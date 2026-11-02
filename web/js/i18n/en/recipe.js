// The recipe page and its photos, in English.
// Part of en-pages.js (split by page on 30/10/2026, docs/agent/MODULARITY.md); js/i18n/index.js merges the parts.

export const EN_RECIPE = {
  // recipe page
  "recipe.cardLabel": "Recipe",
  // photos
  "photo.unreadable": "That file is not a picture this browser can read.",
  "photo.noCanvas": "This browser cannot make the picture smaller.",
  "photo.tooLarge": "The picture is still too large after making it smaller.",
  "photo.notPicture": (name) => `${name} is not a picture.`,
  "photo.thatFile": "That file",
  "photo.dropped": "The connection to the kitchen dropped. Nothing is lost; try again.",
  "photo.signedOut": "You are signed out, so the picture was not sent. Sign in, then add it again.",
  "photo.answered": (status) => `The kitchen answered ${status}.`,
  "photo.orderRemoval": (label) => `${label}: order and removal`,
  "photo.sending": "A photo is being sent.",
  "photo.earlier": "Earlier",
  "photo.later": "Later",
  "photo.remove": "Remove",
  "photo.name": (n) => `Photo ${n}`,
  "photo.notAdded": (why) => `Photo not added: ${why}`,
  // the per-recipe offline toggle (pages/recipe/keep-row.js, feat-offline-recipe)
  "recipe.keepTitle": "Keep offline",
  "recipe.keepSwitch": "Keep offline",
  "recipe.keepText": "Keeps this recipe on this device, so it and cook mode open without a connection. Its dish comes along (with the dish's other recipes), and so do the ingredient names and the settings cook mode needs.",
  "recipe.keepOn": "Kept on this device.",
  "recipe.keepOnLater": "Kept, but there is no connection right now: the copy is made the next time this recipe opens with one.",
  "recipe.keepOff": "No longer kept. What is stored stays until you clear the offline copy in Settings.",
  "recipe.keepFailed": "Keeping this recipe offline could not be changed on this device.",
  "recipe.keepReadFailed": "Whether this recipe is kept offline could not be read on this device.",
};
