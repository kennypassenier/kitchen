// The kitchen the pages draw from, built from the collections of the kit's local database (feat-db-pages-1, Kenny
// 03/11/2026 06:12 "Nu ook de pagina's"). Pure: no fetch, no DOM, no kit, so scripts/offline-assemble.test.mjs tests it.
//
// Every screen reads one object shaped like `GET /data/kitchen` (api.js `Kitchen`); this keeps that shape so no screen
// changes. The kit lays the queued PUT / PATCH / DELETE of a collection over its records itself (its overlay, marked
// `pending`); what it cannot see is the freezer take, a POST to `/data/freezer/{id}/take` that is not a collection
// write, so `applyTakes` lays the waiting takes over the freezer here (filed kit gap: an `optimistic` that names the
// path it amends).
//
// Order: the feed carries no list position (held question, docs/OPEN.md release check 16). Each list is put in the
// order its items were made (`created`, then `id`), which is the stored order for every item the routes made (a create
// appends; Undo puts an item back with its own `created`). Every screen that shows an order sorts by its own field
// (`order`, `date`, a name, `frozen_on`), as before.

import { LISTS } from "./config.js";

/** @typedef {Record<string, any>} Item */
/** @typedef {import("../api.js").Kitchen} Kitchen */
/** @typedef {{ method: string, path: string, body?: any, state?: string }} Edit one entry of the kit's queue */

/** The kitchen format the pages read (`GET /data/kitchen` says `format: 5`). */
export const FORMAT = 5;

const TAKE_PATH = /^\/data\/freezer\/([^/?#]+)\/take$/;

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
 * The freezer with `n` portions taken off item `id` (negative puts back), never below zero; null when the item is not
 * there. @param {Item[]} freezer @param {string} id @param {number} n @returns {Item[] | null}
 */
export function takeFrom(freezer, id, n) {
  const item = freezer.find((x) => x.id === id);
  if (!item) return null;
  const left = Math.max(0, Number(item.portions ?? 0) - n);
  return freezer.map((x) => (x === item ? { ...item, portions: left } : x));
}

/** The freezer id a queued take names, or null when the entry is no take. @param {Edit} edit */
export function takeIdOf(edit) {
  const m = edit.method === "POST" ? TAKE_PATH.exec(edit.path) : null;
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null; // a path Kitchen never wrote
  }
}

/**
 * Every waiting take laid over the freezer in queue order; a failed one is skipped (the server's count stands, the
 * take waits in the kit's failed list). A take of an item the freezer does not hold is skipped too.
 * @param {Item[]} freezer @param {readonly Edit[]} queue the kit's queue, oldest first @returns {Item[]}
 */
export function applyTakes(freezer, queue) {
  let next = freezer;
  for (const edit of queue) {
    if (edit.state === "failed") continue;
    const id = takeIdOf(edit);
    if (id === null) continue;
    next = takeFrom(next, id, Number(edit.body?.portions ?? 1)) ?? next;
  }
  return next;
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
 * is the settings item (or null), `queue` the kit's queue (for the takes). `partial`: "keep everything" is off, so the
 * lists hold only what this device keeps (a recipe kept on its own and the names it uses).
 * @param {Record<string, unknown>} lists @param {Item | null} settings @param {readonly Edit[]} queue
 * @param {{ partial?: boolean }} [o] @returns {Kitchen & { partial?: boolean }}
 */
export function assemble(lists, settings, queue, { partial = false } = {}) {
  /** @type {Record<string, Item[]>} */
  const out = {};
  for (const name of LISTS) out[name] = listOf(lists[name]);
  out.freezer = applyTakes(out.freezer, queue);
  const kitchen = /** @type {Kitchen & { partial?: boolean }} */ ({ format: FORMAT, recipes: [], ...out, ...settingsOf(settings) });
  if (partial) kitchen.partial = true;
  return kitchen;
}

/**
 * While "keep everything" is off and the service answers: its whole kitchen (`GET /data/kitchen`), with every item the
 * local database holds as a waiting edit (`pending`, the kit's overlay of a queued write) laid over it, and the waiting
 * takes. A kept item without a waiting edit is the server's own and is not laid over: the server's answer is newer.
 * The settings item is always kept (api/kitchen-read.js), so a waiting settings merge is laid over the same way.
 * @param {Kitchen} server @param {Record<string, unknown>} lists the kept collections' rows
 * @param {Item | null} settings the settings item as the local database holds it @param {readonly Edit[]} queue
 * @returns {Kitchen}
 */
export function overServer(server, lists, settings, queue) {
  /** @type {Record<string, Item[]>} */
  const out = {};
  for (const name of LISTS) {
    const own = Array.isArray(server[/** @type {keyof Kitchen} */ (name)]) ? /** @type {Item[]} */ (server[/** @type {keyof Kitchen} */ (name)]) : [];
    const waiting = new Map((Array.isArray(lists[name]) ? /** @type {Item[]} */ (lists[name]) : []).filter((r) => r.pending === true).map((r) => [r.id, r]));
    out[name] = listOf(own.map((x) => waiting.get(x.id) ?? x));
  }
  out.freezer = applyTakes(out.freezer, queue);
  const merged = settings?.pending === true ? settingsOf(settings) : {};
  return { ...server, recipes: [], ...out, ...merged };
}
