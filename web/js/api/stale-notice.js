// The one answer a quick action gives when its save was refused as stale (fix-quick-rev-1): the safe toggle, a reorder,
// make default, Undo. Someone saved the item in another tab or on another device after this page read it, so nothing
// was overwritten; the kit's toast says so in the page's language with a Reload button, and the shared copy is read
// again so the page shows what is stored now. Any other refusal keeps the caller's own toast. The recipe editor and the
// dish drawer have their own answer in their form (fix-stale-save-1) and do not come through here.

import { toast } from "/static/kp/dist/kp-themes.min.js";
import { loadKitchen } from "../api.js";
import { t } from "../i18n/index.js";
import { isStale } from "./save.js";

/** The stale toast now on screen, so several refused saves in a row (a reorder) show it once. @type {HTMLElement | null} */
let shown = null;

/** Say the item changed elsewhere, offer Reload, and read the kitchen again. */
function staleNotice() {
  if (!shown?.isConnected) {
    shown = toast(t("api.staleQuick"), { live: "assertive", sticky: true, action: { label: t("api.staleReload"), onClick: () => location.reload() } });
  }
  loadKitchen({ force: true }).catch((e) => console.warn("reading the kitchen again after a stale save failed", e));
}

/**
 * A quick action's save failed: the stale notice when it was refused as stale, else the caller's own words in a toast
 * that stays until it is read.
 * @param {unknown} e the error the save threw @param {() => string} words the caller's toast for any other failure
 */
export function saveFailed(e, words) {
  if (isStale(e)) staleNotice();
  else toast(words(), { live: "assertive", sticky: true });
}
