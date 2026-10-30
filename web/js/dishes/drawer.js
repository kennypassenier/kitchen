// The drawer both dish editors open in: head, the form, Cancel and Save with the flash, and the package's behaviour.

import { attachSegmented } from "/static/kp/js/segmented.js";
import { attachSelects } from "/static/kp/js/combobox.js";
import { attachQuantities } from "/static/kp/js/quantity.js";
import { attachSwitches } from "/static/kp/js/forms.js";
import { attachFlashButtons, runFlashButton } from "/static/kp/js/flash.js";
import { closeDialog } from "/static/kp/js/motion.js";
import { h } from "../dom.js";
import { t } from "../i18n/index.js";

/** A section of the drawer's form. @param {string} title @param {string} text @param {...HTMLElement} body */
export const sec = (title, text, ...body) => h("section", { class: "rl-formsec" }, h("h3", { class: "kp-fw-semibold" }, title), h("p", { class: "rl-formsec__text" }, text), ...body);

/**
 * Fill the drawer and open it.
 * @param {HTMLDialogElement} dialog
 * @param {{ title: string, text: string, form: HTMLFormElement, saveLabel: string, onSave: () => Promise<string | { error: string, remedy?: string, word: string }> }} spec
 */
export function openDrawer(dialog, { title, text, form, saveLabel, onSave }) {
  const save = h("button", { type: "submit", class: "kp-button kp-button--primary", "data-kp-flash-button": true, "data-kp-flash-words": t("rec.saved"), form: form.id }, saveLabel);
  const cancel = h("button", { type: "button", class: "kp-button" }, t("common.cancel"));
  const line = h("p", { class: "rl-editor__line", role: "status" });
  dialog.replaceChildren(
    h(
      "header",
      { class: "kp-drawer__head" },
      h("h2", { class: "kp-dialog__title", id: "rl-editor-t" }, title),
      h("button", { type: "button", class: "kp-icon-button kp-dialog__close", "aria-label": t("de.closeNoSave"), "data-close": true }, "✕"),
      h("p", { class: "kp-drawer__desc" }, text),
    ),
    form,
    h("footer", { class: "kp-drawer__foot" }, line, cancel, save),
  );
  attachSelects(dialog);
  attachQuantities(dialog);
  attachSwitches(dialog);
  attachSegmented(dialog);
  attachFlashButtons(dialog);
  const close = () => void closeDialog(dialog);
  cancel.addEventListener("click", close);
  dialog.querySelector("[data-close]")?.addEventListener("click", close);
  dialog.addEventListener(
    "cancel",
    (e) => {
      e.preventDefault();
      close();
    },
    { once: true },
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void runFlashButton(save, async () => {
      const out = await onSave();
      if (typeof out === "string") close();
      return out;
    });
  });
  dialog.showModal();
}
