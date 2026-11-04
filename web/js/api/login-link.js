// Where a signed-out page sends the cook to sign in, and the words it shows. Pure (no DOM, no kit, no fetch), so
// scripts/signed-out.test.mjs tests it; api/signed-out.js draws the notice with it.
//
// A script call without a login is answered 401 `{"error": "not logged in", ...}` (chassis-rs 4.2.0); a page load gets
// the kit's redirect to its login. The notice offers the login in the SAME tab (Kenny 04/11/2026), with `?next=` set to
// this page, so the kit's login comes back here afterwards (it reads `next` since chassis-rs 4.7.0 and takes only a
// same-origin path). Edits waiting in the kit's queue stay stored on the device and are sent after the login.

/** The kit's login page. */
export const LOGIN_PATH = "/login";

/**
 * The login link that returns to `here` (`location`): the path and query, as the kit's `next` takes them.
 * @param {{ pathname: string, search: string }} here @returns {string}
 */
export const loginHref = (here) => `${LOGIN_PATH}?next=${encodeURIComponent(`${here.pathname}${here.search}`)}`;

/** Whether an answer is the kit's "not logged in" refusal. @param {number} status */
export const isSignedOut = (status) => status === 401;

/**
 * The notice's words in the page's language.
 * @param {(key: string) => string} t
 * @returns {{ note: string, link: string }}
 */
export const signedOutWords = (t) => ({ note: t("api.signedOutNote"), link: t("api.signIn") });
