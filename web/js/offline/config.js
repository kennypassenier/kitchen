// What Kitchen hands the kit's offline data client (`chassisData.configure`, chassis-rs feat-offline-1). Config only:
// no fetch, no DOM. docs/agent/DATA.md "Offline copy" says what each value means for the kitchen's data.

/** The IndexedDB database the kit keeps the copy and the queue in: `chassis-data:kitchen`. */
export const OFFLINE_NAME = "kitchen";

/** The field of an item that carries its revision (docs/agent/DATA.md "Revisions and stale saves"). */
export const REV_FIELD = "rev";

/** The whole kitchen in one answer: every screen reads it (web/js/api.js `loadKitchen`). */
export const KITCHEN_PATH = "/data/kitchen";

/**
 * The GET answers the kit may keep a copy of. Only the whole kitchen: every screen draws from it, so one copy serves
 * every page offline. A route without `:id` is a list route to the kit.
 */
export const OFFLINE_ROUTES = Object.freeze([KITCHEN_PATH]);

/**
 * The options for `chassisData.configure`.
 * @param {(key: string, ...args: any[]) => string} _t the page's words (used from feat-offline-kitchen on)
 */
export function offlineOptions(_t) {
  return { name: OFFLINE_NAME, rev: REV_FIELD, routes: [...OFFLINE_ROUTES] };
}
