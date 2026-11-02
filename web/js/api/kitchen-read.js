// Reading the whole kitchen through the kit (feat-offline-kitchen): the service's answer, or the device's offline copy
// when the service cannot be reached, with every edit still waiting in the kit's queue laid over it (offline/apply.js).
// So a page reloaded without a connection shows what the person changed, and so does a page read while the queue is
// still being sent. Edits refused on replay (the failed list) are not laid over: the kitchen's version stands.

import { KITCHEN_PATH } from "../offline/config.js";
import { applyQueued } from "../offline/apply.js";
import { queuedEdits, readJson } from "./kit-data.js";

/** @typedef {import("../api.js").Kitchen} Kitchen */

/**
 * The kitchen as the page should show it. `offline` says it came from the device's copy.
 * @returns {Promise<{ kitchen: Kitchen, offline: boolean }>}
 */
export async function readKitchen() {
  const { data, offline } = await readJson(KITCHEN_PATH);
  const { kitchen, unknown } = applyQueued(data, await queuedEdits());
  // An edit Kitchen never makes (a path or method outside its routes) is not guessed at: said once, left to the kit.
  if (unknown.length) console.warn("Kitchen: queued edits that do not fit the kitchen were not shown", unknown);
  return { kitchen: /** @type {Kitchen} */ (kitchen), offline };
}
