// A recipe kept offline whose dish is gone from the kitchen (feat-offline-gone, Kenny 02/11/2026 19:43, "Uit kopie
// halen"). Pure decisions only: no fetch, no DOM, no kit, so scripts/offline-gone.test.mjs tests them. The kit side
// (api/recipe-gone.js) asks the kit, acts on the answers below and shows the notice.
//
// The rule: only a real 404 from the server for the kept dish's item route (`GET /data/dishes/{id}`) means the dish is
// gone. No connection (the kit's status 0, `offline: true`) says nothing about the dish, so its copy and mark stay;
// any other refusal (500, 403 ...) is not "gone" either: the copy stays and the failure is reported.

/** The status the kitchen answers for a dish that no longer exists. */
export const GONE_STATUS = 404;

/** @typedef {"gone" | "offline" | "error"} ReadOutcome what a failed read of a kept dish means */

/**
 * What a failed `kit.get(dishPath)` means. The kit's errors carry `status` (0 with `offline: true` when the service
 * cannot be reached and there is no copy to fall back on) and `body`. Anything without a numeric status is a programming
 * error in the call, never "gone": it is "error" so the caller reports it.
 * @param {unknown} err @returns {ReadOutcome}
 */
export function classifyDishRead(err) {
  const { status, offline } = /** @type {{ status?: unknown, offline?: unknown }} */ (err ?? {});
  if (status === GONE_STATUS) return "gone";
  if (status === 0 || offline === true) return "offline";
  return "error";
}

/**
 * The kept dishes the kitchen's own list no longer shows: the only ones worth asking the server about, so a normal
 * read costs no extra request. The list is a hint; the dish's own 404 is the proof.
 * @param {readonly string[]} keptIds from `keptDishIds` @param {readonly Record<string, any>[]} serverDishes the dishes
 * the kitchen just answered with @returns {string[]}
 */
export function missingKeptDishIds(keptIds, serverDishes) {
  const present = new Set(serverDishes.map((d) => d?.id));
  return keptIds.filter((id) => !present.has(id));
}

/**
 * Remembers which dishes already got the notice, so a dish is announced once even when several reads overlap.
 * @returns {{ claim: (dishId: string) => boolean }} `claim` is true the first time for a dish, false after
 */
export function createNoticeOnce() {
  const told = new Set();
  return {
    claim(dishId) {
      if (told.has(dishId)) return false;
      told.add(dishId);
      return true;
    },
  };
}
