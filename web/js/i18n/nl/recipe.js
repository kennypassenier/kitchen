// The recipe page and its photos, in Dutch.
// Part of nl-pages.js (split by page on 30/10/2026, docs/agent/MODULARITY.md); js/i18n/index.js merges the parts.

export const NL_RECIPE = {
  // recipe page
  "recipe.cardLabel": "Recept",
  // photos
  "photo.unreadable": "Dat bestand is geen foto die deze browser kan lezen.",
  "photo.noCanvas": "Deze browser kan de foto niet kleiner maken.",
  "photo.tooLarge": "De foto is nog te groot na het verkleinen.",
  "photo.notPicture": (name) => `${name} is geen foto.`,
  "photo.thatFile": "Dat bestand",
  "photo.dropped": "De verbinding met de keuken viel weg. Er is niets verloren; probeer opnieuw.",
  "photo.signedOut": "Je bent afgemeld; de aanmeldpagina wordt geopend.",
  "photo.answered": (status) => `De keuken antwoordde met ${status}.`,
  "photo.orderRemoval": (label) => `${label}: volgorde en verwijderen`,
  "photo.sending": "Een foto wordt verstuurd.",
  "photo.earlier": "Eerder",
  "photo.later": "Later",
  "photo.remove": "Verwijderen",
  "photo.name": (n) => `Foto ${n}`,
  "photo.notAdded": (why) => `Foto niet toegevoegd: ${why}`,
};
