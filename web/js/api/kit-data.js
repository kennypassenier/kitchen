// Kitchen's transport over the kit's offline data client (`window.chassisData`, chassis-rs feat-offline-1,
// refactor-rev-kit-1) and its local database (`chassisData.db`, v4.5.0, feat-db-pages-1). The kitchen is READ from the
// local database (api/kitchen-read.js); every PUT / PATCH / DELETE goes through the kit's queue, so the kit owns the
// `If-Match` header, the queue, its replay, the failed list and the overlay of waiting edits on the database's records.
// Kitchen only decides WHICH revision a save names (api/save.js `ifMatchFor`: the revision the page READ, which the
// collection's own `put` cannot be told, it names the record's newest) and turns the kit's refusals into ApiErrors in
// the page's language. After a write the service answered, the collection it changed is pulled, so the database holds
// the server's version (the server is the master); a queued write is pulled after its replay by the kit itself.
//
// The freezer take is a POST through the kit (`chassisData.post`, chassis-rs 8042dbe, feat-offline-take-1): queued
// offline and replayed with the same `Idempotency-Key`, so the server takes it once. Creating an item, a draft, an
// import and Undo's restore stay on api/http.js `call` and need a connection (the server issues the ids).
//
// The kit's runtime is a module the server puts into the page AFTER Kitchen's own main.js (chassis-rs injects it before
// `</head>`), so `window.chassisData` exists only once that module ran: the first call waits for it (api/kit-ready.js). A page without the runtime is a broken deployment, not an offline
// case: every call then rejects with an error that says so (no silent fallback around the kit).

import { t } from "../i18n/index.js";
import { ApiError } from "./http.js";
import { failureOf } from "./save.js";
import { isSignedOut } from "./login-link.js";
import { signedOutNotice } from "./signed-out.js";
import { SETTINGS_COLLECTION, SETTINGS_KEY, TAKE_ACTION, collectionOfPath, offlineOptions } from "../offline/config.js";
import { takeLook } from "../offline/assemble.js";
import { applyKeepDefault, deviceStorage } from "../offline/keep.js";
import { kitRuntimeRan } from "./kit-ready.js";

/** The window event a read sends with `{ offline }`, so the connection band can say "offline" (offline/band.js). */
export const READ_EVENT = "kitchen-data-read";

/**
 * The part of `window.chassisData` Kitchen uses (chassis-rs docs/OFFLINE_DESIGN.md).
 * @typedef {object} KitData
 * @property {(options: object) => Promise<unknown>} configure
 * @property {(path: string) => Promise<{ data: any, rev: string | null, offline: boolean, partial?: boolean, savedAt: number | null }>} get
 * @property {(path: string, body: unknown, options?: { rev?: string | number }) => Promise<KitWrite>} put
 * @property {(path: string, body: unknown, options?: { rev?: string | number }) => Promise<KitWrite>} patch
 * @property {(path: string, options?: { rev?: string | number }) => Promise<KitWrite>} delete
 * @property {(path: string, body: unknown, options?: { rev?: string | number }) => Promise<KitWrite>} post
 * @property {() => Promise<KitEntry[]>} queue
 * @property {() => Promise<KitEntry[]>} failed
 * @property {() => Promise<number>} pending
 * @property {(id: number) => Promise<boolean>} drop
 * @property {(id: number, options?: { rev?: string }) => Promise<boolean>} resave
 * @property {() => Promise<unknown>} retry
 * @property {() => Promise<{ all: boolean, items: string[] }>} settings
 * @property {(on: boolean) => Promise<boolean>} keepAll
 * @property {(path: string, on: boolean) => Promise<boolean>} keepItem
 * @property {(path: string) => Promise<boolean>} isKept
 * @property {() => Promise<{ used: number, max: number, level: string }>} usage
 * @property {() => Promise<void>} clearCopy
 * @property {KitDb} db the local database (feat-db-pages-1)
 */
