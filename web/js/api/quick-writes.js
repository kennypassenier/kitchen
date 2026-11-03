// The two writes that are not an item replace (split out of web/js/api.js, feat-db-pages-1): the freezer take and the
// settings merge. Both go through the kit's queue (api/kit-data.js `writeJson`), so without a connection they wait and
// the shared copy shows them at once; api.js re-exports both, so the pages keep importing from "../api.js".

import { kitchenNow, put, putSettings } from "../api.js";
import { SETTINGS_PATH, takePath } from "../offline/config.js";
import { settingsOf, takeFrom } from "../offline/assemble.js";
import { settingsRevFor } from "./save.js";
import { writeJson } from "./kit-data.js";

/**
 * Take portions out of the freezer (negative puts them back), through the kit (`chassisData.post` with an
 * Idempotency-Key, feat-offline-take-1): without a connection the take waits in its queue and the shared copy shows it
 * at once (the kitchen read lays it over too, offline/assemble.js `applyTakes`), never below zero; the server applies a
 * replay once. The kit's collection writes have no take, so this stays a POST (a patch of `portions` would refuse the
 * second of two offline takes as stale). Resolves to the item as it now stands.
 * @param {string} id @param {number} [portions]
 */
export async function takePortions(id, portions = 1) {
  const { data, queued } = await writeJson("POST", takePath(id), { portions });
  const item = queued ? (takeFrom(kitchenNow()?.freezer ?? [], id, portions) ?? []).find((x) => x.id === id) : data;
  if (item) put("freezer", item);
  // Only the freezer page takes, from items its copy holds; said if that ever breaks (the take itself still waits).
  else console.warn(`Kitchen: a queued take of freezer item ${id} is not in the page's copy; it shows after the next read.`);
  return item ?? { id };
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
