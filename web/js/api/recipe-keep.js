// Keeping one recipe offline through the kit (feat-offline-recipe, Kenny 02/11/2026 17:25 and 19:12, option B), and
// reading the kept recipes back without a connection. The decisions are offline/kept.js (pure); this file only talks
// to the kit (`window.chassisData`, chassis-rs 8042dbe docs/OFFLINE_DESIGN.md "Trimmed keeping"): `settings`,
// `keepItem` (a promise: the kit trims its stored copy before it resolves), `get`.
//
// The kit copies an answer only when it READS it with keeping on, so marking the dish kept is not enough: turning the
// switch on reads the dish and the ingredients list at once (the kit stores the list trimmed to the kept ingredients),
// and the copy exists before the connection drops.

import { INGREDIENTS_PATH, dishPath } from "../offline/config.js";
import { ingredientPlan, keepStateOf, keptDishIds, partialKitchen } from "../offline/kept.js";
import { kitData } from "./kit-data.js";

/** @typedef {import("../offline/kept.js").KeepState} KeepState */
/** @typedef {import("../api.js").Kitchen} Kitchen */

/** What the switch of the dish's recipe shows on this device. @param {string} dishId @returns {Promise<KeepState>} */
export async function recipeKeepState(dishId) {
  return keepStateOf(await (await kitData()).settings(), dishId);
}

/**
 * Keep the dish of a recipe on this device, with the ingredients its recipes name, or stop keeping it (and the
 * ingredients no other kept dish names). Turning it on reads the dish and the ingredients so the kit stores them now; a
 * read that fails (no connection right now) gives `copied: false`, and the copy is made at the next read with a
 * connection. Turning it off removes the copies at once (the kit's trim).
 * @param {readonly Record<string, any>[]} dishes the kitchen's dishes, for the ingredients @param {string} dishId
 * @param {boolean} on @returns {Promise<{ kept: boolean, copied: boolean }>}
 */
export async function keepRecipe(dishes, dishId, on) {
  const kit = await kitData();
  const plan = ingredientPlan(dishes, (await kit.settings()).items, dishId, on);
  // The ingredients first when keeping and last when letting go, so the dish is never kept without its names.
  if (on) for (const path of plan) await kit.keepItem(path, true);
  const kept = await kit.keepItem(dishPath(dishId), on);
  if (!on) {
    for (const path of plan) await kit.keepItem(path, false);
    return { kept, copied: false };
  }
  const reads = await Promise.allSettled([kit.get(dishPath(dishId)), kit.get(INGREDIENTS_PATH)]);
  const failed = reads.filter((r) => r.status === "rejected");
  if (failed.length) console.warn("Kitchen: a kept recipe could not be copied right now; it is copied at the next read.", failed);
  return { kept, copied: failed.length === 0 };
}

/**
 * One answer from the kit, or `fallback` when it has neither a connection nor a copy (said in the console).
 * @template T @param {import("./kit-data.js").KitData} kit @param {string} path @param {T} fallback @returns {Promise<T>}
 */
async function readOr(kit, path, fallback) {
  try {
    return /** @type {T} */ ((await kit.get(path)).data);
  } catch (e) {
    console.warn(`Kitchen: ${path} has no offline copy on this device; the kept recipes show without it.`, e);
    return fallback;
  }
}

/**
 * The kitchen made of the dishes kept one by one, from the kit's copies; null when "keep everything" is on or no dish
 * is kept. A kept dish without a copy (kept while offline and never read since) is left out and reported.
 * @returns {Promise<(Kitchen & { partial: true }) | null>}
 */
export async function readKeptKitchen() {
  const kit = await kitData();
  const settings = await kit.settings();
  if (settings.all) return null;
  const ids = keptDishIds(settings.items);
  if (!ids.length) return null;
  const dishes = (await Promise.all(ids.map((id) => readOr(kit, dishPath(id), null)))).filter((d) => d !== null);
  if (!dishes.length) return null;
  const ingredients = await readOr(kit, INGREDIENTS_PATH, []);
  return partialKitchen({ dishes, ingredients: Array.isArray(ingredients) ? ingredients : [] });
}
