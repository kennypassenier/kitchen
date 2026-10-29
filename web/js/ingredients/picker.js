// The ingredient picker (Kenny, 24/10/2026 05:15): wherever an ingredient is chosen (a dish's sides, a recipe's lines)
// it is the package's combobox with search over the kitchen's one list of ingredients. Typed text that names no
// ingredient offers one more row, "Add “…” as a new ingredient"; choosing it asks the ingredient's category right
// there and makes it, without leaving the form. The extra row is the combobox's own extension point (`extend`:
// `shown` keeps the row in view while it matches nothing else, `choose` swallows it as a choice), not a second list.
//
// One ingredient (a recipe line) is a plain combobox; several (a dish's fixed ingredients, one side) the package's tag
// input, where an ingredient stands once (Kenny, 24/10/2026 05:27: unique within one side, free across sides).
// A new ingredient gets both names here (the typed text fills the language Kitchen is shown in).

import { attachComboboxes, attachSelects, combobox } from "/static/kp/js/combobox.js";
import { toast } from "/static/kp/js/overlays.js";
import { h } from "../dom.js";
import { create, kitchenNow, onKitchen, ingredientName, ApiError } from "../api.js";
import { t, lang as shownLang } from "../i18n/index.js";

/** @typedef {Record<string, any>} Item */

const NEW = "__new__";
let seq = 0;

/** The language names are shown in. */
const lang = shownLang;

/** Ingredient categories in their order. */
const categories = () => [...(kitchenNow()?.ingredient_categories ?? [])].sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9));

/**
 * Several ingredients at once: the tag input. `get` returns their ids in the order they were added.
 * @param {string[]} values @param {{ label: string }} o
 * @returns {{ el: HTMLElement, get: () => string[] }}
 */
export function ingredientsPicker(values, { label }) {
  const p = build(values, { label, multi: true });
  return { el: p.el, get: () => /** @type {string[]} */ (p.all()), clear: p.clear };
}

/**
 * A combobox over the ingredients, holding one ingredient id.
 * @param {string | null} value the ingredient chosen, or none
 * @param {{ label: string }} o the accessible name ("Ingredient of line 2")
 * @returns {{ el: HTMLElement, get: () => string | null, startNew: (name: string) => void }} `startNew` opens the inline new-ingredient step with a name (the import's proposal row)
 */
export function ingredientPicker(value, { label }) {
  const p = build(value ? [value] : [], { label, multi: false });
  return { el: p.el, get: p.one, startNew: p.startNew };
}