/**
 * The part of `chassisData.db` Kitchen uses (chassis-rs docs/LOCAL_DB_DESIGN.md "Client contract, as built"; `clear`,
 * `action` and `act` since 4.6.0).
 * `sync` answers one summary per collection (`stopped`: null, "unreachable", "auth", "full", "error…").
 * @typedef {object} KitDb
 * @property {(name: string) => KitCollection} collection
 * @property {(names?: string[] | null) => Promise<Array<{ pages: number, removed: number, stopped: string | null }>>} sync
 * @property {() => Promise<{ collections: string[], waiting: number }>} clear empties the stores; queue and keep choices stay
 */
/**
 * @typedef {object} KitCollection
 * @property {(key: string) => Promise<Record<string, any> | null>} get
 * @property {() => Promise<Array<Record<string, any>>>} all
 * @property {(key: string, on?: boolean) => Promise<boolean>} keep
 * @property {(key: string) => Promise<boolean>} isKept
 * @property {() => Promise<unknown>} sync
 * @property {() => Promise<{ partial: boolean, stale: boolean, lastPull: number | null, bytes: number }>} status
 * @property {(name: string, look: (record: Record<string, any>, body: any) => Record<string, any> | null) => KitCollection} action
 * @property {(key: string, name: string, body?: unknown) => Promise<KitWrite>} act
 * @property {(fn: (e: { collection: string, reason: string }) => void) => () => void} watch
 */
/** @typedef {{ ok: boolean, queued: boolean, status: number, data: any, rev: string | null }} KitWrite */
/**
 * One edit in the kit's queue. `state` is "queued" (waits), "held" (blocks the rest) or "failed" (refused on replay,
 * kept for the person to drop or save again); `conflict` is the server's refusal.
 * @typedef {{ id: number, method: string, path: string, body?: any, ifMatch: string | null, at: number, state: string, conflict?: { status: number, body: any } }} KitEntry
 */

/** @type {Promise<KitData> | null} */
let ready = null;

/** Configure the kit once and hand it out. @returns {Promise<KitData>} */
async function configureOnce() {
  await kitRuntimeRan(window, document);
  const kit = /** @type {KitData | undefined} */ (/** @type {any} */ (window).chassisData);
  if (!kit) {
    throw new Error(
      "Kitchen: the kit's data client (window.chassisData) is not on this page. The server must serve the web app with the chassis-rs runtime (WebApp without without_kit_runtime).",
    );
  }
  await kit.configure(offlineOptions(t));
  // Before the first read, so the very first kitchen answer on a new device is already kept (Kenny: default on).
  await applyKeepDefault(kit, deviceStorage());
  // The freezer take is the freezer's item action (chassis-rs 4.7.0 has it on the lazy facade too): its look shows while
  // the take waits offline.
  kit.db.collection("freezer").action(TAKE_ACTION, takeLook);
  // The settings are always kept (DB_MOVE choice C1): a recipe kept on its own then has its timer sound offline too.
  // Not awaited: offline on a new device the kit cannot fetch it yet, says so, and the next pull brings it.
  void kit.db.collection(SETTINGS_COLLECTION).keep(SETTINGS_KEY, true).catch((e) => console.warn("Kitchen: the settings could not be kept offline on this device", e));
  return kit;
}

/** The configured kit client; the first call configures it. @returns {Promise<KitData>} */
export function kitData() {
  if (!ready) {
    ready = configureOnce();
    // Said once in the console with its cause; every caller still gets the rejection and shows its failed state.
    ready.catch((e) => console.error("Kitchen: the offline data client could not start", e));
  }
  return ready;
}

/**
 * A kit refusal as an ApiError in the page's language. The kit's errors carry `status` and `body` (the server's JSON):
 * 401 raises the sign-in notice, a read with neither a connection nor an offline copy says so, a size refusal or a
 * stale save gets Kitchen's words (api/save.js `failureOf`), any other the server's own. An error without a status is a
 * programming error in the call (a bad path) and is passed on as it is.
 * @param {unknown} err @returns {Error}
 */
