// The add row of a table card, as the kit's `data-kp-addrow`: the fields stand under the table's columns with their
// labels shown (`data-kp-addrow-labels="show"`), Enter adds (also on a closed select, `data-kp-addrow-enter="submit"`;
// Ctrl+Enter from any field), the Add is busy while the line is saved, a refusal is said under the row or on its field,
// and the kit says "Added <the named field>" (`data-kp-addrow-name`) and empties the row. This file only writes the kit's
// markup and hands the page's rules to its `kp-addrow-add` event; the behaviour is the kit's.

import { h } from "../dom.js";
import { uid } from "../ui/form-parts.js";
import { t } from "../i18n/index.js";
import { leaveToComponent, listKeys } from "../shell/keys.js";

/**
 * @typedef {object} AddField
 * @property {string} name the field's name in the row's values, and where a refusal is shown
 * @property {string} column the id of the column it stands under (`data-kp-field` on the table's header cell)
 * @property {string} label the visible label (the kit shows it as the column words)
 * @property {HTMLElement} control the input, select or the kit's date picker
 */

/** The focusable part of a field (a date picker's input, a select). @param {HTMLElement} control */
const focusable = (control) => /** @type {HTMLInputElement} */ (control.matches("input, select, textarea") ? control : (control.querySelector("input, select, textarea") ?? control));

/** One labelled cell of the row, with the kit's error line under it. @param {AddField} f */
function cell(f) {
  const target = focusable(f.control);
  target.name = f.name;
  if (!target.id) target.id = uid("kt-addrow");
  return h(
    "div",
    { class: "kp-field kp-addrow__cell", "data-kp-addrow-column": f.column },
    h("label", { class: "kp-field__label", for: target.id }, f.label),
    f.control,
    h("span", { class: "kp-field__error", "data-kp-field-error": true, hidden: true }),
  );
}

/**
 * Build the add row over the table `tableId`. `check` runs on every valid-form submit and names the field that is wrong;
 * `add` saves the line (a rejection is the refusal under the row). `named` is the field the kit says after the add
 * ("Added Pasta"; a select by its chosen option's text).
 * @param {{ tableId: string, label: string, submit: string, fields: AddField[], named: string, check: () => { name: string, message: string } | null, add: () => Promise<void>, onAdded?: () => void }} spec
 * @returns {{ el: HTMLFormElement, focus: () => void }}
 */
export function addLine({ tableId, label, submit, fields, named, check, add, onAdded }) {
  const button = h("button", { type: "submit", class: "kp-button kp-button--primary", "data-kp-submit": true }, submit);
  const form = /** @type {HTMLFormElement} */ (
    h(
      "form",
      {
        class: "kp-addrow",
        "data-kp-addrow": true,
        "data-kp-addrow-for": tableId,
        "data-kp-addrow-labels": "show",
        "data-kp-addrow-enter": "submit",
        "data-kp-addrow-name": named,
        "data-kp-form": true,
        novalidate: true,
        "aria-label": label,
      },
      h("div", { class: "kp-form__summary", "data-kp-form-summary": true, tabindex: "-1", hidden: true }),
      h("div", { class: "kp-addrow__cells" }, ...fields.map(cell), h("div", { class: "kp-addrow__submit" }, button)),
    )
  );
  form.addEventListener("kp-addrow-add", (event) => {
    const bad = check();
    /** @type {CustomEvent} */ (event).detail.waitUntil(bad ? Promise.resolve({ errors: { [bad.name]: bad.message } }) : add());
  });
  if (onAdded) form.addEventListener("kp-addrow-added", onAdded);
  // On the `?` sheet: the add row's own Ctrl+Enter (kp `data-kp-addrow-submit-key`, its default), handled by the row.
  listKeys(form, [{ keys: "Mod Enter", what: t("keys.addLine"), group: t("keys.groupTables"), inFields: true, run: leaveToComponent }]);
  return { el: form, focus: () => focusable(fields[0].control).focus() };
}
