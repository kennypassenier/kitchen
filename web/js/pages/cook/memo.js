// What the page keeps per recipe in sessionStorage, because the package does not cover it: the running timers, whether Begin
// was pressed, when each step really started and ended, and whether the last step was done and the dinner logged. The place in
// the recipe itself is the package's (data-kp-remember), but the package forgets it once the flow is done, so a reload after the
// last step would open on step 1 with no dinner card; the finished state is kept here until cooking starts fresh
// [fix-cook-finished-1].

/** @typedef {{ started?: boolean, finished?: boolean, logged?: boolean, timers?: any[], marks?: Record<string, { start?: number, end?: number }> }} Memo */

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

/** The last step was done. @param {Memo} memo */
export const markFinished = (memo) => void (memo.finished = true);

/** Tonight's dinner was logged from this cook. @param {Memo} memo */
export const markLogged = (memo) => void (memo.logged = true);

/** Where the steps open: on the last one once finished (the package has forgotten the place), else 0 (the package's own
 * remembered place). @param {Memo} memo @param {number} count the steps shown */
export const startAt = (memo, count) => (memo.finished && count > 0 ? count - 1 : 0);
