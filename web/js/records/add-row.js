// An inline add row at the top of a table card (Kenny, 01/11/2026 20:21: "Invoerrij" for What I ate, "In de tabel" for
// the categories): the few fields a new line needs side by side, each with its own visible label, and one Add. Enter in
// any field adds, as a form submit does. The row is the kit's form (data-kp-form, attachForms): a field that is wrong gets
// its message under it and in the form's summary, the submit is busy while the line is saved, and a refused save is said
// in the summary. After an Add the fields empty (the page says which keep their value) and the focus goes back to the
// first one, so the next line can be typed at once. The kit has no add row for its data table (kp-gaps/kitchen.md); the
// row is the kit's field, label, button and form parts on a grid of its own (css/pages/dishes.css, `dl-addrow`).

import { attachForms, VALID_EVENT } from "/static/kp/dist/js/forms.js";
import { toast } from "/static/kp/dist/js/overlays.js";
import { h } from "../dom.js";
import { t } from "../i18n/index.js";
import { uid } from "../ui/form-parts.js";

/**
 * @typedef {object} AddField
 * @property {string} label the visible label
 * @property {HTMLElement} control the input, select or the kit's date picker
 * @property {"wide" | "short"} [size] wide takes the spare room (a note, a name), short a fixed step (a date)
 */

/** The focusable part of a field (a date picker's input, a select). @param {HTMLElement} control */
const focusable = (control) => /** @type {HTMLInputElement} */ (control.matches("input, select, textarea") ? control : (control.querySelector("input, select, textarea") ?? control));

/** One labelled field of the row, with the kit's error line under it. @param {AddField} f */
function fieldCell(f) {
  const target = focusable(f.control);
  const label = h("label", { class: "kp-field__label", for: target.id }, f.label);
  const error = h("span", { class: "kp-field__error", "data-kp-field-error": true, hidden: true });
  return h("div", { class: `kp-field dl-addrow__field${f.size ? ` dl-addrow__field--${f.size}` : ""}` }, label, f.control, error);
}

/** Enter in a select or the date field adds too; Enter that the kit used (a date panel) does not. @param {HTMLFormElement} form */
function enterAdds(form) {
  form.addEventListener("keydown", (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (event.key !== "Enter" || event.defaultPrevented || event.isComposing || !target.matches("select, input")) return;
    if (target.closest("[data-kp-date-panel]")) return;
    event.preventDefault();
    form.requestSubmit();
  });
}

/**
 * Build the add row. `check` runs on every submit and names the field that is wrong; `add` saves the line and answers
 * the toast's sentence; `reset` empties what should empty. `stop` takes the kit's form wiring away.
 * @param {{ label: string, fields: AddField[], submit: string, check: () => { field: HTMLElement, message: string } | null, add: () => Promise<string>, reset: () => void }} spec
 * @returns {{ el: HTMLElement, focus: () => void, stop: () => void }}
 */
export function addRow({ label, fields, submit, check, add, reset }) {
  const summary = h("div", { class: "kp-form__summary dl-addrow__summary", "data-kp-form-summary": true, tabindex: "-1", hidden: true });
  const helpId = uid("dl-addrow-help");
  const button = h("button", { type: "submit", class: "kp-button kp-button--primary", "data-kp-submit": true, "aria-describedby": helpId }, submit);
  // The button's column keeps an empty first line like the fields' labels, so it starts where they start; "Enter adds"
  // stands under the button as its help, where a field keeps its own second line (Kenny, 02/11/2026 03:43).
  const go = h(
    "div",
    { class: "kp-field dl-addrow__go" },
    h("span", { class: "kp-field__label", "aria-hidden": "true" }, "\u00a0"),
    button,
    h("span", { class: "kp-field__help", id: helpId }, t("rec.enterAdds")),
  );
  const form = /** @type {HTMLFormElement} */ (h("form", { class: "kp-form dl-addrow", "data-kp-form": true, novalidate: true, "aria-label": label }, summary, ...fields.map(fieldCell), go));
  const focus = () => focusable(fields[0].control).focus();
  // Runs before the kit's own listener: the page's rules become the fields' validity, which the kit then reports.
  form.addEventListener("submit", () => {
    for (const f of fields) focusable(f.control).setCustomValidity("");
    const bad = check();
    if (bad) focusable(bad.field).setCustomValidity(bad.message);
  });
  form.addEventListener(VALID_EVENT, async (event) => {
    const { done } = /** @type {CustomEvent<{ done: () => void }>} */ (event).detail;
    try {
      const said = await add();
      summary.hidden = true;
      reset();
      toast(said);
      focus();
    } catch (e) {
      summary.textContent = t("rec.notAdded", e instanceof Error ? e.message : String(e));
      summary.hidden = false;
      summary.focus();
    } finally {
      done();
    }
  });
  for (const f of fields) focusable(f.control).addEventListener("input", () => focusable(f.control).setCustomValidity(""));
  enterAdds(form);
  // attachForms wires the forms below the node it is given, so the row stands in a box of its own.
  const box = h("div", { class: "dl-addrow-box" }, form);
  const stop = attachForms(box, { wrapper: ".kp-field", validateOn: "submit", revalidateOn: "none" });
  return { el: box, focus, stop };
}
