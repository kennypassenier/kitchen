// The kitchen the pages draw from, built from the collections of the kit's local database (feat-db-pages-1, Kenny
// 03/11/2026 06:12 "Nu ook de pagina's"). Pure: no fetch, no DOM, no kit, so scripts/offline-assemble.test.mjs tests it.
//
// Every screen reads one object shaped like `GET /data/kitchen` (api.js `Kitchen`); this keeps that shape so no screen
// changes. The kit lays the queued writes of a collection over its records itself (its overlay, marked
// `pending`), the freezer take included: it is the freezer's item action `take` (chassis-rs 4.6.0 `action` / `act`),
// whose look is `takeLook` here.
//
// Order: the feed carries no list position (held question, docs/OPEN.md release check 16). Each list is put in the
// order its items were made (`created`, then `id`), which is the stored order for every item the routes made (a create
// appends; Undo puts an item back with its own `created`). Every screen that shows an order sorts by its own field
// (`order`, `date`, a name, `frozen_on`), as before.

import { LISTS } from "./config.js";

/** @typedef {Record<string, any>} Item */
/** @typedef {import("../api.js").Kitchen} Kitchen */

/** The kitchen format the pages read (`GET /data/kitchen` says `format: 5`). */
export const FORMAT = 5;

/** `a` before `b` when it was made earlier; items without `created` (seeded) first; `id` breaks ties. @param {Item} a @param {Item} b */
export function byCreated(a, b) {
  const ca = String(a?.created ?? "");
  const cb = String(b?.created ?? "");
  if (ca !== cb) return ca < cb ? -1 : 1;
  return String(a?.id ?? "") < String(b?.id ?? "") ? -1 : String(a?.id ?? "") > String(b?.id ?? "") ? 1 : 0;
}

/**
 * The settings item (`{id: "kitchen", rev, ..keys}`) as the pages read it: the keys, and the revision as
 * `settings_rev`. A key the kit's overlay of a queued merge left at `null` is removed, as the server removes it.
 * @param {Item | null | undefined} item @returns {{ settings: Record<string, unknown>, settings_rev: number }}
 */
export function settingsOf(item) {
  const { id: _id, rev, pending: _pending, ...keys } = item ?? {};
  /** @type {Record<string, unknown>} */
  const settings = {};
  for (const [key, value] of Object.entries(keys)) if (value !== null) settings[key] = value;
  return { settings, settings_rev: Number.isSafeInteger(rev) && rev >= 0 ? rev : 0 };
}

/**
 * The look of a waiting freezer take (the freezer's item action `take`, registered in api/kit-data.js): `portions`
 * taken off the item (negative puts back), never below zero, as the server counts it.
 * @param {Item} record @param {{ portions?: unknown }} body @returns {Item}
 */
export function takeLook(record, body) {
  const n = Number(body?.portions ?? 1);
  return { ...record, portions: Math.max(0, Number(record.portions ?? 0) - (Number.isFinite(n) ? n : 1)) };
}

/** One list from a collection's answer: a copy without the kit's `pending` mark, in made order. @param {unknown} rows */
function listOf(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const { pending: _pending, ...item } = /** @type {Item} */ (r);
    return item;
  }).sort(byCreated);
}

/**
 * The kitchen from the collections. `lists` maps each list name to what `collection(name).all()` answered, `settings`
 * is the settings item (or null). `partial`: "keep everything" is off, so the
 * lists hold only what this device keeps (a recipe kept on its own and the names it uses).
 * @param {Record<string, unknown>} lists @param {Item | null} settings @param {{ partial?: boolean }} [o] @returns {Kitchen & { partial?: boolean }}
 */
export function assemble(lists, settings, { partial = false } = {}) {
  /** @type {Record<string, Item[]>} */
  const out = {};
  for (const name of LISTS) out[name] = listOf(lists[name]);
  const kitchen = /** @type {Kitchen & { partial?: boolean }} */ ({ format: FORMAT, recipes: [], ...out, ...settingsOf(settings) });
  if (partial) kitchen.partial = true;
  return kitchen;
}

/**
 * While "keep everything" is off and the service answers: its whole kitchen (`GET /data/kitchen`), with every item the
 * local database holds as a waiting edit (`pending`, the kit's overlay of a queued write, a take included) laid over
 * it. A kept item without a waiting edit is the server's own and is not laid over: the server's answer is newer.
 * The settings item is always kept (api/kitchen-read.js), so a waiting settings merge is laid over the same way.
 * @param {Kitchen} server @param {Record<string, unknown>} lists the kept collections' rows
 * @param {Item | null} settings the settings item as the local database holds it
 * @returns {Kitchen}
 */
export function overServer(server, lists, settings) {
  /** @type {Record<string, Item[]>} */
  const out = {};
  for (const name of LISTS) {
    const own = Array.isArray(server[/** @type {keyof Kitchen} */ (name)]) ? /** @type {Item[]} */ (server[/** @type {keyof Kitchen} */ (name)]) : [];
    const waiting = new Map((Array.isArray(lists[name]) ? /** @type {Item[]} */ (lists[name]) : []).filter((r) => r.pending === true).map((r) => [r.id, r]));
    out[name] = listOf(own.map((x) => waiting.get(x.id) ?? x));
  }
  const merged = settings?.pending === true ? settingsOf(settings) : {};
  return { ...server, recipes: [], ...out, ...merged };
}
