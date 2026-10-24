// The ingredient picker (Kenny, 24/10/2026 05:15): wherever an ingredient is chosen (a dish's sides, a recipe's lines)
// it is the package's combobox with search over the kitchen's one list of ingredients. Typed text that names no
// ingredient offers one more row, "Add “…” as a new ingredient"; choosing it asks the ingredient's category right
// there and makes it, without leaving the form. The extra row is the combobox's own extension point (`extend`:
// `shown` keeps the row in view while it matches nothing else, `choose` swallows it as a choice), not a second list.
//
// One ingredient (a recipe line) is a plain combobox; several (a dish's fixed ingredients, one side) the package's tag
// input, where an ingredient stands once (Kenny, 24/10/2026 05:27: unique within one side, free across sides).
// A new ingredient gets the typed name in the language Kitchen is shown in; its page adds the other half.

import { attachComboboxes, attachSelects, combobox } from "/static/kp/js/combobox.js";
import { toast } from "/static/kp/js/overlays.js";
import { h } from "../dom.js";
import { create, kitchenNow, onKitchen, ingredientName, ApiError } from "../api.js";

/** @typedef {Record<string, any>} Item */

const NEW = "__new__";
let seq = 0;

/** The language names are shown in. */
const lang = () => /** @type {"en" | "nl"} */ (kitchenNow()?.settings?.lang === "nl" ? "nl" : "en");

/** Ingredient categories in their order. */
const categories = () => [...(kitchenNow()?.ingredient_categories ?? [])].sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9));

/**
 * Several ingredients at once: the tag input. `get` returns their ids in the order they were added.
 * @param {string[]} values @param {{ label: string }} o
 * @returns {{ el: HTMLElement, get: () => string[] }}
 */
export function ingredientsPicker(values, { label }) {
  const p = build(values, { label, multi: true });
  return { el: p.el, get: () => /** @type {string[]} */ (p.all()) };
}

/**
 * A combobox over the ingredients, holding one ingredient id.
 * @param {string | null} value the ingredient chosen, or none
 * @param {{ label: string }} o the accessible name ("Ingredient of line 2")
 * @returns {{ el: HTMLElement, get: () => string | null }}
 */
export function ingredientPicker(value, { label }) {
  const p = build(value ? [value] : [], { label, multi: false });
  return { el: p.el, get: p.one };
}

