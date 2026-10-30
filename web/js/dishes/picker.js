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
/** The option of the new dish this picker holds (it is made when the recipe is saved): the combobox needs a real option to keep its text. */
const FRESH = "__fresh__";
let seq = 0;

/** A dish's name in the language shown, else its other half. @param {Item} d */
const shown = (d) => String(d.name?.[lang()] || d.name?.[lang() === "nl" ? "en" : "nl"] || "").trim();

/** One line of the inline new-dish form. @param {string} text @param {HTMLElement} control */
const line = (text, control) => h("div", { class: "kp-formgrid__row" }, h("span", { class: "kp-formgrid__label" }, text), h("div", { class: "kp-formgrid__control" }, control));

/** The combobox box: input, list and status. @param {number} n @param {string} label @param {string | undefined} id */
function buildBox(n, label, id) {
  const input = /** @type {HTMLInputElement} */ (
    h("input", { class: "kp-combobox__input", type: "text", role: "combobox", autocomplete: "off", "aria-expanded": "false", "aria-controls": `dp-list-${n}`, "aria-label": label, "aria-required": "true", placeholder: t("dp.placeholder"), ...(id ? { id } : {}) })
  );
  const list = h("ul", { class: "kp-combobox__list", id: `dp-list-${n}`, role: "listbox", hidden: true });
  const status = h("p", { class: "kp-combobox__status", "data-kp-combobox-status": true, role: "status", "aria-live": "polite" });
  const box = h("div", { class: "kp-combobox ip-picker__box", "data-kp-combobox": true, "data-kp-match": "substring" }, input, list, status);
  return { input, list, box };
}

/** The inline step that asks the new dish's two names. */
function buildAsks() {
  const nlField = /** @type {HTMLInputElement} */ (h("input", { class: "kp-field__input", type: "text", lang: "nl", autocomplete: "off", "aria-label": t("rec.dutchName"), placeholder: "Stoofvlees" }));
  const enField = /** @type {HTMLInputElement} */ (h("input", { class: "kp-field__input", type: "text", autocomplete: "off", "aria-label": t("rec.englishName"), placeholder: "Flemish beef stew" }));
  const add = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--primary" }, t("dp.useIt"));
  const cancel = h("button", { type: "button", class: "kp-button kp-button--sm" }, t("common.cancel"));
  const missing = h("p", { class: "ip-picker__ask", role: "status", "aria-live": "polite" });
  const asks = h(
    "div",
    { class: "ip-picker__new", hidden: true },
    h("p", { class: "ip-picker__ask" }, t("dp.newAsk")),
    h("div", { class: "kp-formgrid kitchen-formgrid" }, line(t("rec.dutchName"), nlField), line(t("rec.englishName"), enField)),
    missing,
    h("div", { class: "kp-row-actions" }, add, cancel),
  );
  return { asks, nlField, enField, add, cancel, missing };
}

/** @typedef {ReturnType<typeof buildBox> & ReturnType<typeof buildAsks> & { el: HTMLElement, chosen: string | null, fresh: { nl: string, en: string } | null, onChange: (() => void) | undefined, handle: ReturnType<typeof combobox> }} DishPicker */

/** The dishes A to Z. */
const dishes = () => [...(kitchenNow()?.dishes ?? [])].sort((a, b) => shown(a).localeCompare(shown(b)));

/** The dish named `text` (either language, any case), if any. @param {string} text */
const known = (text) => dishes().find((d) => [d.name?.nl, d.name?.en].some((x) => String(x ?? "").trim().toLowerCase() === text.toLowerCase()));

/** The typed text, as typed. @param {DishPicker} p */
const typed = (p) => p.input.value.trim();

/** The options: the held new dish, the dishes and the "add new" row. @param {DishPicker} p */
function fill(p) {
  const { fresh } = p;
  p.list.replaceChildren(
    ...(fresh ? [h("li", { class: "kp-combobox__option", role: "option", "data-kp-option": true, "data-value": FRESH }, fresh[lang()] || fresh.nl || fresh.en)] : []),
    ...dishes().map((d) => h("li", { class: "kp-combobox__option", role: "option", "data-kp-option": true, "data-value": d.id }, shown(d) || nameOf(d).text)),
    h("li", { class: "kp-combobox__option ip-picker__create", role: "option", "data-kp-option": true, "data-value": NEW }, t("dp.addNewPlain")),
  );
}

