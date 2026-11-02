// The draft: saved in the database about a second after the last change (Kenny, 29/10/2026). Deleted on Save and on an
// explicit Discard (never by leaving: recipe/editor/leaving.js); what stays is what a closed tab or a dropped connection left.

import { toast } from "/static/kp/dist/js/overlays.js";
import { saveDraft, deleteDraft, readDrafts } from "../../api.js";
import { offeredFor } from "../draft-keys.js";
import { h } from "../../dom.js";
import { t } from "../../i18n/index.js";
import { stamp } from "../../format.js";
import { writesOnHide } from "./leave.js";
import { createDraftNotice } from "./draft-notice.js";

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
  // A change whose autosave has not run yet: a reload or a closed tab within that second still writes it (`hide`).
  let pending = false;
  // A draft that cannot be saved must never get in the way of editing: a quiet toast, once until a save succeeds again.
  const notice = createDraftNotice({ show: () => toast(t("edit.draftNotSaved")) });
  /** @param {boolean} force write even when the form equals how it opened (Keep as draft on a copy or an import) */
  const write = async (force = false) => {
    pending = false;
    if (gone) return;
    const now = collect(true);
    if (!force && JSON.stringify(now) === opening) return;
    await saveDraft(draftKey, now).then(notice.succeeded, (e) => notice.failed(draftKey, e));
  };
  const self = {
    /** The form as it opened: a draft equal to it is not worth keeping. @param {string} json */
    setOpening: (json) => void (opening = json),
    get opening() {
      return opening;
    },
    get gone() {
      return gone;
    },
    queue: () => {
      pending = true;
      clearTimeout(timer);
      timer = window.setTimeout(() => (chain = chain.then(() => write())), DRAFT_MS);
    },
    /** The page is going away: write a waiting change now, in a request that outlives the page. */
    hide: () => {
      const now = JSON.stringify(collect(true));
      if (!writesOnHide({ pending, gone, now, opening })) return;
      pending = false;
      clearTimeout(timer);
      void saveDraft(draftKey, JSON.parse(now), { keepalive: true }).catch((e) => console.error("the draft was not written on leaving", e));
    },
    /** Write the draft now (leaving must not lose the last second of typing). `force`: even when nothing changed since it opened. @param {boolean} [force] */
    flush: async (force = false) => {
      clearTimeout(timer);
      chain = chain.then(() => write(force));
      await chain;
    },
    drop: async () => {
      gone = true;
      removeEventListener("pagehide", self.hide);
      clearTimeout(timer);
      await chain;
      await deleteDraft(draftKey).catch((e) => console.warn(`the draft ${draftKey} was not deleted`, e));
    },
    /** Stop saving (the editor is being replaced by one on a restored draft, or the page is left for good). */
    abandon: () => {
      gone = true;
      removeEventListener("pagehide", self.hide);
      clearTimeout(timer);
    },
  };
  return self;
}

/** Save the draft after every change in the form. @param {HTMLElement} form @param {ReturnType<typeof createDraft>} draft */
export function watchDraft(form, draft) {
  for (const type of DRAFT_EVENTS) form.addEventListener(type, draft.queue);
  // A reload or a closed tab within the autosave's second (the kit's unsaved bar asks first) still keeps the typing.
  addEventListener("pagehide", draft.hide);
}

/**
 * An earlier session's draft is offered, not applied: Restore starts the form again from it (under the key it was kept
 * under, so a blank new recipe that restores an import's draft goes on writing that one), Discard deletes it. Which draft
 * is offered is recipe/draft-keys.js `offeredFor`.
 * @param {{ draftKey: string, dishId: string | null, draft: ReturnType<typeof createDraft>, offer: HTMLElement, host: HTMLElement, restoreWith: (data: Record<string, any>, key: string) => void }} o
 */
export function offerEarlierDraft({ draftKey, dishId, draft, offer, host, restoreWith }) {
  void readDrafts()
    .then((all) => {
      const found = offeredFor(all, draftKey, dishId);
      if (!found || draft.gone || !host.isConnected || JSON.stringify(found.data) === draft.opening) return;
      const restoreButton = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--primary" }, t("edit.draftRestore"));
      const discardButton = h("button", { type: "button", class: "kp-button kp-button--sm" }, t("edit.draftDiscard"));
      offer.replaceChildren(h("div", { class: "kp-alert__body" }, h("strong", null, t("edit.draftAsk", stamp(found.saved))), " ", t("edit.draftText")), h("div", { class: "kp-row-actions" }, restoreButton, discardButton));
      offer.hidden = false;
      restoreButton.addEventListener("click", () => {
        draft.abandon();
        restoreWith(found.data, found.key);
      });
      discardButton.addEventListener("click", () => {
        offer.hidden = true;
        void deleteDraft(found.key).catch((e) => console.warn(`the discarded draft ${found.key} was not deleted`, e));
      });
    })
    .catch((e) => console.warn(`the earlier draft ${draftKey} could not be read`, e));
}
