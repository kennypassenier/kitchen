// The revision check every save goes through (fix-stale-save-1, fix-quick-rev-1): which `If-Match` a save sends, the
// headers of a JSON call, and how a refused answer becomes words and a machine code. Pure (no fetch, no DOM, no kit), so
// scripts/save-rev.test.mjs tests it; api/http.js does the fetch with it and api.js decides the revision per list.
//
// Every item of a collection carries an optional whole-number `rev` (absent counts as 0); a `PUT /data/{list}/{id}` with
// `If-Match: <rev>` is refused with 409 `{"code": "stale", "rev": <stored>}` when the stored revision differs, so a page
// that read the item before someone else saved it never overwrites that save (docs/agent/DATA.md "Revisions and stale
// saves"). A recipe lives in its dish, so a recipe's revision is its dish's (`dish_rev` in the recipe view).

import { limitOf, limitWords } from "./refusal.js";

/** @typedef {Record<string, any>} Item */
/** @typedef {(key: string, ...args: any[]) => string} Words */

/**
 * The revision an item was read at, as the server counts it: a missing `rev` is 0. A value that is no whole number
 * (never written by the server) also counts as 0, so the save is refused rather than sent without a check.
 * @param {Item | null | undefined} item @param {string} [field] `rev`, or `dish_rev` for a recipe from the view
 * @returns {number}
 */
export function revOf(item, field = "rev") {
  const raw = item?.[field];
  return Number.isSafeInteger(raw) && raw >= 0 ? raw : 0;
}

/**
 * The `If-Match` a save of `item` to `list` sends: the caller's own revision when it gives one (`explicit`: the recipe
 * editor's `dish_rev`, the dish drawer's `rev`), else the revision the body carries, which is the one the page read (a
 * quick action spreads the item it read: `{ ...r, safe: false }`). A body without one (built field by field) falls back
 * to `held`, the item as this page's copy holds it, which is still what this page read. A recipe's revision is its
 * dish's: `dish_rev` in the body, else the held dish's `rev`.
 * @param {string} list @param {Item} item @param {{ explicit?: number, held?: Item | null }} [o]
 * @returns {number}
 */
export function ifMatchFor(list, item, { explicit, held } = {}) {
  if (typeof explicit === "number") return explicit;
  const field = list === "recipes" ? "dish_rev" : "rev";
  return item && field in item ? revOf(item, field) : revOf(held);
}

/**
 * The headers of a JSON call: the content type when there is a body, and `If-Match` when a revision is given.
 * @param {unknown} body @param {number} [ifMatch]
 * @returns {Record<string, string>}
 */
export function headersFor(body, ifMatch) {
  /** @type {Record<string, string>} */
  const headers = body === undefined ? {} : { "Content-Type": "application/json" };
  if (typeof ifMatch === "number") headers["If-Match"] = String(ifMatch);
  return headers;
}

/**
 * A refused answer as the page shows it: a size refusal in the page's language naming the field (fix-field-limits-1), a
 * stale save in the page's language (fix-stale-save-1), any other in the server's own words.
 * @param {number} status @param {any} data the parsed body, or null @param {Words} t
 * @returns {{ words: string, limit: import("./refusal.js").LimitRefusal | null, code: string }}
 */
export function failureOf(status, data, t) {
  const limit = limitOf(data);
  const code = typeof data?.code === "string" ? data.code : "";
  const stale = status === 409 && code === "stale";
  const words = limit ? limitWords(limit, t) : stale ? t("api.stale") : (data?.error ?? `The kitchen answered ${status}.`);
  return { words, limit, code };
}

/** Whether an error is the server's stale refusal (409, code "stale"). @param {unknown} e */
export const isStale = (e) => {
  const err = /** @type {{ status?: unknown, code?: unknown } | null} */ (e && typeof e === "object" ? e : null);
  return err?.status === 409 && err?.code === "stale";
};
