// The one notice a page shows when one of its calls was refused for want of a login (chassis-rs 4.2.0: 401 JSON). The
// kit's toast says so in the page's language and carries a real link to the login in this tab, which comes back to this
// page afterwards (api/login-link.js `loginHref`); signed in again meanwhile (another tab shares the cookie), the kit's
// login sends the visit straight back to this page (chassis-rs 4.8.0 honours `next` for a live session).
// Several refused calls in a row (a burst of saves) show it once.

import { toast } from "/static/kp/dist/js/overlays.js";
import { h } from "../dom.js";
import { t } from "../i18n/index.js";
import { loginHref, signedOutWords } from "./login-link.js";

/** The notice now on screen. @type {HTMLElement | null} */
let shown = null;

/** Say the cook is signed out and offer the login, once while the notice is on screen. */
export function signedOutNotice() {
  if (shown?.isConnected) return;
  const words = signedOutWords(t);
  const link = h("a", { href: loginHref(location) }, words.link);
  shown = toast(h("span", null, `${words.note} `, link), { live: "assertive", sticky: true });
}
