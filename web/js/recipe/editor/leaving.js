// Cancel, the close button and Escape: a changed form asks "Keep as draft" or "Discard" with the package's confirmation
// dialog; an unchanged one closes without a question. Only Save and Discard delete the draft.

import { closeDialog, openConfirmation } from "/static/kp/dist/kp-themes.min.js";
import { t } from "../../i18n/index.js";
import { DISCARD, KEEP, isChanged, onClose, outcomeOf } from "./leave.js";

/**
 * @param {HTMLDialogElement} dialog
 * @param {{ tracker: any, draft: ReturnType<typeof import("./draft.js").createDraft> }} p
 * @param {() => string} now the form as draft JSON
 * @param {HTMLElement} cancel
 * @returns {() => void} close
 */
export function wireLeaving(dialog, { tracker, draft }, now, cancel) {
  const close = () => void closeDialog(dialog);
  /** @param {string} choice */
  const settle = async (choice) => {
    const out = outcomeOf(choice);
    if (out.saveDraft) await draft.flush();
    if (out.dropPhotos) await tracker.discard();
    if (out.dropDraft) await draft.drop();
    close();
  };
  let asking = false;
  const leave = (/** @type {HTMLElement} */ from) => {
    if (asking) return;
    if (onClose(isChanged(draft.opening, now())) === "close") return close();
    asking = true;
    openConfirmation(from, {
      phrase: t("edit.leaveAsk"),
      description: t("edit.leaveText"),
      acceptLabel: t("edit.leaveDiscard"),
      strings: { confirmCancel: t("edit.leaveKeep") },
      initialFocus: "cancel",
      onAccept: () => void settle(DISCARD).finally(() => (asking = false)),
      // Escape on the question, or Keep as draft, both keep the work.
      onCancel: () => void settle(KEEP).finally(() => (asking = false)),
    });
  };
  const closeButton = /** @type {HTMLElement} */ (dialog.querySelector("[data-close]"));
  cancel.addEventListener("click", () => leave(cancel));
  closeButton?.addEventListener("click", () => leave(closeButton));
  // One Escape handler per opening: an editor re-opened on a restored draft replaces the one before it.
  const again = /** @type {any} */ (dialog);
  again.__rlAbort?.abort();
  again.__rlAbort = new AbortController();
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    leave(cancel);
  }, { signal: again.__rlAbort.signal });
  return close;
}
