// The freezer form starts with "From the dish": a dish picked fills both names from it (Kenny, 01/11/2026 20:21, "Uit
// gerecht"); typed names still need both languages. Pure, so a node test reads it.

/** @typedef {{ nl: string, en: string }} Names */

/** A dish's names, each half as a string. @param {{ name?: { nl?: unknown, en?: unknown } } | null | undefined} dish @returns {Names} */
export const namesOf = (dish) => ({ nl: String(dish?.name?.nl ?? ""), en: String(dish?.name?.en ?? "") });

/**
 * The two name fields after the pick changed. A dish always fills both; "another dish" empties them only when they still
 * hold what the last dish filled in, so names someone typed are never thrown away.
 * @param {{ dish: Parameters<typeof namesOf>[0], filled: Names | null, current: Names }} o
 * @returns {{ names: Names, filled: Names | null }}
 */
export function afterPick({ dish, filled, current }) {
  if (dish) {
    const names = namesOf(dish);
    return { names, filled: names };
  }
  const untouched = filled !== null && filled.nl === current.nl && filled.en === current.en;
  return { names: untouched ? { nl: "", en: "" } : current, filled: null };
}
