// What every list of names shares: the two halves of a name, the one to show, which wheels a dish is on, the list order.

import { nameOf } from "../i18n/index.js";

/** @typedef {Record<string, any>} Item */

/** Both names of an item, trimmed. @param {Item | null | undefined} item */
export const names = (item) => ({ nl: String(item?.name?.nl ?? "").trim(), en: String(item?.name?.en ?? "").trim() });
/** The name to show in Kitchen: in the language it is shown in, else the other half. @param {Item | null | undefined} item */
export const label = (item) => nameOf(item).text;
/** Which wheels a dish's names put it on: "both", "nl", "en" or "none". @param {Item} dish */
export function languages(dish) {
  const n = names(dish);
  return n.nl && n.en ? "both" : n.nl ? "nl" : n.en ? "en" : "none";
}
/** Items in their list order. @param {Item[]} list */
export const ordered = (list) => [...list].sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9));
