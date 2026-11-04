// The one notice a page shows when one of its calls was refused for want of a login (chassis-rs 4.2.0: 401 JSON). The
// kit's toast says so in the page's language and carries a real link to the login in this tab, which comes back to this
// page afterwards (api/login-link.js `loginHref`). Signed in again meanwhile (another tab shares the cookie), the kit's
// login would send the visit to `/` and drop `next` (kp-gaps/chassis-rs.md 04/11/2026), so a press first asks the
// service whether the session is back and then simply reloads this page.
// Several refused calls in a row (a burst of saves) show it once.

import { toast } from "/static/kp/dist/js/overlays.js";
import { h } from "../dom.js";
import { t } from "../i18n/index.js";
import { SESSION_PROBE, loginHref, signedOutWords } from "./login-link.js";

/** The notice now on screen. @type {HTMLElement | null} */
let shown = null;

/** Say the cook is signed out and offer the login, once while the notice is on screen. */
export function signedOutNotice() {
  if (shown?.isConnected) return;
  const words = signedOutWords(t);
  const link = h("a", { href: loginHref(location) }, words.link);
  link.addEventListener("click", (event) => void reloadIfBack(event));
  shown = toast(h("span", null, `${words.note} `, link), { live: "assertive", sticky: true });
}

/** The page reload in place of the login when the session is back (a cheap logged-in read answers 200). @param {Event} event */
async function reloadIfBack(event) {
  event.preventDefault();
  const link = /** @type {HTMLAnchorElement} */ (event.currentTarget);
  try {
    const res = await fetch(SESSION_PROBE, { credentials: "same-origin", cache: "no-store" });
    if (res.ok) return location.reload();
  } catch (e) {
    console.warn("Kitchen: could not ask whether the login is back; opening the login page.", e);
  }
  location.assign(link.href);
}
