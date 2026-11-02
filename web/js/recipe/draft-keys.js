// The keys the recipe editor's drafts are kept under (fix-draft-key-1, 02/11/2026). Pure; tested by
// scripts/draft-keys.test.mjs.
//
// A saved recipe's draft is kept under the recipe's id, a blank new recipe's under `new:<dish id>`. An import and a copy
// used that same `new:<dish id>`, so opening one silently wrote over a draft that was kept for a blank new recipe in that
// dish (and the other way round). Each import and each copy now has a key of its own, made once when it starts and
// carried in the editor's address (`&draft=`), so a reload, even in another tab, finds its draft again:
//
//   <recipe id>                       a saved recipe
//   new:<dish id>                     a blank new recipe (`new:` with no dish)
//   import:<dish id>:<uuid>           an import (`import::<uuid>` with no dish)
//   copy:<source recipe id>:<uuid>    a copy of a recipe
//
// The server keeps one draft per key, prunes every draft after DRAFT_DAYS whatever its key, and Save and Discard delete
// the draft by its key, so the new kinds need nothing there.

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** An import's or a copy's key, as the address may carry it: nothing in it that could reach outside the key. */
const OWN = new RegExp(`^(import|copy):[A-Za-z0-9_-]*:${UUID}$`);

/** @param {string | null | undefined} dishId */
export const newKey = (dishId) => `new:${dishId ?? ""}`;

/** @param {string | null | undefined} dishId @param {string} uuid */
export const importKey = (dishId, uuid) => `import:${dishId ?? ""}:${uuid}`;

/** @param {string} sourceId @param {string} uuid */
export const copyKey = (sourceId, uuid) => `copy:${sourceId}:${uuid}`;

/** An import's or a copy's key read from an address, or null when it is not one. @param {string | null | undefined} key */
export const ownKey = (key) => (typeof key === "string" && OWN.test(key) ? key : null);

/** What a key belongs to. @param {string} key @returns {"new" | "import" | "copy" | "recipe"} */
export function keyKind(key) {
  const head = key.split(":")[0];
  return head === "new" || head === "import" || head === "copy" ? head : "recipe";
}

/** @typedef {{ key: string, data?: Record<string, any>, saved?: string }} Draft */

/**
 * The draft a blank new recipe in `dishId` offers to restore: its own (`new:<dish id>`) first; else the newest one an
 * import or a copy left in that dish (the dish its form names) after its tab closed, so that work can still be found
 * from the dish.
 * @param {Draft[]} drafts @param {string | null | undefined} dishId @returns {Draft | null}
 */
export function offeredForNew(drafts, dishId) {
  const own = newKey(dishId);
  const dish = dishId ?? null;
  const all = drafts.filter((d) => typeof d?.key === "string");
  const mine = all.find((d) => d.key === own);
  if (mine) return mine;
  const found = all.filter((d) => (keyKind(d.key) === "import" || keyKind(d.key) === "copy") && (d.data?.dish_id ?? null) === dish);
  found.sort((a, b) => String(b.saved ?? "").localeCompare(String(a.saved ?? "")));
  return found[0] ?? null;
}

/**
 * The draft an editor offers: for a blank new recipe see `offeredForNew`; for anything else, the one under its own key.
 * @param {Draft[]} drafts @param {string} key @param {string | null | undefined} dishId
 */
export const offeredFor = (drafts, key, dishId) => (keyKind(key) === "new" ? offeredForNew(drafts, dishId) : (drafts.find((d) => d?.key === key) ?? null));
