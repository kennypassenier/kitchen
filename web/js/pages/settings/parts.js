// The parts of a settings row: the row itself, a segmented control, a card, the default button and its hint.

import { h } from "../../dom.js";
import { t } from "../../i18n/index.js";
import { stageCard } from "../../ui/cards.js";

/**
 * One row of the form grid: the name with its sentence, the control, what it says now and (for a saved setting) the
 * button that puts the default back.
 * @param {{ id: string, title: string, text: string, control: Node, said?: string, extra?: Node | null, action?: Node | null, controlLabelFor?: string }} o
 */
export function row({ id, title, text, control, said = "", extra = null, action = null, controlLabelFor }) {
  return h(
    "div",
    { class: "kp-formgrid__row", id: `st-row-${id}` },
    h(
      controlLabelFor ? "label" : "div",
      { class: "kp-formgrid__label st-name", for: controlLabelFor },
      h("span", { class: "st-name__title", id: `st-${id}-t` }, title),
      h("span", { class: "st-name__text" }, text),
    ),
    h("div", { class: "kp-formgrid__control" }, control),
    h("div", { class: "kp-formgrid__value st-value" }, h("p", { class: "st-said", id: `st-${id}-said`, role: "status", "aria-live": "polite" }, said), extra, h("p", { class: "st-line", id: `st-${id}-line`, role: "status" })),
    h("div", { class: "kp-formgrid__actions" }, action),
  );
}

/** A segmented control of the package. @param {string} label @param {[string, string][]} items @param {string} id */
export function segmented(label, items, id) {
  return h(
    "div",
    { class: "kp-segmented kp-formgrid__short", "data-kp-segmented": "single", role: "radiogroup", "aria-label": label, id },
    ...items.map(([value, text]) =>
      h("button", { type: "button", class: "kp-segmented__item", "data-value": value, role: "radio", "aria-checked": "false" }, h("span", { class: "kp-segmented__label" }, text)),
    ),
  );
}

/** A card of this screen, in its loading state from the first frame. @param {string} id @param {string} title @param {string} loading */
export const card = (id, title, loading) => stageCard({ id, label: title, loading, cls: "st-card", dataCls: "st-data" });

/** The button of a saved row: puts the default back, and says what it did. @param {string} key @param {string} defSaid */
export const reset = (key, defSaid) =>
  h("button", { type: "button", class: "kp-button kp-button--sm", id: `st-${key}-reset`, "data-kp-flash-button": "", "data-kp-flash-words": t("set.flashWords"), "data-kp-flash-line": `#st-${key}-line`, title: t("set.putsBack", defSaid) }, t("set.useDefault"));

/** The sentence under a saved row's reading that says what its button does. @param {string} defSaid */
export const resetText = (defSaid) => h("small", { class: "st-hint" }, t("set.useDefaultHint", defSaid));
