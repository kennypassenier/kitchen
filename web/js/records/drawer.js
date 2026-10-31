// The shared drawer and the form pieces the record editors are made of (Kenny, 24/10/2026 05:07, 05:08: full CRUD
// everywhere; the editors are the dishes' drawer on `.kp-formgrid`).

import { attachDatePickers, datePicker, toast } from "/static/kp/dist/kp-themes.min.js";
import { h } from "../dom.js";
import { create, replace, kitchenNow, reason } from "../api.js";
import { t, nameOf } from "../i18n/index.js";
import { area, input } from "../ui/form-parts.js";
import { dmy } from "../format.js";
import { openDrawer, sec } from "../dishes/editor.js";
import { LISTS } from "./lists.js";

// ---- the drawer ----------------------------------------------------------------------------------------------------

/** The one drawer every screen shares, made on first use. */
export function drawer() {
  let d = /** @type {HTMLDialogElement | null} */ (document.getElementById("kitchen-drawer"));
  if (!d) {
    d = /** @type {HTMLDialogElement} */ (h("dialog", { class: "kp-drawer kp-dialog rl-editor", id: "kitchen-drawer", "aria-labelledby": "rl-editor-t" }));
    document.body.append(d);
  }
  return d;
}

/** The package's date picker in a form row; `max` keeps it at or before a day. @param {string} iso @param {{ max?: string, label: string }} o */
export function dateField(iso, { max, label }) {
  const id = `rc-date-${Math.random().toString(36).slice(2, 8)}`;
  const el = h(
    "div",
    { class: "kp-datepicker kp-formgrid__fill", "data-kp-datepicker": true, lang: "en-GB", ...(max ? { "data-kp-max": max } : {}) },
    h("input", { class: "kp-field__input", id, type: "text", inputmode: "numeric", "data-kp-date-input": true, "aria-label": label, value: iso ? dmy(iso) : "" }),
    h("button", { type: "button", class: "kp-button", "data-kp-date-open": true, "aria-label": t("rec.openCalendar"), title: t("rec.openCalendar") }, h("span", { "aria-hidden": "true" }, "▦")),
    h("div", { class: "kp-datepicker__panel", "data-kp-date-panel": true, hidden: true }),
  );
  return {
    el,
    /** After the drawer attached the picker: show `iso`. */
    start: () => {
      attachDatePickers(el.parentElement ?? el);
      if (iso) datePicker(el)?.set(iso);
    },
    /** @returns {string | null} YYYY-MM-DD */
    get: () => {
      const d = datePicker(el)?.get();
      return d ? d.toLocaleDateString("en-CA") : null;
    },
  };
}

/**
 * A text in both languages (Kenny, 24/10/2026 10:04): a Dutch and an English field, each filled from `v` (`{nl, en}`,
 * or a plain string from before, which fills both).
 * @param {unknown} v @param {"input" | "area"} kind @param {string} placeholder
 */
export function pair(v, kind, placeholder) {
  const o = /** @type {Record<string, string>} */ (v && typeof v === "object" ? v : { nl: String(v ?? ""), en: String(v ?? "") });
  const make = (/** @type {"nl" | "en"} */ l) => {
    const el = kind === "area" ? area(String(o[l] ?? ""), 2) : input(String(o[l] ?? ""), "text", { autocomplete: "off", ...(placeholder ? { placeholder } : {}) });
    if (l === "nl") el.setAttribute("lang", "nl");
    return el;
  };
  const nl = make("nl");
  const en = make("en");
  return { nl, en, get: () => ({ nl: /** @type {HTMLInputElement} */ (nl).value.trim(), en: /** @type {HTMLInputElement} */ (en).value.trim() }) };
}

/** A segmented choice of one. @param {Record<string, string>} options @param {string} value @param {string} label */
export function choiceOf(options, value, label) {
  return h(
    "div",
    { class: "kp-segmented kp-segmented--chips", "data-kp-segmented": "single", role: "radiogroup", "aria-label": label },
    ...Object.entries(options).map(([v, t]) =>
      h("button", { type: "button", class: "kp-segmented__item", role: "radio", "data-value": v, "aria-checked": String(v === value) }, h("span", { class: "kp-segmented__label" }, t)),
    ),
  );
}

/** The dishes as select options, by name (the recipe of a dish has the dish's id). */
export const dishOptions = () =>
  [...(kitchenNow()?.dishes ?? [])]
    .map((d) => /** @type {[string, string]} */ ([d.id, nameOf(d).text]))
    .sort((a, b) => a[1].localeCompare(b[1]));

/**
 * One form in the drawer: rows on one `.kp-formgrid`, saved as a create or a replace.
 * @param {{ list: List, item: Item | null, title: string, text: string, rows: HTMLElement[], body: () => Item | { error: string, remedy?: string }, after?: () => void, saved: (body: Item) => string }} spec
 */
export function openForm({ list, item, title, text, rows, body, after, saved }) {
  const form = /** @type {HTMLFormElement} */ (
    h("form", { class: "kp-drawer__body rl-form", id: "rc-form", novalidate: true }, sec(title, text, h("div", { class: "kp-formgrid kitchen-formgrid" }, ...rows)))
  );
  openDrawer(drawer(), {
    title: item ? t("rec.editTitle", LISTS[list].name(item)) : t(`list.${list}.add`),
    text: item ? t("rec.editText") : t("rec.addText"),
    form,
    saveLabel: item ? t("common.save") : t(`list.${list}.addSave`),
    onSave: async () => {
      const b = body();
      if ("error" in b && typeof b.error === "string") return { error: b.error, remedy: b.remedy, word: t("rec.notSaved") };
      try {
        const out = item ? await replace(list, { ...item, ...b }) : await create(list, b);
        toast(saved(out));
      } catch (e) {
        return { error: reason(e), word: t("rec.notSaved") };
      }
      return t("rec.saved");
    },
  });
  after?.();
}
