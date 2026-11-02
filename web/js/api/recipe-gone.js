// Dropping a kept recipe whose dish the kitchen no longer holds (feat-offline-gone, Kenny 02/11/2026 19:43, "Uit kopie
// halen"). The decisions are offline/gone.js and offline/kept.js (pure); this file talks to the kit.
//
// Where the 404 is seen: the one read path of kept dishes online is the kitchen read (api/kitchen-read.js). When that
// answer no longer lists a dish the device keeps, the dish's own item route is asked; a real 404 there drops the keep
// mark (`keepItem(path, false)`: the kit trims its stored copy before it resolves) and the ingredient keeps no other
// kept dish uses, then shows one notice per dish. A lost connection or any other refusal changes nothing.

import { toast } from "/static/kp/dist/js/overlays.js";
import { t } from "../i18n/index.js";
import { dishPath } from "../offline/config.js";
import { classifyDishRead, createNoticeOnce, missingKeptDishIds } from "../offline/gone.js";
import { keptDishIds, orphanIngredientPaths } from "../offline/kept.js";
import { kitData } from "./kit-data.js";

const noticed = createNoticeOnce();

/** The notice, not sticky: the kit toast in the page's language. */
const sayGone = () => toast(t("off.goneRecipe"));

/**
 * What the server says about one kept dish: "present" when it answers, else what the failure means. A failure that is
 * neither gone nor offline is reported in the console with its cause and the copy stays.
 * @param {import("./kit-data.js").KitData} kit @param {string} id @returns {Promise<"present" | "gone" | "offline" | "error">}
 */
async function askServer(kit, id) {
  try {
    await kit.get(dishPath(id));
    return "present";
  } catch (e) {
    const outcome = classifyDishRead(e);
    if (outcome === "error") console.warn(`Kitchen: could not check whether the kept dish ${id} still exists; its offline copy stays.`, e);
    return outcome;
  }
}

/**
 * After an online kitchen read: drop every kept dish the server answers 404 for, then the ingredients nothing kept
 * uses, and say so once per dish. Does nothing while "keep everything" is on (nothing is kept one by one then).
 * @param {readonly Record<string, any>[]} serverDishes the dishes the kitchen just answered with
 * @param {() => unknown} [notify] the notice (replaced by the release script's check)
 * @returns {Promise<string[]>} the ids of the dishes dropped
 */
export async function dropGoneDishes(serverDishes, notify = sayGone) {
  const kit = await kitData();
  const settings = await kit.settings();
  if (settings.all) return [];
  const missing = missingKeptDishIds(keptDishIds(settings.items), serverDishes);
  /** @type {string[]} */
  const dropped = [];
  let unresolved = 0;
  for (const id of missing) {
    if ((await askServer(kit, id)) !== "gone") {
      unresolved += 1;
      continue;
    }
    await kit.keepItem(dishPath(id), false);
    dropped.push(id);
    if (noticed.claim(id)) notify();
  }
  // Sweep only when every kept dish is accounted for: one that could not be checked still needs its ingredients.
  if (dropped.length && unresolved === 0) {
    for (const path of orphanIngredientPaths(serverDishes, (await kit.settings()).items)) await kit.keepItem(path, false);
  }
  return dropped;
}
