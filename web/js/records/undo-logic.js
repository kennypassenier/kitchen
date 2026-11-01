// The pure side of "delete at once, Undo for 10 s" (Kenny, 01/11/2026 20:21): how a recipe goes back into its dish and
// where an item stood. A category's place is order.js. No DOM, no network, so scripts/records.test.mjs runs it in node.

/** @typedef {Record<string, any>} Item */

/**
 * A dish's recipes after its recipe `back` returns at place `at`. A recipe that was the default is the default again,
 * so the one that stood in for it gives the mark back; one that was not leaves the default where it is.
 * @param {Item[]} recipes the dish's recipes now @param {Item} back the recipe as it was @param {number} at its old place
 * @returns {Item[]}
 */
export function recipeBack(recipes, back, at) {
  if (recipes.some((r) => r.id === back.id)) return recipes;
  const list = back.default === true ? recipes.map((r) => (r.default === true ? { ...r, default: false } : r)) : [...recipes];
  list.splice(Math.min(Math.max(0, at), list.length), 0, back);
  return list;
}

/**
 * Where an item stands in its list, for putting it back at that place (-1 when absent).
 * @param {Item[]} list @param {string} id
 */
export const placeOf = (list, id) => list.findIndex((x) => x.id === id);
