// @ts-check
// The kitchen put together from its individual endpoints: the fallback when `GET /data/kitchen` fails on the server
// (Kenny's API rule, 04/11/2026: a merged call first, the per-resource calls when it fails). Every part of the
// kitchen has its own GET built from the same store (docs/API.md "Parts of /data/kitchen"), so the object assembled
// here has the kitchen's shape. The parts are read side by side, not in one transaction, so they may differ by a
// moment; the next read replaces them. Pure apart from the injected `get`; tested in scripts/snapshot-parts.test.mjs.

import { KITCHEN_PATH, LISTS, SETTINGS_PATH } from "../offline/config.js";
import { FORMAT, settingsOf } from "../offline/assemble.js";

/** @typedef {import("../api.js").Kitchen} Kitchen */
/** @typedef {(path: string) => Promise<{ data: any }>} Get reads one endpoint, like `readJson` */

/** The code of the error raised for a 2xx answer that is not a kitchen. */
export const MALFORMED = "malformed";

/** @param {string} list The endpoint of one list. */
export const listPath = (list) => `/data/${list}`;

/**
 * Whether `data` has the shape of `GET /data/kitchen`: a format, every list as an array and the settings object.
 * @param {unknown} data @returns {boolean}
 */
export function isKitchen(data) {
  const k = /** @type {Record<string, unknown> | null} */ (data);
  if (!k || typeof k !== "object" || Array.isArray(k)) return false;
  if (typeof k.format !== "number") return false;
  if (!LISTS.every((name) => Array.isArray(k[name]))) return false;
  return typeof k.settings === "object" && k.settings !== null && !Array.isArray(k.settings);
}

/**
 * Whether a failed merged read is the server's fault (a 5xx, or an answer that is no kitchen): the only failures the
 * individual endpoints can cure. Offline (status 0) and signed out (401) are not: the parts would fail the same way.
 * @param {unknown} e @returns {boolean}
 */
export function isServerFault(e) {
  const { status, code } = /** @type {{ status?: unknown, code?: unknown }} */ (e ?? {});
  return code === MALFORMED || (typeof status === "number" && status >= 500);
}

/**
 * The kitchen from its parts: each list from `GET /data/<list>`, the settings and their revision from the settings
 * item (`{id, rev, ..keys}`). The format is the one this build reads (assemble.js `FORMAT`), as no endpoint says it.
 * @param {Get} get @returns {Promise<Kitchen>}
 */
export async function kitchenFromParts(get) {
  const [rows, settings] = await Promise.all([Promise.all(LISTS.map((name) => get(listPath(name)))), get(SETTINGS_PATH)]);
  /** @type {Record<string, any[]>} */
  const lists = {};
  LISTS.forEach((name, i) => {
    const answer = rows[i].data;
    if (!Array.isArray(answer)) throw Object.assign(new Error(`GET ${listPath(name)} did not answer a list`), { code: MALFORMED });
    lists[name] = answer;
  });
  return /** @type {Kitchen} */ ({ format: FORMAT, recipes: [], ...lists, ...settingsOf(settings.data) });
}

/**
 * `GET /data/kitchen`, else, when the server failed on it, the kitchen from its parts. A failed fallback throws its own
 * error (the page's failed state says it); any other failure of the merged call (offline, signed out) is thrown as it is.
 * @param {Get} get @returns {Promise<{ data: any }>}
 */
export async function readKitchenOrParts(get) {
  /** @type {unknown} */
  let first;
  try {
    const got = await get(KITCHEN_PATH);
    if (isKitchen(got.data)) return got;
    first = Object.assign(new Error("GET /data/kitchen did not answer a kitchen"), { code: MALFORMED });
  } catch (e) {
    first = e;
  }
  if (!isServerFault(first)) throw first;
  console.warn("Kitchen: GET /data/kitchen failed on the server; reading the kitchen from its individual endpoints", first);
  return { data: await kitchenFromParts(get) };
}
