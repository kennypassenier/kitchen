// After the kit replayed waiting edits (feat-offline-kitchen, fix-offline-master-1): the shared kitchen copy is read
// again, so the page shows what the server holds now. The server is always the master (Kenny, 02/11/2026 19:43): an
// edit the page showed at once while it waited (a freezer take's optimistic count, a dish saved offline) is replaced
// by the server's answer as soon as the server answered it, whether it took the edit or refused it.
//
// - A replay that SENT something: every item carries the revision the server gave it. Without the read the next save
//   of an item edited offline would name the revision it was read at, which the replay just raised, and be refused as
//   stale. (The kit raises the revisions of edits still queued behind it, its rebase; this covers later edits.)
// - A replay that REFUSED something (a 409 or another 4xx moved it to the kit's failed list): the page's copy still
//   holds the edit as it was shown while it waited, e.g. a portion taken that the freezer did not have. The server kept
//   its own version, so the copy is read again and the refused edit only lives on in the kit's failed list (Discard /
//   Save again). The kit says so per entry (`chassis-data-conflict`) before its summary (`chassis-data-synced`).

/** The kit's event after a replay: `{ sent, remaining, stopped }` (chassis-rs data-queue.js). */
export const SYNCED_EVENT = "chassis-data-synced";

/** The kit's event for each edit a replay refused, `{ entry }`, sent before the replay's summary (data-client.js). */
export const REFUSED_EVENT = "chassis-data-conflict";

/**
 * Whether a replay changed what the page should show, so the copy must be read again: it sent something, or the
 * server refused something since the last summary.
 * @param {{ sent?: unknown } | null | undefined} summary @param {boolean} [refused] an edit was refused in this replay
 */
export const needsReread = (summary, refused = false) => refused || (typeof summary?.sent === "number" && summary.sent > 0);

/**
 * Read the kitchen again after every replay that sent or refused something; returns the clean-up.
 * @param {() => Promise<unknown>} reread api.js `loadKitchen({ force: true })`
 */
export function wireSync(reread) {
  let refused = false;
  const onRefused = () => {
    refused = true;
  };
  const onSynced = (/** @type {Event} */ e) => {
    const wanted = needsReread(/** @type {CustomEvent} */ (e).detail, refused);
    refused = false;
    if (!wanted) return;
    void reread().catch((err) => console.warn("Kitchen: reading the kitchen again after the kit replayed queued edits failed", err));
  };
  addEventListener(REFUSED_EVENT, onRefused);
  addEventListener(SYNCED_EVENT, onSynced);
  return () => {
    removeEventListener(REFUSED_EVENT, onRefused);
    removeEventListener(SYNCED_EVENT, onSynced);
  };
}

/**
 * Whether the held kitchen must be read again before it is served (fix-offline-master-3): only when it came from the
 * device's copy and no read is already on its way. A copy the kitchen answered is served from memory as before.
 * @param {boolean} heldFromCopy the held kitchen came from the offline copy @param {boolean} reading a read is in flight
 */
export const refreshNeeded = (heldFromCopy, reading) => heldFromCopy && !reading;