export function toApiError(err) {
  if (err instanceof ApiError || !(err instanceof Error)) return err instanceof Error ? err : new Error(String(err));
  const { status, body, offline } = /** @type {{ status?: unknown, body?: unknown, offline?: unknown }} */ (err);
  if (typeof status !== "number") return err;
  if (isSignedOut(status)) {
    signedOutNotice();
    return new ApiError(t("api.signedOut"), 401);
  }
  if (status === 0) return new ApiError(t(offline ? "api.offlineNoCopy" : "api.dropped"), 0, null, "offline");
  const { words, limit, code } = failureOf(status, body ?? null, t);
  return new ApiError(words, status, limit, code);
}

/** Tell the connection band whether a read reached the kitchen (offline/band.js). @param {boolean} offline */
export const sayRead = (offline) => dispatchEvent(new CustomEvent(READ_EVENT, { detail: { offline } }));

/**
 * GET through the kit, straight from the service: no route is copied any more (the local database is the one offline
 * layer), so without a connection this is an ApiError of status 0. Used for the wheel lists, the drafts and the whole
 * kitchen while "keep everything" is off.
 * @param {string} path @returns {Promise<{ data: any }>}
 */
export async function readJson(path) {
  const kit = await kitData();
  try {
    const got = await kit.get(path);
    sayRead(false);
    return { data: got.data };
  } catch (e) {
    const err = toApiError(e);
    if (err instanceof ApiError && err.status === 0) sayRead(true);
    throw err;
  }
}

/** The kit's queue: edits waiting to be sent, held, or refused on replay (failed), oldest first. @returns {Promise<KitEntry[]>} */
export async function queuedEdits() {
  return (await kitData()).queue();
}

/**
 * PUT / PATCH / DELETE / POST through the kit (POST: only the freezer take, which the server applies once per key). `rev` is the revision the page read (sent as `If-Match`; a PUT, a
 * DELETE and the settings PATCH name one since fix-offline-master-5); left out, the kit sends the revision of its own copy
 * of the path, if any. Resolves to the server's answer with its new revision (the kit reads the body's `rev`, else the
 * `ETag`), or `queued: true` (no data, no revision) when the edit waits in the kit's queue to be sent once the service
 * answers again.
 * @param {"PUT" | "PATCH" | "DELETE" | "POST"} method @param {string} path @param {unknown} [body] @param {number} [rev]
 * @returns {Promise<{ data: any, queued: boolean, rev: string | null }>}
 */
export async function writeJson(method, path, body, rev) {
  const kit = await kitData();
  const options = typeof rev === "number" ? { rev } : {};
  try {
    const done = await send(kit, method, path, body, options);
    if (!done.queued) pullAfterWrite(kit, path);
    return { data: done.data, queued: done.queued, rev: done.rev ?? null };
  } catch (e) {
    throw toApiError(e);
  }
}

/**
 * Pull the collection a sent write changed, so the local database holds the server's answer. Not awaited: the page
 * already has the answer; a failed pull is the kit's to report and the next trigger pulls again.
 * @param {KitData} kit @param {string} path
 */
function pullAfterWrite(kit, path) {
  const name = collectionOfPath(path);
  if (name) void kit.db.sync([name]).catch((e) => console.warn(`Kitchen: pulling ${name} after a save failed; the next pull brings it.`, e));
}

/**
 * The kit's call for `method`. @param {KitData} kit @param {"PUT" | "PATCH" | "DELETE" | "POST"} method @param {string} path
 * @param {unknown} body @param {{ rev?: number }} options @returns {Promise<KitWrite>}
 */
function send(kit, method, path, body, options) {
  if (method === "DELETE") return kit.delete(path, options);
  if (method === "PATCH") return kit.patch(path, body, options);
  if (method === "POST") return kit.post(path, body, options);
  return kit.put(path, body, options);
}