/** @param {string[]} values @param {{ label: string, multi: boolean }} o */
function build(values, { label, multi }) {
  const n = ++seq;
  const value = values[0] ?? null;
  const input = h("input", { class: "kp-combobox__input", type: "text", role: "combobox", autocomplete: "off", "aria-expanded": "false", "aria-controls": `ip-list-${n}`, "aria-label": label, placeholder: multi ? "Search, or type a new one" : "Search or type a new one" });
  const list = h("ul", { class: "kp-combobox__list", id: `ip-list-${n}`, role: "listbox", hidden: true });
  const status = h("p", { class: "kp-combobox__status", "data-kp-combobox-status": true, role: "status", "aria-live": "polite" });
  const tags = multi ? h("ul", { class: "kp-tag-list", "data-kp-tag-list": true }) : null;
  const box = h("div", { class: "kp-combobox ip-picker__box", "data-kp-combobox": true, "data-kp-match": "substring", ...(multi ? { "data-kp-tags": true, "data-kp-stay-open": "false" } : {}) }, tags, input, list, status);

  // The inline "new ingredient" step: the typed name, its category, Add and Cancel.
  const newName = h("strong", { class: "ip-picker__name" });
  const cat = /** @type {HTMLSelectElement} */ (h("select", { class: "kp-field__input", "aria-label": "Category of the new ingredient" }));
  const add = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--primary" }, "Add it");
  const cancel = h("button", { type: "button", class: "kp-button kp-button--sm" }, "Cancel");
  const asks = h("div", { class: "ip-picker__new", hidden: true }, h("p", { class: "ip-picker__ask" }, "New ingredient ", newName, " in the category"), cat, h("div", { class: "kp-row-actions" }, add, cancel));
  const el = h("div", { class: "ip-picker" }, box, asks);

  /** @type {string | null} */
  let chosen = value;
  const fill = () => {
    const items = [...(kitchenNow()?.ingredients ?? [])].sort((a, b) => ingredientName(a.id, lang()).localeCompare(ingredientName(b.id, lang())));
    list.replaceChildren(
      ...items.map((i) => h("li", { class: "kp-combobox__option", role: "option", "data-kp-option": true, "data-value": i.id }, ingredientName(i.id, lang()))),
      h("li", { class: "kp-combobox__option ip-picker__create", role: "option", "data-kp-option": true, "data-value": NEW }, "Add as a new ingredient"),
    );
    cat.replaceChildren(...categories().map((c) => h("option", { value: c.id }, String(c.name?.[lang()] || c.name?.en || c.name?.nl || "Other"))));
  };
  fill();
  attachComboboxes(el);
  attachSelects(asks);
  const handle = combobox(box);
  if (values.length) handle?.set(multi ? values : [values[0]]);

  /** The typed text, as typed. */
  const typed = () => /** @type {HTMLInputElement} */ (input).value.trim();
  const named = (/** @type {string} */ text) => (kitchenNow()?.ingredients ?? []).find((i) => [i.name?.nl, i.name?.en].some((x) => String(x ?? "").trim().toLowerCase() === text.toLowerCase()));
  handle?.extend({
    // The new row shows only while the typed text names no ingredient, and says what it adds.
    shown: (option, query, matched) => {
      if (option.dataset.value !== NEW) return matched;
      const text = typed();
      option.textContent = `Add “${text}” as a new ingredient`;
      option.dataset.kpLabel = text;
      return Boolean(text) && !named(text);
    },
    choose: (option) => {
      if (option.dataset.value !== NEW) return false;
      newName.textContent = `“${typed()}”`;
      asks.hidden = false;
      cat.focus();
      return true;
    },
  });
  box.addEventListener("kp-combobox-change", (/** @type {Event} */ e) => {
    const v = /** @type {CustomEvent} */ (e).detail?.value;
    if (typeof v === "string" && v !== NEW) chosen = v;
  });
  cancel.addEventListener("click", () => {
    asks.hidden = true;
    input.focus();
  });
  add.addEventListener("click", async () => {
    const text = typed();
    if (!text) return;
    add.setAttribute("aria-disabled", "true");
    try {
      const before = multi ? handle?.values() ?? [] : [];
      const made = await create("ingredients", { name: lang() === "nl" ? { nl: text, en: "" } : { nl: "", en: text }, category: cat.value || null });
      chosen = made.id;
      fill();
      handle?.refresh();
      handle?.set(multi ? [...before, made.id] : [made.id]);
      if (multi) /** @type {HTMLInputElement} */ (input).value = "";
      asks.hidden = true;
      toast(`Added ${text} to the ingredients`);
      input.focus();
    } catch (e) {
      toast(`Not added: ${e instanceof ApiError ? e.message : String(e)}`, { live: "assertive", sticky: true });
    } finally {
      add.removeAttribute("aria-disabled");
    }
  });
  // An ingredient made in another picker of the same form shows here too.
  const stop = onKitchen(() => {
    if (!el.isConnected) {
      stop();
      return;
    }
    const held = multi ? handle?.values() ?? [] : chosen ? [chosen] : [];
    fill();
    handle?.refresh();
    if (held.length) handle?.set(held);
  });

  // What the field says wins: the chosen ingredient while the text is still its name, else the ingredient the text
  // names, else none (text that names nothing is not saved as a side or a line).
  const one = () => {
    const text = typed();
    if (!text) return null;
    if (chosen && ingredientName(chosen, lang()).toLowerCase() === text.toLowerCase()) return chosen;
    return named(text)?.id ?? null;
  };
  const known = new Set((kitchenNow()?.ingredients ?? []).map((i) => i.id));
  const all = () => (handle?.values() ?? []).filter((v) => v !== NEW && (known.has(v) || (kitchenNow()?.ingredients ?? []).some((i) => i.id === v)));
  return { el, one, all };
}
