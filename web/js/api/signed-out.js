// The one notice a page shows when one of its calls was refused for want of a login (chassis-rs 4.2.0: 401 JSON). The
// kit's toast says so in the page's language and carries a real link that opens the login in a new tab (api/login-link.js
// says why), so whatever was typed stays on screen and the call can be tried again here once signed in.
// Several refused calls in a row (a burst of saves) show it once.

import { toast } from "/static/kp/dist/js/overlays.js";
import { h } from "../dom.js";
import { t } from "../i18n/index.js";
import { LOGIN_PATH, signedOutWords } from "./login-link.js";

/** The notice now on screen. @type {HTMLElement | null} */
let shown = null;

/** Say the cook is signed out and offer the login, once while the notice is on screen. */
export function signedOutNotice() {
  if (shown?.isConnected) return;
  const words = signedOutWords(t);
  const content = h("span", null, `${words.note} `, h("a", { href: LOGIN_PATH, target: "_blank", rel: "noopener" }, words.link));
  shown = toast(content, { live: "assertive", sticky: true });
}
