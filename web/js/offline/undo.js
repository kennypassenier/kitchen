// Undo of a delete that is still waiting to be sent (feat-offline-kitchen). Without a connection a delete joins the
// kit's queue and the item leaves the page at once (the kit's overlay hides it in the local database). Undo then has
// nothing to ask the server for (the server never deleted it), so it drops the waiting delete from the queue: the
// overlay is gone and the local database shows the server's record again (feat-db-pages-1).
//
// The item handed back is the database's record when it holds one (the server's version); else the page's own copy,
// parked here when its delete was queued (an item the device does not keep while "keep everything" is off). A reload
// empties the parking, which is fine: the undo toast does not outlive the page.

import { itemPath } from "./config.js";

/** @typedef {Record<string, any>} Item */
/** @typedef {{ id: number, method: string, path: string, state: string }} Entry one entry of the kit's queue */

/** Items whose delete waits in the queue, by `<list>/<id>`. @type {Map<string, Item>} */
const parked = new Map();

const keyOf = (/** @type {string} */ list, /** @type {string} */ id) => `${list}/${id}`;

/** Keep the item whose delete was just queued. @param {string} list @param {Item | undefined} item */
export function parkDeleted(list, item) {
  if (item?.id) parked.set(keyOf(list, item.id), item);
}

/**
 * The waiting delete of an item, if one still waits to be sent. Only a `queued` entry: a held or failed one is the
 * failed list's business. @template {Entry} E @param {E[]} entries @param {string} list @param {string} id @returns {E | null}
 */
export function queuedDeleteOf(entries, list, id) {
  const path = itemPath(list, id);
  return entries.find((e) => e.method === "DELETE" && e.path === path && e.state === "queued") ?? null;
}

/**
 * Take a waiting delete back. `dropped`: its delete was still waiting and is now dropped from the queue, with `item`
 * the database's record, else the parked copy (null when neither holds it: the next read shows it). Not dropped: there
 * was none (sent meanwhile, or never queued), and the caller restores through the server.
 * @param {{ queue: () => Promise<any[]>, drop: (id: number) => Promise<boolean> }} kit
 * @param {(list: string, id: string) => Promise<Item | null>} recordOf the local database's record, after the drop
 * @param {string} list @param {string} id @returns {Promise<{ dropped: boolean, item: Item | null }>}
 */
export async function unqueueDelete(kit, recordOf, list, id) {
  const key = keyOf(list, id);
  const entry = queuedDeleteOf(await kit.queue(), list, id);
  if (!entry) return { dropped: false, item: null };
  // false: the replay sent it a moment ago, and the server's undo window has it now
  if (!(await kit.drop(entry.id))) return { dropped: false, item: null };
  const item = (await recordOf(list, id)) ?? parked.get(key) ?? null;
  parked.delete(key);
  if (!item) console.warn(`Kitchen: the waiting delete of ${key} was taken back, but neither this device nor the page held the item; it shows after the next read.`);
  return { dropped: true, item };
}
