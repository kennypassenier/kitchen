// Leaving the editor page with changes: a changed form asks "Keep as draft" or "Discard" with the package's confirmation
// dialog; an unchanged one goes at once. Only Save and Discard delete the draft (Kenny, 2026-11-01, ux-review fix 1); the
// decision itself is pure and lives in leave.js.

import { openConfirmation } from "/static/kp/dist/js/components.js";
import { t } from "../../i18n/index.js";
import { DISCARD, KEEP, onClose, outcomeOf } from "./leave.js";

/**
 * What an answer does to the draft and to the photos this session sent.
 * @param {{ tracker: any, draft: ReturnType<typeof import("./draft.js").createDraft> }} parts @param {string} choice
 */
export async function settle({ tracker, draft }, choice) {
  const out = outcomeOf(choice);
  if (out.saveDraft) await draft.flush(true);
  if (out.dropPhotos) await tracker.discard();
  if (out.dropDraft) await draft.drop();
}

/**
 * Ask before leaving a changed form, then run `go`. Escape on the question, like Keep as draft, keeps the work.
 * @param {HTMLElement} from the element the question returns focus to
 * @param {{ dirty: () => boolean, parts: { tracker: any, draft: ReturnType<typeof import("./draft.js").createDraft> } }} editor
 * @param {() => void} go the way on once the work is settled
 */
export function leaveWith(from, editor, go) {
  if (onClose(editor.dirty()) === "close") return go();
  /** @param {string} choice */
  const then = (choice) => void settle(editor.parts, choice).then(go, (e) => console.error("leaving the editor", e));
  openConfirmation(from, {
    phrase: t("edit.leaveAsk"),
    description: t("edit.leaveText"),
    acceptLabel: t("edit.leaveDiscard"),
    strings: { confirmCancel: t("edit.leaveKeep") },
    initialFocus: "cancel",
    onAccept: () => then(DISCARD),
    onCancel: () => then(KEEP),
  });
}
