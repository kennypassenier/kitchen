// The kit's connection band on Kitchen's pages (feat-offline-kitchen). The kit paints it for its write queue (pending
// count, "reconnecting" while a replay runs, chassis-rs data-band.js); this adds what only Kitchen sees: a READ that
// fell back to the device's copy says "offline", the next read that reached the kitchen brings the band back, and the
// band's Retry reads the kitchen again (the kit's own Retry handler replays the queue next to it).
//
// The band itself is kp-themes' connection component in index.html (`[data-kp-connection]`), attached by kp's auto.js;
// its Dutch words are in i18n/kp-nl/connection.js.

import { connectionOf, setConnection } from "/static/kp/dist/js/connection.js";
import { READ_EVENT } from "../api/kit-data.js";

/** The band of the page, or null when the page has none. @param {Document} doc */
const bandOf = (doc) => /** @type {HTMLElement | null} */ (doc.querySelector("[data-kp-connection]"));

/**
 * Paint the band for one read: offline from the copy, or back when it reached the kitchen while the band said offline.
 * The band's other states (reconnecting, refused) are the kit's replay and are left alone.
 * @param {HTMLElement} band @param {boolean} offline
 */
export function paintRead(band, offline) {
  const state = connectionOf(band)?.state() ?? "online";
  if (offline && state !== "offline") setConnection(band, "offline");
  else if (!offline && state === "offline") setConnection(band, "online");
}

/**
 * Wire the band; returns the clean-up. `reread` reads the kitchen again (api.js `loadKitchen({ force: true })`).
 * @param {Document} doc @param {() => Promise<unknown>} reread
 */
export function wireBand(doc, reread) {
  const band = bandOf(doc);
  if (!band) {
    console.warn("Kitchen: no connection band ([data-kp-connection]) on this page; the offline state is not shown.");
    return () => {};
  }
  const onRead = (/** @type {Event} */ e) => paintRead(band, /** @type {CustomEvent} */ (e).detail?.offline === true);
  const onRetry = () => void reread().catch((err) => console.warn("Kitchen: reading the kitchen again from the band's Retry failed", err));
  addEventListener(READ_EVENT, onRead);
  band.addEventListener("kp-connection-retry", onRetry);
  return () => {
    removeEventListener(READ_EVENT, onRead);
    band.removeEventListener("kp-connection-retry", onRetry);
  };
}
