// Starting the offline side on every page (feat-offline-kitchen; on the kit's local database since feat-db-pages-1),
// called once by main.js: the kit is configured (and Kenny's "keep everything offline" default applied) before the
// first read; the connection band follows the reads and the kit's pulls; and whenever the kit changes the local
// database by itself (a pull on reconnect, focus, a hint or the 5-minute timer, the replay of waiting edits, the queue
// moving), the shared kitchen is built again from it, so every screen shows what the server holds (Kenny 02/11/2026
// 19:43: the server is always the master). A refused replay leaves the kit's failed list and its overlay, so the
// rebuilt kitchen shows the server's version. The kit's own drawer lists the refused edits (its toast's "Review").

import { kitData } from "../api/kit-data.js";
import { watchGoneDishes } from "../api/recipe-gone.js";
import { loadKitchen, kitchenNow } from "../api.js";
import { wireBand } from "./band.js";
import { LISTS, SETTINGS_COLLECTION } from "./config.js";

/** One rebuild for a burst of changes (the kit merges a burst per collection; several collections come together). */
const REBUILD_MS = 50;

/**
 * Build the shared kitchen again from the local database whenever a collection changed; returns the clean-up. Only
 * once the page holds a kitchen: before that, the first read builds it anyway.
 * @param {import("../api/kit-data.js").KitDb} db
 */
export function wireRebuild(db) {
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;
  const rebuild = () => {
    timer = null;
    if (!kitchenNow()) return;
    void loadKitchen({ force: true, pull: false }).catch((e) => console.warn("Kitchen: building the kitchen again after the kit's pull failed", e));
  };
  const offs = [...LISTS, SETTINGS_COLLECTION].map((name) =>
    db.collection(name).watch(() => {
      if (timer === null) timer = setTimeout(rebuild, REBUILD_MS);
    }),
  );
  return () => {
    offs.forEach((off) => off());
    if (timer !== null) clearTimeout(timer);
  };
}

/** Wire everything; a kit that cannot start is reported by kitData() itself and every read shows its failed state. */
export function startOffline() {
  void kitData()
    .then((kit) => {
      wireRebuild(kit.db);
      return watchGoneDishes();
    })
    .catch(() => {}); // the rejection is reported once in kitData(); each page shows its own failed state
  wireBand(document, () => loadKitchen({ force: true }));
}
