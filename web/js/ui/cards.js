// The card, section and button shells several screens build the same way (cook, timing, recipe, settings). Each screen
// passes its own class prefix, so the markup and the CSS of every page stay exactly as they were; only the builder is
// shared (docs/agent/MODULARITY.md, 30/10/2026).

import { h } from "../dom.js";

/** A package button. @param {string} text @param {string} [extra] @param {(e: Event) => void} [onclick] */
export function button(text, extra = "", onclick) {
  return h("button", { type: "button", class: `kp-button ${extra}`.trim(), onclick }, text);
}

/** A link that looks like a package button. @param {string} href @param {string} label @param {string} [extra] */
export const link = (href, label, extra = "") => h("a", { class: `kp-button ${extra}`.trim(), href }, label);

/** A formgrid row whose control holds buttons and whose value says what they do. @param {string} label @param {HTMLElement[]} buttons @param {string | HTMLElement} says */
export function actionRow(label, buttons, says) {
  return h(
    "div",
    { class: "kp-formgrid__row" },
    h("span", { class: "kp-formgrid__label" }, label),
    // One button is the row's action, so the package centres the row on it and gives it the control track on a phone.
    buttons.length === 1
      ? h("div", { class: "kp-formgrid__actions" }, buttons[0])
      : h("div", { class: "kp-formgrid__control" }, h("div", { class: "kp-formgrid__buttons" }, ...buttons)),
    typeof says === "string" ? h("p", { class: "kp-formgrid__value" }, says) : says,
  );
}

/**
 * A top-level section: a heading and its one sentence, then the body. `names` holds the screen's own classes.
 * @param {{ sec: string, head: string }} names @param {string} id @param {string} title @param {string} text @param {...Node} body
 */
export function section({ sec, head }, id, title, text, ...body) {
  return h("section", { class: sec, id, "aria-labelledby": `${id}-h` }, h("div", { class: head }, h("h2", { id: `${id}-h` }, title), h("p", null, text)), ...body);
}

/**
 * A data card in its loading state from the first frame, with a header, the one sentence and the stage.
 * @param {{ id: string, title: string, text: string, loading: string, cls: string, dataCls: string }} o
 */
export function headedCard({ id, title, text, loading, cls, dataCls }) {
  return h(
    "section",
    { class: `kp-card ${cls}`, id, "data-kp-state": "loading", "aria-labelledby": `${id}-t`, "data-kp-loading-words": loading },
    h("div", { class: "kp-card__header" }, h("h3", { class: "kp-card__title", id: `${id}-t` }, title)),
    h("p", { class: "kp-card__body", id: `${id}-body` }, text),
    h("div", { class: "kp-card__stage" }, h("div", { class: `kp-card__data ${dataCls}`, id: `${id}-data` })),
  );
}

/** A data card with no header, named for assistive technology, in its loading state from the first frame. @param {{ id: string, label: string, loading: string, cls: string, dataCls: string }} o */
export function stageCard({ id, label, loading, cls, dataCls }) {
  return h(
    "section",
    { class: `kp-card ${cls}`, id, "data-kp-state": "loading", "aria-label": label, "data-kp-loading-words": loading },
    h("div", { class: "kp-card__stage" }, h("div", { class: `kp-card__data ${dataCls}`, id: `${id}-data` })),
  );
}

/** A card whose stage holds a header-less body or a data area. @param {string} dataClass */
export const stage = (dataClass = "") => h("div", { class: "kp-card__stage" }, h("div", { class: `kp-card__data ${dataClass}`.trim() }));

/** @param {HTMLElement} card */
export const dataOf = (card) => /** @type {HTMLElement} */ (card.querySelector(".kp-card__data"));

/**
 * A section card with its heading and the one sentence that says what it does.
 * @param {string} id @param {string} cls @param {Record<string, string>} [attrs] @param {...Node} body
 */
export function cardSection(id, cls, attrs, ...body) {
  const title = h("h2", { class: "kp-card__title", id: `${id}-t` });
  const lede = h("p", { class: "kp-lede", id: `${id}-d` });
  const el = h("section", { class: `kp-card ${cls}`, id, "aria-labelledby": `${id}-t`, ...attrs }, h("div", { class: "kp-card__header" }, title), lede, ...body);
  return { el, title, lede };
}
