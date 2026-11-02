// The order of a category list (Kenny, 01/11/2026 20:21, "In de tabel"): categories are dragged into place in their
// table, and a list always reads 1, 2, 3, … without a gap or a tie, after a drag, a delete and an Undo. Pure, so
// scripts/records.test.mjs runs it in node.

/** @typedef {Record<string, any>} Item */

/** Items in their list order; an item without `order` sorts last, ties keep the list's own order. @param {Item[]} items */
export const byOrder = (items) => [...items].sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9));

/** The items whose `order` must change so `list` reads 1, 2, 3, … as it stands. @param {Item[]} list @returns {Item[]} */
function renumbered(list) {
  return list.flatMap((x, i) => (x.order === i + 1 ? [] : [{ ...x, order: i + 1 }]));
}

/**
 * After a category went: the others close up to 1, 2, 3, … without a gap.
 * @param {Item[]} items the categories still there
 * @returns {Item[]} the ones to save with their new `order`
 */
export const closeUp = (items) => renumbered(byOrder(items));

/**
 * After a category came back: it takes its place again and the ones from there move one down. The place is where the
 * table showed it when it went (`shownAt`, 0-based); without it, its old `order`. The two differ when the numbers had
 * gaps (orders typed by hand before 01/11/2026, or a category without one), where the old number would put it elsewhere.
 * @param {Item[]} items the categories, the restored one included or not
 * @param {Item} back the restored category
 * @param {number} [shownAt] where it stood in the table, -1 or absent when unknown
 * @returns {Item[]} the ones to save with their new `order`
 */
export function makeRoom(items, back, shownAt = -1) {
  const rest = byOrder(items.filter((x) => x.id !== back.id));
  const wanted = shownAt >= 0 ? shownAt : Number(back.order ?? rest.length + 1) - 1;
  const at = Math.min(Math.max(0, wanted), rest.length);
  rest.splice(at, 0, back);
  return renumbered(rest);
}

/**
 * After a drag: the order the table shows now, as row keys, read back into `order` 1, 2, 3, ….
 * @param {Item[]} items the categories @param {string[]} keys their ids in the new order
 * @returns {Item[]} the ones to save with their new `order`
 */
export function reordered(items, keys) {
  const known = new Map(items.map((x) => [x.id, x]));
  const listed = keys.flatMap((k) => (known.has(k) ? [/** @type {Item} */ (known.get(k))] : []));
  const left = byOrder(items.filter((x) => !keys.includes(x.id)));
  return renumbered([...listed, ...left]);
}

/** The `order` a new category gets: after the last one. @param {Item[]} items */
export const nextOrder = (items) => items.reduce((m, x) => Math.max(m, Number(x.order) || 0), 0) + 1;
