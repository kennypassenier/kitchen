// Leaving the recipe editor: the decision, kept pure so node can test it (scripts/editor-leave.test.mjs).
//
// Closing by Escape, the close button or Cancel never throws work away by itself (Kenny, 2026-11-01, ux-review fix 1):
// a form that changed asks, and the answer says what happens to the server-side draft and to the photos this session sent.

/** What the answer to the question does. */
export const KEEP = "keep";
export const DISCARD = "discard";

/**
 * Whether the form differs from how it opened. Both sides are the draft JSON (`collect(true)`).
 * @param {string} opening @param {string} now
 */
export const isChanged = (opening, now) => opening !== now;

/**
 * What a close does first: close silently, or ask. @param {boolean} changed
 * @returns {"close" | "ask"}
 */
export const onClose = (changed) => (changed ? "ask" : "close");

/**
 * What an answer costs. `keep`: the draft is written once more and stays, the photos stay with it. `discard`: the draft
 * and this session's photos go. An unknown answer (the question closed any other way) is `keep`: never lose by accident.
 * @param {string | undefined} choice
 * @returns {{ saveDraft: boolean, dropDraft: boolean, dropPhotos: boolean }}
 */
export function outcomeOf(choice) {
  if (choice === DISCARD) return { saveDraft: false, dropDraft: true, dropPhotos: true };
  return { saveDraft: true, dropDraft: false, dropPhotos: false };
}
