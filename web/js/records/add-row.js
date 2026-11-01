// An inline add row at the top of a table card (Kenny, 01/11/2026 20:21: "Invoerrij" for What I ate, "In de tabel" for
// the categories): the few fields a new line needs side by side, each with its own visible label, and one Add. Enter in
// any field adds, as a form submit does; a refusal is said under the row and the field to fix gets the focus; after an
// Add the fields empty (the page says which keep their value) and the focus goes back to the first one, so the next
// line can be typed at once. The kit has no add row for its data table (kp-gaps/kitchen.md); the row is built from the
// kit's field, label, button and error parts on a grid of its own (css/pages/dishes.css, `dl-addrow`).

import { toast } from "/static/kp/dist/kp-themes.min.js";
import { h } from "../dom.js";
import { t } from "../i18n/index.js";

/**
 * @typedef {object} AddField
 * @property {string} label the visible label
 * @property {HTMLElement} control the input, select or the kit's date picker
 * @property {"wide" | "short"} [size] wide takes the spare room (a note, a name), short a fixed step (a date)
 */

/** What an Add answers: the toast's sentence, or what is wrong and which field to fix. @typedef {string | { error: string, field?: HTMLElement }} AddAnswer */

/** The focusable part of a field (a date picker's input, a select). @param {HTMLElement} control */
const focusable = (control) => /** @type {HTMLElement} */ (control.matches("input, select, textarea") ? control : (control.querySelector("input, select, textarea") ?? control));

/** One labelled field of the row. @param {AddField} f */
function fieldCell(f) {
  const target = focusable(f.control);
  const label = h("label", { class: "kp-field__label", for: target.id }, f.label);
  return h("div", { class: `kp-field dl-addrow__field${f.size ? ` dl-addrow__field--${f.size}` : ""}` }, label, f.control);
}

/** Show or clear the row's refusal; the field it names is marked and focused. @param {{ error: HTMLElement, fields: AddField[] }} r @param {string} text @param {HTMLElement} [field] */
function say(r, text, field) {
  r.error.textContent = text;
  r.error.hidden = !text;
  for (const f of r.fields) focusable(f.control).removeAttribute("aria-invalid");
  if (field) {
    const target = focusable(field);
    target.setAttribute("aria-invalid", "true");
    target.focus();
  }
}

/** Enter in a select or the date field adds too (a text input does by itself); Enter that the kit used (a date panel) does not. @param {HTMLFormElement} form */
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
 * Build the add row.
 * @param {{ label: string, fields: AddField[], submit: string, add: () => Promise<AddAnswer>, reset: () => void }} spec
 * @returns {{ el: HTMLFormElement, focus: () => void }}
 */
export function addRow({ label, fields, submit, add, reset }) {
  const button = h("button", { type: "submit", class: "kp-button kp-button--primary dl-addrow__add" }, submit);
  const error = h("p", { class: "kp-field__error dl-addrow__error", role: "alert", hidden: true });
  const form = /** @type {HTMLFormElement} */ (h("form", { class: "dl-addrow", novalidate: true, "aria-label": label }, ...fields.map(fieldCell), button, error));
  const r = { error, fields };
  const focus = () => focusable(fields[0].control).focus();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (button.getAttribute("aria-busy") === "true") return;
    button.setAttribute("aria-busy", "true");
    try {
      const answer = await add();
      if (typeof answer === "string") {
        say(r, "");
        reset();
        toast(answer);
        focus();
      } else say(r, answer.error, answer.field);
    } catch (e) {
      say(r, t("rec.notAdded", e instanceof Error ? e.message : String(e)));
    } finally {
      button.removeAttribute("aria-busy");
    }
  });
  enterAdds(form);
  return { el: form, focus };
}
