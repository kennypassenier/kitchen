// What Kitchen hands the kit's offline data client (`chassisData.configure`, chassis-rs feat-offline-1) and its local
// database (`chassisData.db`, v4.5.0). Config only: no fetch, no DOM. docs/agent/DATA.md "Offline copy" says what each
// value means for the kitchen's data.

/** The app name to the kit: the queue lives in `chassis-data:kitchen`, the local database in `chassis-db:kitchen`. */
export const OFFLINE_NAME = "kitchen";

/** The field of an item that carries its revision (docs/agent/DATA.md "Revisions and stale saves"). */
export const REV_FIELD = "rev";

/**
 * The lists of the kitchen, each a collection of the kit's local database (`chassisData.db`, chassis-rs v4.5.0,
 * feat-db-pages-1) of the same name, keyed by `id` with revision `rev` (src/store/db/sync.rs). A dish carries its
 * recipes, so the dish is the synced unit.
 */
export const LISTS = Object.freeze(["dishes", "dish_categories", "ingredients", "ingredient_categories", "freezer", "shelf", "log", "resting", "drafts", "recipe_sources"]);

/** The settings' collection and its one item (`{id: "kitchen", rev: settings_rev, ..keys}`). */
export const SETTINGS_COLLECTION = "settings";
export const SETTINGS_KEY = "kitchen";

/** The settings item's route: PATCH merges, `null` removes a key, `If-Match` = its `rev`. */
export const SETTINGS_PATH = `/data/settings/${SETTINGS_KEY}`;

/** The whole kitchen in one answer, read straight from the service (never copied) while "keep everything" is off. */
export const KITCHEN_PATH = "/data/kitchen";

/** The item route of `id` in `list`, as the routes and the kit's collections name it. @param {string} list @param {string} id */
export const itemPath = (list, id) => `/data/${list}/${encodeURIComponent(id)}`;

/** The freezer's item action: `collection("freezer").act(id, TAKE_ACTION, { portions })` POSTs to
 * `/data/freezer/{id}/take` with an Idempotency-Key; the server applies a replay once and ignores If-Match. */
export const TAKE_ACTION = "take";

/** The freezer take route of item `id`, as the kit queues it. @param {string} id */
export const takePath = (id) => `${itemPath("freezer", id)}/${TAKE_ACTION}`;

/** The collection a write path changes (`/data/<list>/…`, the settings item, a take), or null. @param {string} path */
export function collectionOfPath(path) {
  const m = /^\/data\/([a-z_]+)\//.exec(path);
  if (!m) return null;
  return LISTS.includes(m[1]) || m[1] === SETTINGS_COLLECTION ? m[1] : null;
}

/**
 * The words of the kit's failed-edits drawer, under the kit's own `FAILED_MESSAGES` keys.
 * @param {(key: string, ...args: any[]) => string} t
 */
function failedMessages(t) {
  return {
    title: t("off.kitFailedTitle"),
    intro: t("off.kitFailedIntro"),
    close: t("off.kitFailedClose"),
    discard: t("off.kitDiscard"),
    saveAgain: t("off.kitSaveAgain"),
    discardAll: t("off.kitDiscardAll"),
    emptyTitle: t("off.kitEmptyTitle"),
    emptyBody: t("off.kitEmptyBody"),
    when: t("off.kitWhen"),
    why: t("off.kitWhy"),
    state: t("off.kitState"),
    stateFailed: t("off.kitStateFailed"),
    stateHeld: t("off.kitStateHeld"),
    reasonStale: t("off.kitReasonStale"),
    reasonOther: t("off.kitReasonOther"),
    verbs: { POST: t("off.kitVerbAdd"), PUT: t("off.kitVerbChange"), PATCH: t("off.kitVerbChange"), DELETE: t("off.kitVerbDelete") },
    confirmTitle: (/** @type {number} */ n) => t("off.kitConfirmTitle", n),
    confirmBody: t("off.kitConfirmBody"),
    confirmAccept: t("off.kitConfirmAccept"),
    confirmCancel: t("off.kitConfirmCancel"),
    count: (/** @type {number} */ n) => t("off.kitCount", n),
  };
}

/**
 * The kit's own words (its connection-band toasts, its logout confirmation and its failed-edits drawer) in the page's
 * language. Getters, so the logout dialog, which reads them each time it opens, follows a language change. The band's
 * words are redrawn by the kit on `kp-strings-change` (chassis-rs 073273f); the drawer (kit `FAILED_MESSAGES` keys)
 * reads them when the kit starts, so it keeps the language the page started in until the next load.
 * @param {(key: string, ...args: any[]) => string} t
 */
export function kitMessages(t) {
  return {
    get conflict() { return t("off.kitConflict"); },
    get conflictHeld() { return t("off.kitConflictHeld"); },
    get review() { return t("off.kitReview"); },
    nearCap: (/** @type {number} */ pct) => t("off.kitNearCap", pct),
    get full() { return t("off.kitFull"); },
    get refused() { return t("off.kitRefused"); },
    get expired() { return t("off.kitExpired"); },
    get title() { return t("off.logoutTitle"); },
    body: (/** @type {number} */ n) => t("off.logoutBody", n),
    get accept() { return t("off.logoutAccept"); },
    get stay() { return t("off.logoutStay"); },
    ...failedMessages(t),
  };
}

/**
 * The options for `chassisData.configure`: the kit's local database (`db: true`: manifest `/api/sync`, a pull at start,
 * on reconnect, focus, hints and every 5 minutes) and no response-cache routes, so the database is the one offline
 * layer (feat-db-pages-1). The size cap, its warning level and the retry timer are the kit's defaults (50 MB, 80 %,
 * 30 s): the whole kitchen is far below the cap, and the kit's numbers are documented in one place.
 * @param {(key: string, ...args: any[]) => string} t the page's words
 */
export function offlineOptions(t) {
  return { name: OFFLINE_NAME, rev: REV_FIELD, routes: [], db: true, messages: kitMessages(t) };
}
