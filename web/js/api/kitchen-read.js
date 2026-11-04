// Reading the whole kitchen from the kit's local database (feat-db-pages-1, Kenny 03/11/2026 06:12 "Nu ook de
// pagina's"): each list is a collection (`chassisData.db.collection(name)`), the settings one item, and the page builds
// the same kitchen object the screens read today (offline/assemble.js). The server is the master: a read first pulls
// every collection's changes (the kit applies the server's upserts and deletes), and the kit lays the edits still
// waiting in its queue over its records itself; refused edits (its failed list) are not laid over.
//
// "Alles offline bewaren" (keep everything) off: the database holds only what this device keeps (recipes kept one by
// one, the names they use, the settings), so with a connection the whole kitchen is read from the service
// (`GET /data/kitchen`, never copied) with the waiting edits of the kept items laid over it; without one the kept
// items are the kitchen, marked `partial`. One offline layer either way: the kit's database and its queue.

import { t } from "../i18n/index.js";
import { LISTS, SETTINGS_COLLECTION, SETTINGS_KEY } from "../offline/config.js";
import { assemble, overServer } from "../offline/assemble.js";
import { ApiError } from "./http.js";
import { kitData, readJson, sayRead, toApiError } from "./kit-data.js";
import { fillKeptGaps } from "./recipe-keep.js";
import { readKitchenOrParts } from "./snapshot-parts.js";

/** @typedef {import("../api.js").Kitchen} Kitchen */
/** @typedef {import("./kit-data.js").KitData} KitData */
/** @typedef {{ lists: Record<string, Array<Record<string, any>>>, settings: Record<string, any> | null, queue: any[] }} LocalState */

/** Without a connection and nothing synced on this device yet: the same words as before the move. */
const noCopy = () => new ApiError(t("api.offlineNoCopy"), 0, null, "offline");

/**
 * Pull every collection; answers whether the service could not be reached. A database that cannot open at all
 * (offline on a device that never synced) is "no copy"; a 401 raises the sign-in notice through `toApiError`.
 * @param {KitData} kit @returns {Promise<boolean>}
 */
async function pullAll(kit) {
  let summaries;
  try {
    summaries = await kit.db.sync(null);
  } catch (e) {
    const err = toApiError(e);
    if (err instanceof ApiError) throw err;
    console.warn("Kitchen: the local database could not start; reading the kitchen needs a connection first.", e);
    throw noCopy();
  }
  if (summaries.some((s) => s.stopped === "auth")) throw toApiError(Object.assign(new Error("signed out"), { status: 401 }));
  return summaries.some((s) => s.stopped === "unreachable");
}

/** Every collection's rows (waiting edits laid over by the kit), the settings item and the queue. @param {KitData} kit @returns {Promise<LocalState>} */
async function localState(kit) {
  const rows = await Promise.all(LISTS.map((name) => kit.db.collection(name).all()));
  const [settings, queue] = await Promise.all([kit.db.collection(SETTINGS_COLLECTION).get(SETTINGS_KEY), kit.queue()]);
  return { lists: Object.fromEntries(LISTS.map((name, i) => [name, rows[i]])), settings, queue };
}

/**
 * "Keep everything" off: the service's kitchen with the kept items' waiting edits, or, without a connection, the kept
 * items alone (`partial`). Nothing kept and no connection: "no copy", as before.
 * @param {KitData} kit @param {LocalState} local @returns {Promise<{ kitchen: Kitchen, offline: boolean }>}
 */
async function keptOrServer(kit, local) {
  try {
    const { data } = await readKitchenOrParts(readJson);
    void fillKeptGaps(kit, data.dishes ?? [], local.lists).catch((e) => console.warn("Kitchen: bringing the kept recipes in line with the kitchen failed", e));
    return { kitchen: overServer(data, local.lists, local.settings, local.queue), offline: false };
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 0) throw e;
    if (!local.lists.dishes.length) throw e;
    return { kitchen: assemble(local.lists, local.settings, local.queue, { partial: true }), offline: true };
  }
}

/**
 * The kitchen as the page should show it; `offline` says the service could not be reached. `pull: false` builds it
 * from what the database holds now (after the kit pulled by itself: a watcher, offline/start.js).
 * @param {{ pull?: boolean }} [o] @returns {Promise<{ kitchen: Kitchen, offline: boolean }>}
 */
export async function readKitchen({ pull = true } = {}) {
  const kit = await kitData();
  const all = (await kit.settings()).all;
  // Kept items follow the server too (a kept dish deleted there leaves the database: api/recipe-gone.js says so).
  const offline = pull ? await pullAll(kit) : false;
  const local = await localState(kit);
  if (!all) return keptOrServer(kit, local);
  // Offline on a device whose database never got a first page: nothing to show is said, never an empty kitchen.
  if (offline && (await kit.db.collection("dishes").status()).lastPull === null) {
    sayRead(true);
    throw noCopy();
  }
  if (pull) sayRead(offline);
  return { kitchen: assemble(local.lists, local.settings, local.queue), offline };
}
