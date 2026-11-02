// Kitchen's transport over the kit's offline data client (`window.chassisData`, chassis-rs feat-offline-1,
// refactor-rev-kit-1). Every GET and every PUT / PATCH / DELETE of the kitchen's JSON goes through the kit, so the kit
// owns the `If-Match` header, the offline copy, the write queue and its replay; Kitchen only decides WHICH revision a
// save names (api/save.js `ifMatchFor`) and turns the kit's refusals into ApiErrors in the page's language.
//
// The kit has no POST: creating an item, a draft, an import, a freezer take and Undo's restore stay on api/http.js
// `call` and need a connection (the server issues the ids).
//
// The kit's runtime is a module the server puts into the page AFTER Kitchen's own main.js (chassis-rs injects it before
// `</head>`), so `window.chassisData` exists only once every deferred module ran: the first call waits for
// DOMContentLoaded, which fires after all of them. A page without the runtime is a broken deployment, not an offline
// case: every call then rejects with an error that says so (no silent fallback around the kit).

import { t } from "../i18n/index.js";
import { ApiError } from "./http.js";
import { failureOf } from "./save.js";
import { isSignedOut } from "./login-link.js";
import { signedOutNotice } from "./signed-out.js";
import { offlineOptions } from "../offline/config.js";
import { applyKeepDefault, deviceStorage } from "../offline/keep.js";

/** The window event a read sends with `{ offline }`, so the connection band can say "offline" (offline/band.js). */
export const READ_EVENT = "kitchen-data-read";

/**
 * The part of `window.chassisData` Kitchen uses (chassis-rs docs/OFFLINE_DESIGN.md).
 * @typedef {object} KitData
 * @property {(options: object) => Promise<unknown>} configure
 * @property {(path: string) => Promise<{ data: any, rev: string | null, offline: boolean, savedAt: number | null }>} get
 * @property {(path: string, body: unknown, options?: { rev?: string | number }) => Promise<KitWrite>} put
 * @property {(path: string, body: unknown, options?: { rev?: string | number }) => Promise<KitWrite>} patch
 * @property {(path: string, options?: { rev?: string | number }) => Promise<KitWrite>} delete
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
 */
/** @typedef {{ ok: boolean, queued: boolean, status: number, data: any, rev: string | null }} KitWrite */
/**
 * One edit in the kit's queue. `state` is "queued" (waits), "held" (blocks the rest) or "failed" (refused on replay,
 * kept for the person to drop or save again); `conflict` is the server's refusal.
 * @typedef {{ id: number, method: string, path: string, body?: any, ifMatch: string | null, at: number, state: string, conflict?: { status: number, body: any } }} KitEntry
 */

/** @type {Promise<KitData> | null} */
let ready = null;

/** Resolves once every deferred module of the page ran (the kit's runtime among them). @param {Document} doc */
function modulesRan(doc) {
  if (doc.readyState !== "loading") return Promise.resolve();
  return new Promise((resolve) => doc.addEventListener("DOMContentLoaded", () => resolve(undefined), { once: true }));
}

/** Configure the kit once and hand it out. @returns {Promise<KitData>} */
async function configureOnce() {
  await modulesRan(document);
  const kit = /** @type {KitData | undefined} */ (/** @type {any} */ (window).chassisData);
  if (!kit) {
    throw new Error(
      "Kitchen: the kit's data client (window.chassisData) is not on this page. The server must serve the web app with the chassis-rs runtime (WebApp without without_kit_runtime).",
    );
  }
  await kit.configure(offlineOptions(t));
  // Before the first read, so the very first kitchen answer on a new device is already kept (Kenny: default on).
  await applyKeepDefault(kit, deviceStorage());
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

/**
 * GET through the kit: the service's answer, or the offline copy when the service cannot be reached.
 * @param {string} path @returns {Promise<{ data: any, offline: boolean, savedAt: number | null }>}
 */
export async function readJson(path) {
  const kit = await kitData();
  try {
    const got = await kit.get(path);
    dispatchEvent(new CustomEvent(READ_EVENT, { detail: { offline: got.offline } }));
    return { data: got.data, offline: got.offline, savedAt: got.savedAt };
  } catch (e) {
    const err = toApiError(e);
    if (err instanceof ApiError && err.status === 0) dispatchEvent(new CustomEvent(READ_EVENT, { detail: { offline: true } }));
    throw err;
  }
}

/** The kit's queue: edits waiting to be sent, held, or refused on replay (failed), oldest first. @returns {Promise<KitEntry[]>} */
export async function queuedEdits() {
  return (await kitData()).queue();
}

/**
 * PUT / PATCH / DELETE through the kit. `rev` is the revision the page read (sent as `If-Match`); leave it out for a
 * write that is not checked (settings, a delete). Resolves to the server's answer, or `queued: true` (and no data) when
 * the edit waits in the kit's queue to be sent once the service answers again.
 * @param {"PUT" | "PATCH" | "DELETE"} method @param {string} path @param {unknown} [body] @param {number} [rev]
 * @returns {Promise<{ data: any, queued: boolean }>}
 */
export async function writeJson(method, path, body, rev) {
  const kit = await kitData();
  const options = typeof rev === "number" ? { rev } : {};
  try {
    const done = method === "DELETE" ? await kit.delete(path, options) : method === "PATCH" ? await kit.patch(path, body, options) : await kit.put(path, body, options);
    return { data: done.data, queued: done.queued };
  } catch (e) {
    throw toApiError(e);
  }
}
