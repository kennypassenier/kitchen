// The two writes that are not an item replace (split out of web/js/api.js, feat-db-pages-1): the freezer take and the
// settings merge. Both go through the kit's queue (api/kit-data.js `writeJson`), so without a connection they wait and
// the shared copy shows them at once; api.js re-exports both, so the pages keep importing from "../api.js".

import { kitchenNow, put, putSettings } from "../api.js";
import { SETTINGS_PATH, TAKE_ACTION } from "../offline/config.js";
import { settingsOf, takeLook } from "../offline/assemble.js";
import { settingsRevFor } from "./save.js";
import { kitData, toApiError, writeJson } from "./kit-data.js";

/**
 * Take portions out of the freezer (negative puts them back) through the freezer's item action (chassis-rs 4.6.0
 * `act`, a POST with an Idempotency-Key): without a connection the take waits in the kit's queue and its look
 * (offline/assemble.js `takeLook`) shows in the local database at once, never below zero; the server applies a replay
 * once. Resolves to the item as it now stands: the server's answer, or the local database's record while it waits.
 * @param {string} id @param {number} [portions]
 */
export async function takePortions(id, portions = 1) {
  const freezer = (await kitData()).db.collection("freezer");
  let done;
  try {
    done = await freezer.act(id, TAKE_ACTION, { portions });
  } catch (e) {
    throw toApiError(e);
  }
  const item = done.queued ? ((await freezer.get(id)) ?? fromPage(id, portions)) : done.data;
  if (item) put("freezer", item);
  // The freezer page takes only from items it shows; said if that ever breaks (the take itself still waits).
  else console.warn(`Kitchen: a queued take of freezer item ${id} is in neither the local database nor the page's copy; it shows after the next read.`);
  return item ?? { id };
}

/**
 * A waiting take's look on the page's own copy, for a freezer item this device does not keep ("keep everything" off
 * and offline: the local database has no record to lay the take over). @param {string} id @param {number} portions
 */
function fromPage(id, portions) {
  const held = (kitchenNow()?.freezer ?? []).find((x) => x.id === id);
  return held ? takeLook(held, { portions }) : null;
}

/** The settings PATCHes in flight, one after the other, so each names the revision the one before it answered. */
let settingsChain = Promise.resolve();

/**
 * Merge keys into the settings (`null` removes one), on the settings item of the local database's `settings`
 * collection (`PATCH /data/settings/kitchen`). Checked against the settings' revision the page read (`settings_rev`,
 * fix-offline-master-5): a merge made over a newer change elsewhere is refused with an ApiError of code "stale", sent
 * now or replayed from the queue later (then it lands in the kit's failed list). Merges run one after the other (two
 * rows changed in quick succession would otherwise both name the same revision and the second be refused).
 * @param {Record<string, unknown>} patch
 */
export function patchSettings(patch) {
  const run = settingsChain.then(() => sendSettings(patch));
  settingsChain = run.catch(() => undefined); // a refusal is the caller's; the next merge still runs
  return run;
}

/** One settings PATCH and what it does to the shared copy. @param {Record<string, unknown>} patch */
async function sendSettings(patch) {
  const held = kitchenNow();
  const { data, queued } = await writeJson("PATCH", SETTINGS_PATH, patch, settingsRevFor(held));
  // Queued: merged here the way the server merges (`null` removes a key); the revision stays the one read, which the
  // queued merge names. Sent: the answer is the settings item, `{id, rev, ..keys}`.
  const next = queued ? settingsOf({ ...(held?.settings ?? {}), ...patch }) : settingsOf(data);
  putSettings(next.settings, queued ? null : next.settings_rev);
  return next.settings;
}
