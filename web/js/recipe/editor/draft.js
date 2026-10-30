// The draft: saved in the database about a second after the last change (Kenny, 29/10/2026). Deleted on Save and on
// Cancel / Discard; what stays is what a closed tab or a dropped connection left.

import { saveDraft, deleteDraft, readDraft } from "../../api.js";
import { h } from "../../dom.js";
import { t } from "../../i18n/index.js";
import { stamp } from "../../format.js";

const DRAFT_MS = 1000;
/** The events after which the draft is saved again. */
const DRAFT_EVENTS = ["input", "change", "click", "kp-quantity-change", "rl-rows-change", "kp-combobox-change", "rl-photos-change"];

/** @param {{ draftKey: string, collect: (forDraft?: boolean) => Record<string, any> }} o */
export function createDraft({ draftKey, collect }) {
  /** @type {number} */
  let timer = 0;
  let chain = Promise.resolve();
  let gone = false;
  let opening = "";
  const write = async () => {
    if (gone) return;
    const now = collect(true);
    if (JSON.stringify(now) === opening) return;
    await saveDraft(draftKey, now).catch(() => {}); // a draft that cannot be saved must never get in the way of editing
  };
  return {
    /** The form as it opened: a draft equal to it is not worth keeping. @param {string} json */
    setOpening: (json) => void (opening = json),
    get opening() {
      return opening;
    },
    get gone() {
      return gone;
    },
    queue: () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => (chain = chain.then(write)), DRAFT_MS);
    },
    drop: async () => {
      gone = true;
      clearTimeout(timer);
      await chain;
      await deleteDraft(draftKey).catch(() => {});
    },
    /** Stop saving (the editor is being replaced by one on a restored draft). */
    abandon: () => {
      gone = true;
      clearTimeout(timer);
    },
  };
}

/** Save the draft after every change in the form. @param {HTMLElement} form @param {ReturnType<typeof createDraft>} draft */
export function watchDraft(form, draft) {
  for (const type of DRAFT_EVENTS) form.addEventListener(type, draft.queue);
}

/**
 * An earlier session's draft is offered, not applied: Restore opens the editor again on it, Discard deletes it.
 * @param {{ draftKey: string, draft: ReturnType<typeof createDraft>, offer: HTMLElement, dialog: HTMLDialogElement, restoreWith: (data: Record<string, any>) => void }} o
 */
export function offerEarlierDraft({ draftKey, draft, offer, dialog, restoreWith }) {
  void readDraft(draftKey)
    .then((found) => {
      if (!found || draft.gone || !dialog.isConnected || JSON.stringify(found.data) === draft.opening) return;
      const restoreButton = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--primary" }, t("edit.draftRestore"));
      const discardButton = h("button", { type: "button", class: "kp-button kp-button--sm" }, t("edit.draftDiscard"));
      offer.replaceChildren(h("div", { class: "kp-alert__body" }, h("strong", null, t("edit.draftAsk", stamp(found.saved))), " ", t("edit.draftText")), h("div", { class: "kp-row-actions" }, restoreButton, discardButton));
      offer.hidden = false;
      restoreButton.addEventListener("click", () => {
        draft.abandon();
        restoreWith(found.data);
      });
      discardButton.addEventListener("click", () => {
        offer.hidden = true;
        void deleteDraft(draftKey).catch(() => {});
      });
    })
    .catch(() => {});
}
