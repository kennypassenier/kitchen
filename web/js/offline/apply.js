// Kitchen's edit shapes on a local kitchen copy (feat-offline-kitchen). Pure: no fetch, no DOM, no kit, so
// scripts/offline-apply.test.mjs tests it.
//
// The kit keeps its copy per URL: the whole kitchen is one answer (`GET /data/kitchen`), while the edits go to the item
// routes (`PUT` / `DELETE /data/{list}/{id}`, `PATCH /data/settings`). The kit cannot know that a dish PUT changes the
// kitchen answer, so a reload with edits still waiting would show the kitchen without them. This module is the bridge:
// it lays the kit's waiting edits over a kitchen, in the order they were made, the way the server will apply them.
//
// - `PUT /data/{list}/{id}`: the item replaced whole (a new id is added at the end, as the server never would, so a
//   stray edit stays visible instead of vanishing). A recipe is saved as its dish (api.js), so it is a dish PUT here.
// - `DELETE /data/{list}/{id}`: the item gone.
// - `PATCH /data/settings`: keys merged, `null` removes one (src/routes.rs).
// - `POST /data/freezer/{id}/take` with `{portions: n}`: n portions off the freezer item, as the server takes them
//   (feat-offline-take-1); a take that would go below zero is shown at zero, and the server's refusal then lands in the
//   failed list.
// - An edit in the failed list (refused on replay) is NOT applied: the server kept its own version, which is what the
//   page should show until the person drops or re-saves the edit.
// Anything else (an unknown list, a path Kitchen never writes) is returned in `unknown`, for the caller to report.

/** @typedef {Record<string, any>} Item */
/** @typedef {Record<string, any>} KitchenData the kitchen as `GET /data/kitchen` answers it */
/** @typedef {{ method: string, path: string, body?: any, state?: string }} Edit one entry of the kit's queue */
/** @typedef {{ kind: "replace" | "delete", list: string, id: string } | { kind: "settings" } | { kind: "take", id: string }} EditShape */

/** The settings route (one object, merged by PATCH). */
export const SETTINGS_PATH = "/data/settings";

const ITEM_PATH = /^\/data\/([a-z_]+)\/([^/?#]+)$/;
const TAKE_PATH = /^\/data\/freezer\/([^/?#]+)\/take$/;

/** The freezer take route of item `id`, as api.js writes it. @param {string} id */
export const takePath = (id) => `/data/freezer/${encodeURIComponent(id)}/take`;

/** The item route of `id` in `list`, as api.js writes it. @param {string} list @param {string} id */
export const itemPath = (list, id) => `/data/${list}/${encodeURIComponent(id)}`;

/** A path segment unescaped, or null for a malformed escape (not a path api.js wrote). @param {string} raw */
function decoded(raw) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

/**
 * The freezer with `n` portions taken off item `id` (negative puts back), never below zero; null when the item is not
 * there. @param {Item[]} freezer @param {string} id @param {number} n @returns {Item[] | null}
 */
export function takeFrom(freezer, id, n) {
  const item = freezer.find((x) => x.id === id);
  if (!item) return null;
  const left = Math.max(0, Number(item.portions ?? 0) - n);
  return replaceItem(freezer, { ...item, portions: left });
}

/**
 * What a queued edit does, or null when it is not one of Kitchen's edit shapes.
 * @param {Edit} edit @returns {EditShape | null}
 */
export function shapeOf(edit) {
  if (edit.method === "PATCH" && edit.path === SETTINGS_PATH) return { kind: "settings" };
  const take = edit.method === "POST" ? TAKE_PATH.exec(edit.path) : null;
  if (take) {
    const id = decoded(take[1]);
    return id === null ? null : { kind: "take", id };
  }
  const m = ITEM_PATH.exec(edit.path);
  if (!m) return null;
  const id = decoded(m[2]);
  if (id === null) return null;
  if (edit.method === "PUT") return { kind: "replace", list: m[1], id };
  if (edit.method === "DELETE") return { kind: "delete", list: m[1], id };
  return null;
}

/**
 * The settings with `patch` merged in as the server merges it: a key set to `null` is removed.
 * @param {Record<string, unknown>} settings @param {Record<string, unknown>} patch
 */
export function mergeSettings(settings, patch) {
  const next = { ...settings };
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value === null) delete next[key];
    else next[key] = value;
  }
  return next;
}

/** `items` with `item` in the place of the one with its id, or added at the end. @param {Item[]} items @param {Item} item */
export function replaceItem(items, item) {
  const at = items.findIndex((x) => x.id === item.id);
  if (at < 0) return [...items, item];
  return items.map((x, i) => (i === at ? item : x));
}

/** `items` without the one with `id`. @param {Item[]} items @param {string} id */
export const removeItem = (items, id) => items.filter((x) => x.id !== id);

/**
 * One edit laid over the kitchen; a new top-level object, only the touched list or the settings copied. Null when the
 * edit does not fit this kitchen (unknown shape or list, a PUT without a body).
 * @param {KitchenData} kitchen @param {Edit} edit @returns {KitchenData | null}
 */
export function applyEdit(kitchen, edit) {
  const shape = shapeOf(edit);
  if (!shape) return null;
  if (shape.kind === "settings") return { ...kitchen, settings: mergeSettings(kitchen.settings ?? {}, edit.body ?? {}) };
  if (shape.kind === "take") {
    const freezer = Array.isArray(kitchen.freezer) ? takeFrom(kitchen.freezer, shape.id, Number(edit.body?.portions ?? 1)) : null;
    return freezer ? { ...kitchen, freezer } : null;
  }
  const items = kitchen[shape.list];
  if (!Array.isArray(items)) return null;
  if (shape.kind === "delete") return { ...kitchen, [shape.list]: removeItem(items, shape.id) };
  if (!edit.body || typeof edit.body !== "object") return null;
  return { ...kitchen, [shape.list]: replaceItem(items, { ...edit.body, id: shape.id }) };
}

/**
 * Every waiting edit laid over the kitchen in queue order; failed edits are skipped (the server's version stands).
 * @param {KitchenData} kitchen @param {Edit[]} edits the kit's queue, oldest first
 * @returns {{ kitchen: KitchenData, unknown: Edit[] }}
 */
export function applyQueued(kitchen, edits) {
  let next = kitchen;
  /** @type {Edit[]} */
  const unknown = [];
  for (const edit of edits) {
    if (edit.state === "failed") continue;
    const applied = applyEdit(next, edit);
    if (applied) next = applied;
    else unknown.push(edit);
  }
  return { kitchen: next, unknown };
}

/**
 * The waiting delete of an item, if one still waits to be sent (Undo then drops it instead of asking the server to
 * restore an item it never deleted). Only a `queued` entry: a held or failed one is the failed list's business.
 * @template {Edit & { id: number }} E
 * @param {E[]} edits @param {string} list @param {string} id @returns {E | null}
 */
export function queuedDeleteOf(edits, list, id) {
  const path = itemPath(list, id);
  return edits.find((e) => e.method === "DELETE" && e.path === path && e.state === "queued") ?? null;
}
