// The form primitives of the drawers (recipe editor, dish editor, record editors): one row of the form grid, text and
// number inputs, switch, segmented chips, select and the repeatable-rows list. They are plain builders; the editors
// own what the controls mean. Moved out of recipe/editor.js on 30/10/2026 (docs/agent/MODULARITY.md) unchanged.

import { attachSelects } from "/static/kp/js/combobox.js";
import { attachQuantities } from "/static/kp/js/quantity.js";
import { attachSwitches } from "/static/kp/js/forms.js";
import { h } from "../dom.js";
import { t } from "../i18n/index.js";

let serial = 0;
/** @param {string} p */
export const uid = (p) => `${p}-${++serial}`;

/**
 * One row of the form grid: label, control, a hint in the value track.
 * @param {string} label @param {HTMLElement} control @param {string} [hint] @param {string} [labelId]
 */
export function row(label, control, hint = "", labelId = uid("rl-l")) {
  const first = control.querySelector("input, textarea, select, button") ?? control;
  const labelEl = control.matches("[role=radiogroup], [role=group]") || !(first instanceof HTMLElement && first.id)
    ? h("span", { class: "kp-formgrid__label", id: labelId }, label)
    : h("label", { class: "kp-formgrid__label", for: first.id, id: labelId }, label);
  if (control.matches("[role=radiogroup], [role=group]")) control.setAttribute("aria-labelledby", labelId);
  return h("div", { class: "kp-formgrid__row" }, labelEl, h("div", { class: "kp-formgrid__control" }, control), hint ? h("p", { class: "kp-formgrid__value" }, hint) : null);
}

/** @param {string} value @param {string} [type] @param {Record<string, string>} [attrs] */
export function input(value, type = "text", attrs = {}) {
  return h("input", { class: "kp-field__input", type, id: uid("rl-i"), value, ...attrs });
}

/** @param {string} value @param {number} rows */
export function area(value, rows = 3) {
  const el = h("textarea", { class: "kp-field__input kp-field__input--multiline", id: uid("rl-t"), rows, "data-kp-autosize": true });
  el.textContent = value;
  return el;
}

/** A stepper: the package's quantity. @param {number} value @param {{ min?: number, max?: number, unit?: string, one?: string, label: string }} o */
export function stepper(value, { min = 0, max = 1000, unit = "", one = "", label }) {
  return h(
    "div",
    { class: "kp-quantity", "data-kp-quantity": true, "data-kp-quantity-min": String(min), "data-kp-quantity-max": String(max), "data-kp-quantity-unit": unit, "data-kp-quantity-unit-one": one || unit, "data-kp-quantity-label": label },
    h("input", { class: "kp-quantity__input", value: String(value) }),
  );
}

/** @param {string} label @param {boolean} on */
export function toggle(label, on) {
  const box = h("input", { class: "kp-switch__input", type: "checkbox", role: "switch", id: uid("rl-s") });
  box.checked = on;
  return h("label", { class: "kp-switch" }, box, h("span", { class: "kp-switch__state", "aria-hidden": "true" }), h("span", null, label));
}

/** @param {HTMLElement} sw */
export const on = (sw) => /** @type {HTMLInputElement} */ (sw.querySelector("input")).checked;

/** A segmented control. @param {[string, string][]} items @param {string[]} values @param {"single" | "multi"} mode @param {string} label */
export function segmented(items, values, mode, label) {
  return h(
    "div",
    { class: "kp-segmented kp-segmented--chips", "data-kp-segmented": mode, role: mode === "single" ? "radiogroup" : "group", "aria-label": label },
    ...items.map(([value, text]) => {
      const pressed = values.includes(value);
      return h(
        "button",
        mode === "single"
          ? { type: "button", class: "kp-segmented__item", "data-value": value, role: "radio", "aria-checked": String(pressed) }
          : { type: "button", class: "kp-segmented__item", "data-value": value, "aria-pressed": String(pressed) },
        h("span", { class: "kp-segmented__label" }, text),
      );
    }),
  );
}

