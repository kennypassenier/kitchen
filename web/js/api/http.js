// The JSON calls outside the kit: one fetch wrapper, its error type and the words for an error. No state; api.js holds
// the data. Since refactor-rev-kit-1 and feat-offline-kitchen every GET, PUT, PATCH and DELETE goes through the kit's data client (api/kit-data.js),
// which owns If-Match, the offline copy and the write queue; the kit has no POST, so a create, a draft, an import, a freezer take and
// Undo's restore come through here and need a connection (the server issues the ids).

import { t } from "../i18n/index.js";
import { failureOf, headersFor } from "./save.js";
import { isSignedOut } from "./login-link.js";
import { signedOutNotice } from "./signed-out.js";

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
 * `keepalive`: the request outlives the page (a draft written while the tab closes).
 * @param {string} method @param {string} path @param {unknown} [body] @param {{ keepalive?: boolean }} [o]
 */
export async function call(method, path, body, { keepalive = false } = {}) {
  const headers = headersFor(body);
  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      keepalive,
    });
  } catch (e) {
    // No answer: every call here is a POST the kit cannot queue (it has no POST), so the words say a connection is
    // needed rather than that the edit waits. `keepalive` drafts during a page close end here too and are reported.
    console.warn(`Kitchen: ${method} ${path} got no answer`, e);
    throw new ApiError(t("api.needsConnection"), 0, null, "offline");
  }
  // Signed out (chassis-rs 4.2.0 answers a script call 401 JSON): the page stays, the notice offers the login.
  if (isSignedOut(res.status)) {
    signedOutNotice();
    throw new ApiError(t("api.signedOut"), 401);
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
