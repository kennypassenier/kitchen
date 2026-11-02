// Keeping the recipes kept one by one equal to the server (fix-offline-master-2, Kenny 02/11/2026 19:43: "de server is
// altijd de master, heeft altijd gelijk"). The decision is offline/kept.js `keptRefreshPlan` (pure); this file talks to
// the kit.
//
// The kit stores a copy only of an answer it READS on a kept path, and the pages read the whole kitchen
// (`/data/kitchen`), never a dish's own route. So a kept dish's copy stayed as it was when the switch was turned on: an
// edit made on another device showed offline as if it were the kitchen's. (A queued edit the server refuses is the
// kit's: since chassis-rs 67d593e it puts the item's copy back to the server's version itself, and a 404 on a read
// drops the copy; Kitchen does not repeat either.) After every online kitchen read
// with "keep everything" off, this reads each kept dish the answer still lists and the ingredients list again, so the
// kit stores the server's answers over its copies, and it keeps the ingredients a kept dish names now and lets go of
// those none names any more. The dishes the answer no longer lists are api/recipe-gone.js's (run first).

import { INGREDIENTS_PATH, dishPath } from "../offline/config.js";
import { keptRefreshPlan } from "../offline/kept.js";
import { kitData } from "./kit-data.js";
import { dropGoneDishes } from "./recipe-gone.js";

/**
 * Read `paths` through the kit (each answer replaces the kit's copy); a read that fails is said in the console with its
 * path and cause, and the others still go. @param {import("./kit-data.js").KitData} kit @param {string[]} paths
 * @returns {Promise<number>} how many failed
 */
async function readAll(kit, paths) {
  const reads = await Promise.allSettled(paths.map((p) => kit.get(p)));
  let failed = 0;
  reads.forEach((r, i) => {
    if (r.status === "fulfilled") return;
    failed += 1;
    console.warn(`Kitchen: the kept copy of ${paths[i]} could not be refreshed from the kitchen; it is tried at the next read.`, r.reason);
  });
  return failed;
}

/**
 * After an online kitchen read: every kept dish the answer lists is read again, with the ingredients list, and the
 * ingredient keeps follow what the kept dishes name now. Does nothing while "keep everything" is on (the whole kitchen's
 * copy is the server's answer then).
 * @param {readonly Record<string, any>[]} serverDishes the dishes the kitchen just answered with
 * @returns {Promise<{ refreshed: string[], failed: number }>}
 */
export async function refreshKeptDishes(serverDishes) {
  const kit = await kitData();
  const settings = await kit.settings();
  if (settings.all) return { refreshed: [], failed: 0 };
  const plan = keptRefreshPlan(serverDishes, settings.items);
  if (!plan.dishIds.length) return { refreshed: [], failed: 0 };
  // Keep the new ingredients before reading the list, so the kit stores the list trimmed to them as well.
  for (const path of plan.keep) await kit.keepItem(path, true);
  for (const path of plan.release) await kit.keepItem(path, false);
  const failed = await readAll(kit, [...plan.dishIds.map(dishPath), INGREDIENTS_PATH]);
  return { refreshed: plan.dishIds, failed };
}

/**
 * The kept recipes after an online kitchen read: first the dishes the server says are gone are dropped, then the rest
 * are refreshed from the server. One after the other, so the two never change the kit's keeps at the same time.
 * @param {readonly Record<string, any>[]} serverDishes
 */
export async function syncKeptWithServer(serverDishes) {
  await dropGoneDishes(serverDishes);
  await refreshKeptDishes(serverDishes);
}
