// Reading the whole kitchen through the kit (feat-offline-kitchen): the service's answer, or the device's offline copy
// when the service cannot be reached, with every edit still waiting in the kit's queue laid over it (offline/apply.js).
// So a page reloaded without a connection shows what the person changed, and so does a page read while the queue is
// still being sent. Edits refused on replay (the failed list) are not laid over: the kitchen's version stands.
//
// Without a connection and without a copy of the whole kitchen ("keep everything" off), the recipes kept one by one
// are read instead (feat-offline-recipe, api/recipe-keep.js): a kitchen of the kept dishes only, marked `partial`, so
// the recipe page and cook mode open a kept recipe offline. With nothing kept the first refusal stands.

import { KITCHEN_PATH } from "../offline/config.js";
import { applyQueued } from "../offline/apply.js";
import { ApiError } from "./http.js";
import { queuedEdits, readJson } from "./kit-data.js";
import { readKeptKitchen } from "./recipe-keep.js";

/** @typedef {import("../api.js").Kitchen} Kitchen */

/**
 * The kitchen as the page should show it. `offline` says it came from the device's copy.
 * @returns {Promise<{ kitchen: Kitchen, offline: boolean }>}
 */
export async function readKitchen() {
  const { data, offline } = await readWholeOrKept();
  const { kitchen, unknown } = applyQueued(data, await queuedEdits());
  // An edit Kitchen never makes (a path or method outside its routes) is not guessed at: said once, left to the kit.
  if (unknown.length) console.warn("Kitchen: queued edits that do not fit the kitchen were not shown", unknown);
  return { kitchen: /** @type {Kitchen} */ (kitchen), offline };
}

/**
 * The whole kitchen, or, when the service cannot be reached and the device has no copy of it, the kept recipes.
 * @returns {Promise<{ data: Record<string, any>, offline: boolean }>}
 */
async function readWholeOrKept() {
  try {
    return await readJson(KITCHEN_PATH);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 0) throw e;
    const kept = await readKeptKitchen();
    if (!kept) throw e;
    return { data: kept, offline: true };
  }
}
