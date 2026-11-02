// The JSON calls: one fetch wrapper, its error type and the words for an error. No state; api.js holds the data.

import { toLogin } from "../raw.js";
import { t } from "../i18n/index.js";
import { limitOf, limitWords } from "./refusal.js";

export class ApiError extends Error {
  /**
   * `limit`: a size refusal's field and limit (api/refusal.js), so an editor can show it at that field.
   * @param {string} message @param {number} status @param {import("./refusal.js").LimitRefusal | null} [limit]
   */
  constructor(message, status, limit = null) {
    super(message);
    this.status = status;
    this.limit = limit;
  }
}

/** The words for an error: api.js messages are fit to show as they are. @param {unknown} e */
export const reason = (e) => (e instanceof Error ? e.message : String(e));

/** `keepalive`: the request outlives the page (a draft written while the tab closes). @param {string} method @param {string} path @param {unknown} [body] @param {{ keepalive?: boolean }} [o] */
export async function call(method, path, body, { keepalive = false } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
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
    // A size refusal is said in the page's language and names the field (fix-field-limits-1); any other keeps the server's words.
    const limit = limitOf(data);
    throw new ApiError(limit ? limitWords(limit, t) : (data?.error ?? `The kitchen answered ${res.status}.`), res.status, limit);
  }
  return data;
}
