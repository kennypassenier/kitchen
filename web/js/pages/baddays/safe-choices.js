// The list "Add a safe dish" offers: the recipes that are not a safe dish yet. Pure, so a node test reads it.

/** @typedef {{ id: string, name: string, safe?: boolean, minutes?: number, gear?: string }} Choice */

/**
 * The recipes not yet safe, by name (the list never reorders under the pointer).
 * @template {Choice} R
 * @param {{ recipes: R[] }} k
 * @returns {R[]}
 */
export const notSafeRecipes = (k) => k.recipes.filter((r) => r.safe !== true).sort((a, b) => String(a.name).localeCompare(String(b.name), "en"));

/** The one-line hint under a choice: how long it takes and what it needs. @param {Choice} r */
export const choiceHint = (r) => [r.minutes ? `${r.minutes} min` : "", r.gear ?? ""].filter(Boolean).join(", ");