/** The extra row shows only while the typed text names no dish; choosing it opens the name step. @param {DishPicker} p */
function extendCombobox(p) {
  p.handle?.extend({
    shown: (option, _query, matched) => {
      if (option.dataset.value !== NEW) return matched;
      const text = typed(p);
      option.textContent = t("dp.addNew", text);
      option.dataset.kpLabel = text;
      return Boolean(text) && !known(text);
    },
    choose: (option) => {
      if (option.dataset.value !== NEW) return false;
      p.nlField.value = lang() === "nl" ? typed(p) : "";
      p.enField.value = lang() === "en" ? typed(p) : "";
      p.missing.textContent = "";
      p.asks.hidden = false;
      (lang() === "nl" ? p.enField : p.nlField).focus();
      return true;
    },
  });
}

/** Hold the new dish the step describes; it is made when the recipe is saved. @param {DishPicker} p */
function holdNewDish(p) {
  const name = { nl: p.nlField.value.trim(), en: p.enField.value.trim() };
  if (!name.nl || !name.en) {
    p.missing.textContent = t(!name.nl ? "ip.needNl" : "ip.needEn");
    (!name.nl ? p.nlField : p.enField).focus();
    return;
  }
  p.fresh = name;
  p.chosen = FRESH;
  fill(p);
  p.handle?.refresh();
  p.handle?.set([FRESH]);
  p.asks.hidden = true;
  p.input.focus();
  p.onChange?.();
}

/** @param {DishPicker} p */
function wireEvents(p) {
  p.box.addEventListener("kp-combobox-change", (/** @type {Event} */ e) => {
    const v = /** @type {CustomEvent} */ (e).detail?.value;
    if (typeof v === "string" && v !== NEW) {
      p.chosen = v;
      p.onChange?.();
    }
  });
  p.input.addEventListener("input", () => p.onChange?.());
  p.cancel.addEventListener("click", () => {
    p.asks.hidden = true;
    p.input.focus();
  });
  p.add.addEventListener("click", () => holdNewDish(p));
  const stop = onKitchen(() => {
    if (!p.el.isConnected) {
      stop();
      return;
    }
    const held = p.chosen ? [p.chosen] : [];
    fill(p);
    p.handle?.refresh();
    if (held.length) p.handle?.set(held);
  });
}

/** What the field says wins: a held new dish while the text is still its name, the dish while the text is still its name, else the dish the text names, else none. @param {DishPicker} p @returns {DishChoice | null} */
function readChoice(p) {
  const text = typed(p);
  const { fresh, chosen } = p;
  if (!text) return null;
  if (fresh && chosen === FRESH && text.toLowerCase() === (fresh[lang()] || fresh.nl || fresh.en).toLowerCase()) return { id: null, name: fresh };
  const held = chosen ? dishes().find((d) => d.id === chosen) : null;
  if (held && [shown(held), held.name?.nl, held.name?.en].some((x) => String(x ?? "").trim().toLowerCase() === text.toLowerCase())) return { id: held.id, name: null };
  const named = known(text);
  return named ? { id: named.id, name: null } : null;
}

/**
 * A combobox over the dishes, holding one dish (an id) or one new dish (its two names).
 * @param {string | null} dishId the dish chosen to start with, or none
 * @param {{ label: string, id?: string, onChange?: () => void, fresh?: { nl: string, en: string } | null }} o `label` is the accessible name; `fresh` a new dish held from the start (a restored draft)
 * @returns {{ el: HTMLElement, input: HTMLInputElement, get: () => DishChoice | null, text: () => string, set: (id: string) => void }}
 */
export function dishPicker(dishId, { label, id, onChange, fresh: held = null }) {
  const box = buildBox(++seq, label, id);
  const asks = buildAsks();
  const el = h("div", { class: "ip-picker" }, box.box, asks.asks);
  /** @type {DishPicker} */
  const p = { ...box, ...asks, el, chosen: dishId, fresh: held, onChange, handle: null };
  fill(p);
  attachComboboxes(el);
  p.handle = combobox(box.box);
  if (dishId) p.handle?.set([dishId]);
  else if (p.fresh) {
    p.chosen = FRESH;
    p.handle?.set([FRESH]);
  }
  extendCombobox(p);
  wireEvents(p);
  return {
    el,
    input: p.input,
    get: () => readChoice(p),
    text: () => typed(p),
    set: (/** @type {string} */ v) => {
      p.chosen = v;
      p.handle?.set([v]);
    },
  };
}
