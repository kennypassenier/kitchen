// Starting the offline copy on every page (feat-offline-kitchen), called once by main.js: the kit is configured (and
// Kenny's "keep everything offline" default applied) before the first read, the connection band follows the reads, the
// copy is read again after the kit sent waiting edits, and a kitchen read from the device's copy is read again when the
// browser is back online (fix-offline-master-3: the server is the master). The kit's own drawer lists the refused edits
// (its toast's "Review").

import { kitData } from "../api/kit-data.js";
import { loadKitchen, refreshIfOffline } from "../api.js";
import { wireBand } from "./band.js";
import { wireSync } from "./sync.js";

/** Wire everything; a kit that cannot start is reported by kitData() itself and every read shows its failed state. */
export function startOffline() {
  void kitData().catch(() => {}); // the rejection is reported once in kitData(); each page shows its own failed state
  const reread = () => loadKitchen({ force: true });
  wireBand(document, reread);
  wireSync(reread);
  addEventListener("online", refreshIfOffline);
}
