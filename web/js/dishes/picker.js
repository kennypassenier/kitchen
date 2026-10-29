// The dish picker (Kenny, 29/10/2026: a recipe is put into a dish, or into a new one, from the recipe editor): the
// package's combobox over the kitchen's dishes, built like the ingredient picker (js/ingredients/picker.js). Typed text
// that names no dish offers one more row, "Add “…” as a new dish"; choosing it asks the dish's Dutch and English name
// right there. The new dish is NOT made here: the picker holds it, and the editor makes it together with the recipe on
// Save (api.js create("recipes", { new_dish })), so cancelling the editor leaves no dish behind.

import { attachComboboxes, combobox } from "/static/kp/js/combobox.js";
import { h } from "../dom.js";
import { kitchenNow, onKitchen } from "../api.js";
import { nameOf, t, lang } from "../i18n/index.js";

/** @typedef {Record<string, any>} Item */
/** @typedef {{ id: string | null, name: { nl: string, en: string } | null }} DishChoice */

const NEW = "__new__";
let seq = 0;

/** A dish's name in the language shown, else its other half. @param {Item} d */
const shown = (d) => String(d.name?.[lang()] || d.name?.[lang() === "nl" ? "en" : "nl"] || "").trim();

/**
 * A combobox over the dishes, holding one dish (an id) or one new dish (its two names).
 * @param {string | null} dishId the dish chosen to start with, or none
 * @param {{ label: string, id?: string, onChange?: () => void, fresh?: { nl: string, en: string } | null }} o `label` is the accessible name; `fresh` a new dish held from the start (a restored draft)
 * @returns {{ el: HTMLElement, input: HTMLInputElement, get: () => DishChoice | null, text: () => string, set: (id: string) => void }}
 */
export function dishPicker(dishId, { label, id, onChange, fresh: held = null }) {
  const n = ++seq;
  const input = /** @type {HTMLInputElement} */ (
    h("input", { class: "kp-combobox__input", type: "text", role: "combobox", autocomplete: "off", "aria-expanded": "false", "aria-controls": `dp-list-${n}`, "aria-label": label, "aria-required": "true", placeholder: t("dp.placeholder"), ...(id ? { id } : {}) })
  );
  const list = h("ul", { class: "kp-combobox__list", id: `dp-list-${n}`, role: "listbox", hidden: true });
  const status = h("p", { class: "kp-combobox__status", "data-kp-combobox-status": true, role: "status", "aria-live": "polite" });
  const box = h("div", { class: "kp-combobox ip-picker__box", "data-kp-combobox": true, "data-kp-match": "substring" }, input, list, status);

  const nlField = /** @type {HTMLInputElement} */ (h("input", { class: "kp-field__input", type: "text", lang: "nl", autocomplete: "off", "aria-label": t("rec.dutchName"), placeholder: "Stoofvlees" }));
  const enField = /** @type {HTMLInputElement} */ (h("input", { class: "kp-field__input", type: "text", autocomplete: "off", "aria-label": t("rec.englishName"), placeholder: "Flemish beef stew" }));
  const add = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--primary" }, t("dp.useIt"));
  const cancel = h("button", { type: "button", class: "kp-button kp-button--sm" }, t("common.cancel"));
  const missing = h("p", { class: "ip-picker__ask", role: "status", "aria-live": "polite" });
  const line = (/** @type {string} */ text, /** @type {HTMLElement} */ control) => h("div", { class: "kp-formgrid__row" }, h("span", { class: "kp-formgrid__label" }, text), h("div", { class: "kp-formgrid__control" }, control));
  const asks = h(
    "div",
    { class: "ip-picker__new", hidden: true },
    h("p", { class: "ip-picker__ask" }, t("dp.newAsk")),
    h("div", { class: "kp-formgrid kitchen-formgrid" }, line(t("rec.dutchName"), nlField), line(t("rec.englishName"), enField)),
    missing,
    h("div", { class: "kp-row-actions" }, add, cancel),
  );
  const el = h("div", { class: "ip-picker" }, box, asks);

  /** @type {string | null} */
  let chosen = dishId;
  /** @type {{ nl: string, en: string } | null} */
  let fresh = held;
  const dishes = () => [...(kitchenNow()?.dishes ?? [])].sort((a, b) => shown(a).localeCompare(shown(b)));
  const fill = () => {
    list.replaceChildren(
      ...dishes().map((d) => h("li", { class: "kp-combobox__option", role: "option", "data-kp-option": true, "data-value": d.id }, shown(d) || nameOf(d).text)),
      h("li", { class: "kp-combobox__option ip-picker__create", role: "option", "data-kp-option": true, "data-value": NEW }, t("dp.addNewPlain")),
    );
  };
  fill();
  attachComboboxes(el);
  const handle = combobox(box);
  const known = (/** @type {string} */ text) => dishes().find((d) => [d.name?.nl, d.name?.en].some((x) => String(x ?? "").trim().toLowerCase() === text.toLowerCase()));
  const typed = () => input.value.trim();
  if (dishId) handle?.set([dishId]);
  else if (fresh) input.value = fresh[lang()] || fresh.nl || fresh.en;

  handle?.extend({
    shown: (option, _query, matched) => {
      if (option.dataset.value !== NEW) return matched;
      const text = typed();
      option.textContent = t("dp.addNew", text);
      option.dataset.kpLabel = text;
      return Boolean(text) && !known(text);
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
    if (typeof v === "string" && v !== NEW) {
      chosen = v;
      fresh = null;
      onChange?.();
    }
  });
  input.addEventListener("input", () => {
    // Typing over a held new dish drops it: the field says what it holds.
    if (fresh && typed().toLowerCase() !== (fresh[lang()] || fresh.nl || fresh.en).toLowerCase()) fresh = null;
    onChange?.();
  });
  cancel.addEventListener("click", () => {
    asks.hidden = true;
    input.focus();
  });
  add.addEventListener("click", () => {
    const name = { nl: nlField.value.trim(), en: enField.value.trim() };
    if (!name.nl || !name.en) {
      missing.textContent = t(!name.nl ? "ip.needNl" : "ip.needEn");
      (!name.nl ? nlField : enField).focus();
      return;
    }
    fresh = name;
    chosen = null;
    handle?.set([]);
    input.value = name[lang()];
    asks.hidden = true;
    input.focus();
    onChange?.();
  });
  const stop = onKitchen(() => {
    if (!el.isConnected) {
      stop();
      return;
    }
    const held = chosen ? [chosen] : [];
    fill();
    handle?.refresh();
    if (held.length) handle?.set(held);
  });

  /** What the field says wins: a held new dish while the text is still its name, the dish while the text is still its name, else the dish the text names, else none. @returns {DishChoice | null} */
  const get = () => {
    const text = typed();
    if (!text) return null;
    if (fresh && text.toLowerCase() === (fresh[lang()] || fresh.nl || fresh.en).toLowerCase()) return { id: null, name: fresh };
    const held = chosen ? dishes().find((d) => d.id === chosen) : null;
    if (held && [shown(held), held.name?.nl, held.name?.en].some((x) => String(x ?? "").trim().toLowerCase() === text.toLowerCase())) return { id: held.id, name: null };
    const named = known(text);
    return named ? { id: named.id, name: null } : null;
  };
  return {
    el,
    input,
    get,
    text: typed,
    set: (/** @type {string} */ v) => {
      chosen = v;
      fresh = null;
      handle?.set([v]);
    },
  };
}
