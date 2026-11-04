// The notice for a kept recipe whose dish the server deleted (feat-offline-gone, Kenny 02/11/2026 19:43, "Uit kopie
// halen"; on `chassisData.db` since feat-db-pages-2). The kit applies the feed's delete to its local database itself
// (deletes are always applied, kept or not); Kitchen only notices that a dish it kept left the database, says so once,
// lets go of the key and of the ingredients no other kept dish names. The decisions are offline/keep-plan.js (pure).
//
// Only while "keep everything" is off: with it on nothing is kept one by one, and a deleted dish simply leaves every
// page, as any other deletion. A dish this device deleted or stopped keeping itself is the person's own: no notice.

import { toast } from "/static/kp/dist/js/overlays.js";
import { t } from "../i18n/index.js";
import { createNoticeOnce, goneDishIds, orphanIngredientIds } from "../offline/keep-plan.js";
import { SEEN_KEY, deviceStorage } from "../offline/keep.js";
import { kitData } from "./kit-data.js";
import { keptDishes } from "./recipe-keep.js";

/** @typedef {import("./kit-data.js").KitData} KitData */

const noticed = createNoticeOnce();
/** Dish ids that left the database by this device's own doing (deleted here, or no longer kept here): no notice. @type {Set<string>} */
const ownDeletes = new Set();
/** The kept dish ids of the last look (remembered per device, so a dish deleted while the app was closed is still
 * noticed at the next start), or null when there was none (or it cannot be read: said in the console). */
function loadSeen() {
  try {
    const raw = deviceStorage()?.getItem(SEEN_KEY);
    const ids = raw ? JSON.parse(raw) : null;
    return Array.isArray(ids) ? new Set(ids.filter((x) => typeof x === "string")) : null;
  } catch (e) {
    console.warn("Kitchen: the kept recipes of the last look could not be read; this look starts afresh.", e);
    return null;
  }
}

/** Remember this look (a blocked storage keeps it for the page's life only: said). @param {Set<string> | null} ids */
function saveSeen(ids) {
  try {
    if (ids) deviceStorage()?.setItem(SEEN_KEY, JSON.stringify([...ids]));
    else deviceStorage()?.removeItem(SEEN_KEY);
  } catch (e) {
    console.warn("Kitchen: the kept recipes of this look could not be remembered on this device.", e);
  }
}

/** The kept dish ids the local database held at the last look; null before the first. @type {Set<string> | null} */
let seen = loadSeen();

/** Remember that dish `id` leaves the database by this device's doing (api.js `remove`, api/recipe-keep.js). @param {string} id */
export const leftHere = (id) => void ownDeletes.add(id);

/** Dish `id` is kept again here: its leaving the database is noticed again. @param {string} id */
export const keptHere = (id) => void ownDeletes.delete(id);

/** Dish `id` was just kept: it is in the look from now on, so a delete before the next pull is noticed. @param {string} id */
export function lookAtKept(id) {
  if (!seen) return; // no look yet: the first one takes every kept dish
  seen.add(id);
  saveSeen(seen);
}

/** The notice, not sticky: the kit toast in the page's language. */
const sayGone = () => toast(t("off.goneRecipe"));

/**
 * The kept dish ids that are still in the kitchen (the kit's overlay hides a delete waiting here, which is ours anyway).
 * Only kept ones: with "keep everything" off `all()` reads through the service online (chassis-rs 4.6.0) and answers
 * every dish, kept or not.
 * @param {KitData} kit
 */
async function heldDishIds(kit) {
  return new Set((await keptDishes(kit.db.collection("dishes"))).map((d) => String(d.id)));
}

/**
 * Compare the dishes held now with the last look; for each kept dish that left without a delete of ours: the notice
 * once, the key let go, then the ingredients no kept dish names. Answers the ids said gone.
 * @param {KitData} kit @param {() => unknown} [notify] the notice (replaced by the release script's check)
 * @returns {Promise<string[]>}
 */
export async function checkGoneDishes(kit, notify = sayGone) {
  if ((await kit.settings()).all) {
    if (seen) saveSeen((seen = null));
    return [];
  }
  const now = await heldDishIds(kit);
  const gone = seen ? goneDishIds(seen, now, ownDeletes) : [];
  saveSeen((seen = now));
  if (!gone.length) return [];
  const dishes = kit.db.collection("dishes");
  for (const id of gone) {
    await dishes.keep(id, false);
    if (noticed.claim(id)) notify();
  }
  const ingredients = kit.db.collection("ingredients");
  for (const id of orphanIngredientIds(await keptDishes(dishes), await ingredients.all())) await ingredients.keep(id, false);
  return gone;
}

/** Watch the dishes collection for the rest of the page's life; returns the clean-up. */
export async function watchGoneDishes() {
  const kit = await kitData();
  const run = () => void checkGoneDishes(kit).catch((e) => console.warn("Kitchen: checking the kept recipes against the kitchen failed", e));
  run(); // the first look: compared with the last one remembered on this device
  // Every change of the collection: a pull may remove a kept dish, and a new keep must be in the look before that.
  return kit.db.collection("dishes").watch(() => run());
}
