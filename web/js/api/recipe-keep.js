// Keeping one recipe offline in the kit's local database (feat-offline-recipe, Kenny 02/11/2026 17:25 and 19:12,
// option B; on `chassisData.db` since feat-db-pages-2). The decisions are offline/keep-plan.js (pure); this file only
// talks to the kit: `collection(name).keep(key, on)` (a newly kept key is fetched once through its item route; letting
// go removes the record unless everything is kept) and `isKept(key)`. With "keep everything" off, the dishes and
// ingredients the local database holds are exactly the kept ones; the kit pulls their changes and applies the server's
// deletes like any other record.

import { dishIngredientIds, keepStateOf, keptCount, missingIngredientIds, releasePlan } from "../offline/keep-plan.js";
import { kitData } from "./kit-data.js";
import { keptHere, leftHere } from "./recipe-gone.js";

/** @typedef {import("../offline/keep-plan.js").KeepState} KeepState */
/** @typedef {import("./kit-data.js").KitData} KitData */
/** @typedef {Record<string, any>} Item */

/** What the switch of the dish's recipe shows on this device. @param {string} dishId @returns {Promise<KeepState>} */
export async function recipeKeepState(dishId) {
  const kit = await kitData();
  const all = (await kit.settings()).all;
  return keepStateOf(all, all || (await kit.db.collection("dishes").isKept(dishId)));
}

/** Keep (or let go) each ingredient id, one after the other. @param {KitData} kit @param {string[]} ids @param {boolean} on */
async function keepIngredients(kit, ids, on) {
  const ingredients = kit.db.collection("ingredients");
  for (const id of ids) await ingredients.keep(id, on);
}

/**
 * Keep the dish of a recipe on this device, with the ingredients its recipes name, or stop keeping it (and the
 * ingredients no other kept dish names). `copied` says the dish is in the local database now; false when there is no
 * connection right now (the kit could not fetch it): the next online kitchen read fetches it (`fillKeptGaps`).
 * @param {readonly Item[]} dishes the kitchen's dishes, for the ingredients @param {string} dishId @param {boolean} on
 * @returns {Promise<{ kept: boolean, copied: boolean }>}
 */
export async function keepRecipe(dishes, dishId, on) {
  const kit = await kitData();
  const col = kit.db.collection("dishes");
  const dish = dishes.find((d) => d.id === dishId) ?? (await col.get(dishId));
  if (!on) {
    const plan = releasePlan((await col.all()).filter((d) => d.id !== dishId), dish);
    leftHere(dishId); // it leaves the database now by the person's choice: no "gone" notice
    const kept = await col.keep(dishId, false);
    await keepIngredients(kit, plan, false);
    return { kept, copied: false };
  }
  // The ingredients first, so the dish is never kept without its names.
  await keepIngredients(kit, dishIngredientIds(dish), true);
  keptHere(dishId);
  const kept = await col.keep(dishId, true);
  return { kept, copied: (await col.get(dishId)) !== null };
}

/**
 * After an online kitchen read with "keep everything" off: a kept dish the device does not hold yet (kept while
 * offline) is fetched, and the ingredients the kept dishes name now but the device does not keep (a line added on
 * another device) are kept. The kit's `keep` fetches each once through its item route.
 * @param {KitData} kit @param {readonly Item[]} serverDishes @param {Record<string, Item[]>} lists the local rows
 */
export async function fillKeptGaps(kit, serverDishes, lists) {
  const col = kit.db.collection("dishes");
  const held = new Set(lists.dishes.map((d) => d.id));
  for (const d of serverDishes) {
    if (!held.has(d.id) && (await col.isKept(d.id))) await col.keep(d.id, true);
  }
  const kept = serverDishes.filter((d) => held.has(d.id));
  await keepIngredients(kit, missingIngredientIds(kept, lists.ingredients), true);
}

/** How many recipes are kept one by one on this device (the dishes the local database holds). */
export async function keptRecipeCount() {
  const kit = await kitData();
  return keptCount(await kit.db.collection("dishes").all());
}
