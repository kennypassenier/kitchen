// Undo of a delete that is still waiting to be sent (feat-offline-kitchen). Without a connection a delete joins the
// kit's queue and the item leaves the page at once; Undo then has nothing to ask the server for (the server never
// deleted it), so it drops the waiting delete from the queue and puts the item back in the page's copy.
//
// The kit's queue entry of a DELETE carries no body, so the item itself is parked here when its delete is queued, for
// the length of the undo window. A reload empties the parking, which is fine: the undo toast does not outlive the page.

import { queuedDeleteOf } from "./apply.js";

/** @typedef {Record<string, any>} Item */

/** Items whose delete waits in the queue, by `<list>/<id>`. @type {Map<string, Item>} */
const parked = new Map();

const keyOf = (/** @type {string} */ list, /** @type {string} */ id) => `${list}/${id}`;

/** Keep the item whose delete was just queued. @param {string} list @param {Item | undefined} item */
export function parkDeleted(list, item) {
  if (item?.id) parked.set(keyOf(list, item.id), item);
}

/**
 * Take a waiting delete back. Resolves to the parked item when its delete was still waiting and is now dropped from the
 * queue; null when there is none (it was sent meanwhile, or never queued), and the caller restores through the server.
 * @param {{ queue: () => Promise<any[]>, drop: (id: number) => Promise<boolean> }} kit @param {string} list @param {string} id
 * @returns {Promise<Item | null>}
 */
export async function unqueueDelete(kit, list, id) {
  const key = keyOf(list, id);
  const item = parked.get(key) ?? null;
  const entry = queuedDeleteOf(await kit.queue(), list, id);
  if (!entry || !item) return null;
  const dropped = await kit.drop(entry.id);
  if (!dropped) return null; // the replay sent it a moment ago: the server's undo window has it now
  parked.delete(key);
  return item;
}
