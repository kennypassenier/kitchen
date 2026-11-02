// The editor page's answer to a stale save (fix-stale-save-1): the recipe was saved in another tab or on another device
// after this page opened it. Nothing is overwritten and nothing goes silently: the alert above the form says so and offers
// "Reload" (this version is dropped, its new photos too) or "Keep my version as a draft" (the reloaded page offers it back
// above the form, recipe/editor/draft.js).

import { h } from "../../dom.js";
import { t } from "../../i18n/index.js";
import { reason } from "../../api.js";

/**
 * Show the choice in `alert`. Each action runs once; a failure is said in the alert and the buttons work again.
 * @param {HTMLElement} alert @param {{ reload: () => Promise<void>, keep: () => Promise<void> }} actions
 */
export function showStale(alert, { reload, keep }) {
  const reloadButton = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--primary" }, t("ep.staleReload"));
  const keepButton = h("button", { type: "button", class: "kp-button kp-button--sm" }, t("ep.staleKeep"));
  const failure = h("p", { class: "kp-alert__body", hidden: true });
  alert.replaceChildren(h("div", { class: "kp-alert__body" }, h("strong", null, t("ep.staleTitle")), ` ${t("ep.staleText")}`), h("div", { class: "kp-row-actions" }, reloadButton, keepButton), failure);
  alert.hidden = false;
  alert.scrollIntoView({ block: "center" });
  /** @param {() => Promise<void>} fn */
  const run = (fn) => async () => {
    reloadButton.disabled = keepButton.disabled = true;
    failure.hidden = true;
    try {
      await fn();
    } catch (e) {
      console.error("answering a stale save", e);
      failure.textContent = t("ep.staleFailed", reason(e));
      failure.hidden = false;
      reloadButton.disabled = keepButton.disabled = false;
    }
  };
  reloadButton.addEventListener("click", run(reload));
  keepButton.addEventListener("click", run(keep));
}
