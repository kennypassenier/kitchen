// After the kit sent waiting edits (feat-offline-kitchen): the shared kitchen copy is read again, so every item carries
// the revision the server gave it. Without this the next save of an item edited offline would name the revision it was
// read at, which the replay just raised, and be refused as stale. The kit raises the revisions of edits still queued
// behind it (its rebase); this covers the edits made after the queue emptied.

/** The kit's event after a replay: `{ sent, remaining, stopped }` (chassis-rs data-queue.js). */
export const SYNCED_EVENT = "chassis-data-synced";

/** Whether a replay changed what the server holds, so the copy must be read again. @param {{ sent?: unknown } | null | undefined} summary */
export const needsReread = (summary) => typeof summary?.sent === "number" && summary.sent > 0;

/**
 * Read the kitchen again after every replay that sent something; returns the clean-up.
 * @param {() => Promise<unknown>} reread api.js `loadKitchen({ force: true })`
 */
export function wireSync(reread) {
  const onSynced = (/** @type {Event} */ e) => {
    if (!needsReread(/** @type {CustomEvent} */ (e).detail)) return;
    void reread().catch((err) => console.warn("Kitchen: reading the kitchen again after sending queued edits failed", err));
  };
  addEventListener(SYNCED_EVENT, onSynced);
  return () => removeEventListener(SYNCED_EVENT, onSynced);
}