/** A native select the package draws. @param {[string, string][]} options @param {string} value @param {string} label */
export function select(options, value, label) {
  const el = h("select", { class: "kp-field__input", id: uid("rl-sel"), "aria-label": label }, ...options.map(([v, t]) => h("option", { value: v }, t)));
  /** @type {HTMLSelectElement} */ (el).value = value;
  return /** @type {HTMLSelectElement} */ (el);
}

/** The package's behaviour on a line made after the first attach. @param {HTMLElement} line */
function attachLine(line) {
  attachSelects(line);
  attachQuantities(line);
  attachSwitches(line);
}

/** @typedef {{ line: HTMLElement, cells: { get: () => any }[] }} RowEntry */
/** @typedef {{ grid: HTMLElement, head: HTMLElement, body: HTMLElement, empty: HTMLElement, addButton: HTMLElement, lines: RowEntry[], columns: { make: (value: any) => { el: HTMLElement, get: () => any } }[], noun: string }} RowsState */

/** The header and the empty note follow the number of lines; each Remove says which line it removes. @param {RowsState} s */
function syncRows(s) {
  s.head.hidden = s.lines.length === 0;
  s.empty.hidden = s.lines.length > 0;
  s.lines.forEach(({ line }, i) => line.querySelector(".rl-row__remove")?.setAttribute("aria-label", t(`edit.removeNoun.${s.noun}`, i + 1)));
}

/** @param {RowsState} s @param {any} item */
function pushRow(s, item) {
  const cells = s.columns.map((c) => c.make(item));
  const remove = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--ghost rl-row__remove" }, t("photo.remove"));
  const line = h("div", { class: "rl-row" }, ...cells.map((c) => c.el), remove);
  const entry = { line, cells };
  remove.addEventListener("click", () => {
    s.lines = s.lines.filter((l) => l !== entry);
    line.remove();
    syncRows(s);
    s.grid.dispatchEvent(new CustomEvent("rl-rows-change", { bubbles: true }));
    s.addButton.focus();
  });
  s.lines.push(entry);
  s.body.append(line);
  syncRows(s);
  s.grid.dispatchEvent(new CustomEvent("rl-rows-change", { bubbles: true }));
  return line;
}

/**
 * A repeatable list on shared columns: a header line, one row per item, and an Add button that says what it adds.
 * @param {{ columns: { label: string, width: string, make: (value: any) => { el: HTMLElement, get: () => any } }[], items: any[], add: string, noun: string, blank: () => any }} spec
 */
export function rows({ columns, items, add, noun, blank }) {
  /** @type {RowsState} */
  const s = {
    grid: h("div", { class: "rl-rows", style: `--rl-cols: ${columns.map((c) => c.width).join(" ")} max-content` }),
    head: h("div", { class: "rl-row rl-row--head" }, ...columns.map((c) => h("span", { class: "rl-row__label" }, c.label)), h("span", { class: "kp-sr-only" }, t("photo.remove"))),
    body: h("div", { class: "rl-rows__body" }),
    empty: h("p", { class: "rl-rows__empty" }, t(`edit.none.${noun}`)),
    addButton: h("button", { type: "button", class: "kp-button kp-button--sm" }, add),
    lines: [],
    columns,
    noun,
  };
  for (const item of items) pushRow(s, item);
  s.addButton.addEventListener("click", () => {
    const line = pushRow(s, blank());
    attachLine(line);
    line.querySelector("input, textarea, select")?.focus();
  });
  s.grid.append(s.head, s.body, s.empty, h("div", { class: "rl-rows__add" }, s.addButton));
  syncRows(s);
  return {
    el: s.grid,
    get: () => s.lines.map((l) => l.cells.map((c) => c.get())),
    /** Add a line from outside (several ingredients picked at once). @param {any} item */
    add: (item) => {
      const line = pushRow(s, item);
      attachLine(line);
      return line;
    },
  };
}

/** @param {string} label @param {string} value @param {string} placeholder */
export const textCell = (label, value, placeholder = "") => {
  const el = input(value, "text", { "aria-label": label, placeholder });
  return { el, get: () => /** @type {HTMLInputElement} */ (el).value.trim() };
};
