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
  "photo.signedOut": "Signed out; opening the login page.",
  "photo.answered": (status) => `The kitchen answered ${status}.`,
  "photo.orderRemoval": (label) => `${label}: order and removal`,
  "photo.sending": "A photo is being sent.",
  "photo.earlier": "Earlier",
  "photo.later": "Later",
  "photo.remove": "Remove",
  "photo.name": (n) => `Photo ${n}`,
  "photo.notAdded": (why) => `Photo not added: ${why}`,
};