/** @param {string[]} values @param {{ label: string, multi: boolean }} o */
function build(values, { label, multi }) {
  const n = ++seq;
  const value = values[0] ?? null;
  const input = h("input", { class: "kp-combobox__input", type: "text", role: "combobox", autocomplete: "off", "aria-expanded": "false", "aria-controls": `ip-list-${n}`, "aria-label": label, placeholder: t("ip.placeholder") });
  const list = h("ul", { class: "kp-combobox__list", id: `ip-list-${n}`, role: "listbox", hidden: true });
  const status = h("p", { class: "kp-combobox__status", "data-kp-combobox-status": true, role: "status", "aria-live": "polite" });
  const tags = multi ? h("ul", { class: "kp-tag-list", "data-kp-tag-list": true }) : null;
  const box = h("div", { class: "kp-combobox ip-picker__box", "data-kp-combobox": true, "data-kp-match": "substring", ...(multi ? { "data-kp-tags": true, "data-kp-stay-open": "false" } : {}) }, tags, input, list, status);

  // The inline "new ingredient" step: both names (Kenny, 24/10/2026 10:04: every name in Dutch and English; the typed
  // text fills the language shown), its category, Add and Cancel, on the form grid.
  const nlField = /** @type {HTMLInputElement} */ (h("input", { class: "kp-field__input", type: "text", lang: "nl", autocomplete: "off", "aria-label": t("rec.dutchName"), placeholder: "Frieten" }));
  const enField = /** @type {HTMLInputElement} */ (h("input", { class: "kp-field__input", type: "text", autocomplete: "off", "aria-label": t("rec.englishName"), placeholder: "Fries" }));
  const cat = /** @type {HTMLSelectElement} */ (h("select", { class: "kp-field__input", "aria-label": t("ip.catAria") }));
  const add = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--primary" }, t("ip.addIt"));
  const cancel = h("button", { type: "button", class: "kp-button kp-button--sm" }, t("common.cancel"));
  const missing = h("p", { class: "ip-picker__ask", role: "status", "aria-live": "polite" });
  const line = (/** @type {string} */ label, /** @type {HTMLElement} */ control) => h("div", { class: "kp-formgrid__row" }, h("span", { class: "kp-formgrid__label" }, label), h("div", { class: "kp-formgrid__control" }, control));
  const asks = h(
    "div",
    { class: "ip-picker__new", hidden: true },
    h("p", { class: "ip-picker__ask" }, t("ip.newAsk")),
    h("div", { class: "kp-formgrid kitchen-formgrid" }, line(t("rec.dutchName"), nlField), line(t("rec.englishName"), enField), line(t("rec.category"), cat)),
    missing,
    h("div", { class: "kp-row-actions" }, add, cancel),
  );
  const el = h("div", { class: "ip-picker" }, box, asks);

  /** @type {string | null} */
  let chosen = value;
  const fill = () => {
    const items = [...(kitchenNow()?.ingredients ?? [])].sort((a, b) => ingredientName(a.id, lang()).localeCompare(ingredientName(b.id, lang())));
    list.replaceChildren(
      ...items.map((i) => h("li", { class: "kp-combobox__option", role: "option", "data-kp-option": true, "data-value": i.id }, ingredientName(i.id, lang()))),
      h("li", { class: "kp-combobox__option ip-picker__create", role: "option", "data-kp-option": true, "data-value": NEW }, t("ip.addNewPlain")),
    );
    cat.replaceChildren(...categories().map((c) => h("option", { value: c.id }, String(c.name?.[lang()] || c.name?.en || c.name?.nl || t("ip.other")))));
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
      option.textContent = t("ip.addNew", text);
      option.dataset.kpLabel = text;
      return Boolean(text) && !named(text);
    },
    choose: (option) => {
      if (option.dataset.value !== NEW) return false;
      nlField.value = lang() === "nl" ? typed() : "";
      enField.value = lang() === "en" ? typed() : "";
      missing.textContent = "";
      asks.hidden = false;
      (lang() === "nl" ? enField : nlField).focus();
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
    const name = { nl: nlField.value.trim(), en: enField.value.trim() };
    const text = name[lang()] || name.nl || name.en;
    if (!name.nl || !name.en) {
      missing.textContent = t(!name.nl ? "ip.needNl" : "ip.needEn");
      (!name.nl ? nlField : enField).focus();
      return;
    }
    add.setAttribute("aria-disabled", "true");
    try {
      const before = multi ? handle?.values() ?? [] : [];
      const made = await create("ingredients", { name, category: cat.value || null });
      chosen = made.id;
      fill();
      handle?.refresh();
      handle?.set(multi ? [...before, made.id] : [made.id]);
      if (multi) /** @type {HTMLInputElement} */ (input).value = "";
      asks.hidden = true;
      toast(t("ip.added", text));
      input.focus();
    } catch (e) {
      toast(t("ip.notAdded", e instanceof ApiError ? e.message : String(e)), { live: "assertive", sticky: true });
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
  /** Open the new-ingredient step with a proposed name: it fills the language shown, the other half stays empty and required (Kenny, 29/10/2026 14:27). @param {string} name */
  const startNew = (name) => {
    nlField.value = lang() === "nl" ? name.trim() : "";
    enField.value = lang() === "en" ? name.trim() : "";
    missing.textContent = "";
    asks.hidden = false;
    (lang() === "nl" ? enField : nlField).focus();
  };
  return { el, one, all, startNew, clear: () => handle?.set([]) };
}
