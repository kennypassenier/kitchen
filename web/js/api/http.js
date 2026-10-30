// The JSON calls: one fetch wrapper, its error type and the words for an error. No state; api.js holds the data.

import { toLogin } from "../raw.js";

export class ApiError extends Error {
  /** @param {string} message @param {number} status */
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/** The words for an error: api.js messages are fit to show as they are. @param {unknown} e */
export const reason = (e) => (e instanceof Error ? e.message : String(e));

/** @param {string} method @param {string} path @param {unknown} [body] */
export async function call(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
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
  if (!res.ok) throw new ApiError(data?.error ?? `The kitchen answered ${res.status}.`, res.status);
  return data;
}
