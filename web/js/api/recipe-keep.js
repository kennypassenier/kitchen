// Keeping one recipe offline through the kit (feat-offline-recipe, Kenny 02/11/2026 17:25 and 19:12, option B), and
// reading the kept recipes back without a connection. The decisions are offline/kept.js (pure); this file only talks
// to the kit (`window.chassisData`, chassis-rs docs/OFFLINE_DESIGN.md): `settings`, `keepItem`, `get`.
//
// The kit keeps a copy of an answer when it READS it with keeping on, so marking a dish kept is not enough: turning
// the toggle on reads the dish and the lookups at once, and the copy exists before the connection drops.

import { LOOKUP_PATHS, PER_RECIPE_KEEP, dishPath } from "../offline/config.js";
import { keepStateOf, keptDishIds, partialKitchen } from "../offline/kept.js";
import { kitData } from "./kit-data.js";

/** @typedef {import("../offline/kept.js").KeepState} KeepState */
/** @typedef {import("../api.js").Kitchen} Kitchen */

/** What the toggle of the dish's recipe shows on this device. @param {string} dishId @returns {Promise<KeepState>} */
export async function recipeKeepState(dishId) {
  if (!PER_RECIPE_KEEP) return "hidden";
  return keepStateOf(await (await kitData()).settings(), dishId, PER_RECIPE_KEEP);
}

/**
 * Keep the dish of a recipe on this device, or stop keeping it. Turning it on reads the dish and the lookups so the
 * kit stores them now; a read that fails (no connection right now) is reported in `copied: false`, and the copy is
 * made at the next read with a connection. Turning it off keeps what is stored until "Clear offline copy".
 * @param {string} dishId @param {boolean} on @returns {Promise<{ kept: boolean, copied: boolean }>}
 */
export async function keepRecipe(dishId, on) {
  if (!PER_RECIPE_KEEP) throw new Error("Kitchen: per-recipe keeping is not live (offline/config.js PER_RECIPE_KEEP).");
  const kit = await kitData();
  const kept = await kit.keepItem(dishPath(dishId), on);
  if (!on) return { kept, copied: false };
  const reads = await Promise.allSettled([dishPath(dishId), ...LOOKUP_PATHS].map((path) => kit.get(path)));
  const failed = reads.filter((r) => r.status === "rejected");
  if (failed.length) console.warn("Kitchen: a kept recipe could not be copied right now; it is copied at the next read.", failed);
  return { kept, copied: failed.length === 0 };
}

/** The kept paths of this device (the kit's settings). @returns {Promise<string[]>} */
export async function keptPaths() {
  return [...(await (await kitData()).settings()).items];
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
 * The kitchen made of the dishes kept one by one, from the kit's copies; null when per-recipe keeping is not live or
 * no dish is kept. A kept dish without a copy (kept while offline and never read since) is left out and reported.
 * @returns {Promise<(Kitchen & { partial: true }) | null>}
 */
export async function readKeptKitchen() {
  if (!PER_RECIPE_KEEP) return null;
  const kit = await kitData();
  const ids = keptDishIds((await kit.settings()).items);
  if (!ids.length) return null;
  const dishes = (await Promise.all(ids.map((id) => readOr(kit, dishPath(id), null)))).filter((d) => d !== null);
  if (!dishes.length) return null;
  const [ingredients, settings] = await Promise.all([readOr(kit, LOOKUP_PATHS[0], []), readOr(kit, LOOKUP_PATHS[1], {})]);
  return partialKitchen({ dishes, ingredients, settings });
}
