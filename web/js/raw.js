// Requests that are not JSON calls: a picture sent as it is, a file removed. api.js owns the JSON calls and the one copy of
// the data; the two recipe modules that talk to the server in other shapes (recipe/photos.js, recipe/cover.js) come through
// here, so the credentials and the signed-out handling live in one place. The error words stay the caller's own.

/** Signed out: open the login page, and come back to this screen after it. */
export function toLogin() {
  location.assign(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
}

/**
 * Send a request with the session's credentials. A dropped connection throws `dropped`, a 401 opens the login page and
 * throws `signedOut`; any other answer is returned for the caller to read.
 * @param {string} path @param {RequestInit} init @param {{ dropped: string, signedOut: string }} words @returns {Promise<Response>}
 */
export async function sendRaw(path, init, { dropped, signedOut }) {
  let res;
  try {
    res = await fetch(path, { ...init, credentials: "same-origin" });
  } catch {
    throw new Error(dropped);
  }
  if (res.status === 401) {
    toLogin();
    throw new Error(signedOut);
  }
  return res;
}

/** Remove a file; a dropped connection rejects, any answer resolves (no sign-out handling: a failed removal is harmless). @param {string} path */
export const deleteRaw = (path) => fetch(path, { method: "DELETE", credentials: "same-origin" });
