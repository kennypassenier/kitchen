// The sides block of the dish editor: one bordered group per side, each with its ingredients, an optional label in
// both languages, Up, Down and Remove; "Add a side" under them.

import { h } from "../dom.js";
import { ingredientsPicker } from "../ingredients/picker.js";
import { row, input } from "../ui/form-parts.js";
import { t } from "../i18n/index.js";

/** @typedef {Record<string, any>} Item */
/** @typedef {{ el: HTMLElement, get: () => Item | null, up: HTMLElement, down: HTMLElement }} SideEntry */

/** One side's group: the picker, the two labels and the three buttons. @param {Item} side @returns {SideEntry & { remove: HTMLElement }} */
function buildSide(side) {
  const picker = ingredientsPicker(Array.isArray(side.ingredients) ? side.ingredients : [], { label: t("de.sideIngs") });
  const nl = input(String(side.label?.nl ?? ""), "text", { autocomplete: "off", lang: "nl", placeholder: t("de.phLabelNl"), "aria-label": t("de.labelNlAria") });
  const en = input(String(side.label?.en ?? ""), "text", { autocomplete: "off", placeholder: t("de.phLabelEn"), "aria-label": t("de.labelEnAria") });
  const up = h("button", { type: "button", class: "kp-button kp-button--sm", "data-dl-move": "up", "aria-label": t("de.upLabel") }, t("de.up"));
  const down = h("button", { type: "button", class: "kp-button kp-button--sm", "data-dl-move": "down", "aria-label": t("de.downLabel") }, t("de.down"));
  const remove = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--ghost" }, t("de.remove"));
  const el = h(
    "div",
    { class: "dl-side" },
    h("div", { class: "dl-side__head" }, h("h4", { class: "kp-fw-semibold dl-side__title" }), h("div", { class: "kp-row-actions" }, up, down, remove)),
    h(
      "div",
      { class: "kp-formgrid kitchen-formgrid" },
      row(t("nav.ingredients"), picker.el, t("de.sideIngsHint")),
      row(t("de.labelNl"), nl, t("de.labelNlHint")),
      row(t("de.labelEn"), en, t("de.labelEnHint")),
    ),
  );
  const get = () => {
    const ingredients = picker.get();
    if (!ingredients.length) return null;
    const label = { nl: /** @type {HTMLInputElement} */ (nl).value.trim(), en: /** @type {HTMLInputElement} */ (en).value.trim() };
    return label.nl || label.en ? { ingredients, label } : { ingredients };
  };
  return { el, get, up, down, remove };
}

/** @typedef {{ list: SideEntry[], groups: HTMLElement, none: HTMLElement, addButton: HTMLElement }} SidesState */

/** Numbers and the Up / Down limits follow the order. @param {SidesState} s */
function sync(s) {
  s.none.hidden = s.list.length > 0;
  s.list.forEach((entry, i) => {
    const head = /** @type {HTMLElement} */ (entry.el.querySelector(".dl-side__title"));
    head.textContent = t("de.side", i + 1);
    /** @type {HTMLButtonElement} */ (entry.up).disabled = i === 0;
    /** @type {HTMLButtonElement} */ (entry.down).disabled = i === s.list.length - 1;
  });
  s.groups.replaceChildren(...s.list.map((e) => e.el));
}

/** @param {SidesState} s @param {Item} side @param {boolean} [focus] */
function push(s, side, focus = false) {
  const entry = buildSide(side);
  const move = (/** @type {number} */ by) => {
    const at = s.list.indexOf(entry);
    const to = at + by;
    if (to < 0 || to >= s.list.length) return;
    s.list.splice(at, 1);
    s.list.splice(to, 0, entry);
    sync(s);
    (by < 0 ? entry.up : entry.down).focus();
  };
  entry.up.addEventListener("click", () => move(-1));
  entry.down.addEventListener("click", () => move(1));
  entry.remove.addEventListener("click", () => {
    s.list = s.list.filter((e) => e !== entry);
    sync(s);
    s.addButton.focus();
  });
  s.list.push(entry);
  sync(s);
  if (focus) entry.el.querySelector("input")?.focus();
}

/** @param {Item[]} sides the dish's sides */
export function sidesBlock(sides) {
  const box = h("div", { class: "dl-sides" });
  /** @type {SidesState} */
  const s = { list: [], groups: h("div", { class: "dl-sides__groups" }), none: h("p", { class: "rl-rows__empty" }, t("de.noSides")), addButton: h("button", { type: "button", class: "kp-button kp-button--sm" }, t("de.addSide")) };
  for (const side of sides) push(s, side);
  s.addButton.addEventListener("click", () => push(s, { ingredients: [] }, true));
  box.append(s.groups, s.none, h("div", { class: "rl-rows__add" }, s.addButton));
  sync(s);
  return { el: box, get: () => /** @type {Item[]} */ (s.list.map((e) => e.get()).filter(Boolean)) };
}
