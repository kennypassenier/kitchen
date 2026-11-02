// The JSON calls: one fetch wrapper, its error type and the words for an error. No state; api.js holds the data.

import { toLogin } from "../raw.js";
import { t } from "../i18n/index.js";
import { failureOf, headersFor } from "./save.js";

export class ApiError extends Error {
  /**
   * `limit`: a size refusal's field and limit (api/refusal.js), so an editor can show it at that field. `code`: the
   * server's machine word for the refusal, when it gives one (`"stale"`: saved elsewhere since it was read, fix-stale-save-1).
   * @param {string} message @param {number} status @param {import("./refusal.js").LimitRefusal | null} [limit] @param {string} [code]
   */
  constructor(message, status, limit = null, code = "") {
    super(message);
    this.status = status;
    this.limit = limit;
    this.code = code;
  }
}

/** The words for an error: api.js messages are fit to show as they are. @param {unknown} e */
export const reason = (e) => (e instanceof Error ? e.message : String(e));

/**
 * `keepalive`: the request outlives the page (a draft written while the tab closes). `ifMatch`: the item's `rev` as the
 * page read it; the server refuses the change (409, code "stale") when it was saved since (fix-stale-save-1).
 * @param {string} method @param {string} path @param {unknown} [body] @param {{ keepalive?: boolean, ifMatch?: number }} [o]
 */
export async function call(method, path, body, { keepalive = false, ifMatch } = {}) {
  // The If-Match and the refusal's words come from one place for every save (api/save.js, fix-quick-rev-1).
  const headers = headersFor(body, ifMatch);
  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      keepalive,
    });
  } catch {
    throw new ApiError("The connection to the kitchen dropped. Nothing is lost; try again.", 0);
  }
  if (res.status === 401) {
    toLogin();
    throw new ApiError("Signed out; opening the login page.", 401);
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON: handled below */
  }
  if (!res.ok) {
    const { words, limit, code } = failureOf(res.status, data, t);
    throw new ApiError(words, res.status, limit, code);
  }
  return data;
}
