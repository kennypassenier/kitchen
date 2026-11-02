// Where a signed-out page sends the cook to sign in, and the words it shows. Pure (no DOM, no kit, no fetch), so
// scripts/signed-out.test.mjs tests it; api/signed-out.js draws the notice with it.
//
// Since chassis-rs 4.2.0 a script call without a login is answered 401 `{"error": "not logged in", ...}` instead of a 303
// to the login page that `fetch` followed into a 200 HTML page. A page load still gets the 303, so only the page's own
// calls meet the 401: the page stays where it is, with what was typed in it, and offers the login in a NEW tab. The kit's
// login always lands on `/` afterwards (it reads no `next`, chassis-rs 4.2.0; kp-gaps/chassis-rs.md), so signing in in
// this tab would lose the screen; the session cookie is shared, so a retry here works once the other tab is signed in.

/** The kit's login page. */
export const LOGIN_PATH = "/login";

/** Whether an answer is the kit's "not logged in" refusal. @param {number} status */
export const isSignedOut = (status) => status === 401;

/**
 * The notice's words in the page's language.
 * @param {(key: string) => string} t
 * @returns {{ note: string, link: string }}
 */
export const signedOutWords = (t) => ({ note: t("api.signedOutNote"), link: t("api.signIn") });
