// What the page keeps per recipe in sessionStorage, because the package does not cover it: the running timers, whether Begin
// was pressed and when each step really started and ended. The place in the recipe itself is the package's (data-kp-remember).

/** @typedef {{ started?: boolean, timers?: any[], marks?: Record<string, { start?: number, end?: number }> }} Memo */

/** The key of one recipe's memory; the mini version has its own. @param {string} recipeId @param {boolean} mini */
export const storeKeyOf = (recipeId, mini) => `kitchen:cook:${recipeId}:${mini ? "mini" : "full"}`;

/**
 * Read the memory (forgotten first when cooking starts fresh) and give back it and the function that writes it.
 * @param {string} storeKey @param {boolean} fresh @returns {{ memo: Memo, keep: () => void }}
 */
export function openMemo(storeKey, fresh) {
  /** @type {Memo} */
  let memo = {};
  try {
    if (fresh) sessionStorage.removeItem(storeKey);
    memo = JSON.parse(sessionStorage.getItem(storeKey) ?? "{}") ?? {};
  } catch {
    memo = {};
  }
  const keep = () => {
    try {
      sessionStorage.setItem(storeKey, JSON.stringify(memo));
    } catch {
      /* no storage: the place is lost on reload, nothing else */
    }
  };
  return { memo, keep };
}
