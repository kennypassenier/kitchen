// The log's elements, put into the card's data area.

import { attachHeats } from "/static/kp/dist/kp-themes.min.js";
import { h } from "../../dom.js";

/** @param {HTMLElement} data */
export function buildLogDom(data) {
  const grid = h("div", { class: "kp-heat rp-log__grid", "data-kp-heat": true, "data-kp-tones": "calm", "aria-label": "" });
  const note = h("p", { class: "rp-log__note" });
  const heading = h("h3", { class: "kp-fw-semibold", id: "rp-log-day" });
  const sentence = h("p", { class: "rp-log__hint" });
  const feelingLabel = h("span", { class: "kp-formgrid__label", id: "rp-log-feeling-label" });
  const feel = h("div", { class: "kp-segmented", "data-kp-segmented": "single", role: "radiogroup", "aria-labelledby": "rp-log-feeling-label" });
  const add = h("button", { type: "button", class: "kp-button kp-button--primary", "data-kp-flash-button": true });
  const change = h("button", { type: "button", class: "kp-button", "data-kp-flash-button": true });
  const drop = h("button", { type: "button", class: "kp-button kp-button--ghost" });
  data.replaceChildren(
    h(
      "div",
      { class: "rp-log" },
      h(
        "div",
        { class: "rp-log__add" },
        heading,
        sentence,
        h(
          "div",
          { class: "kp-formgrid", "aria-labelledby": "rp-log-day" },
          h("div", { class: "kp-formgrid__row" }, feelingLabel, h("div", { class: "kp-formgrid__control" }, feel)),
          h("div", { class: "kp-formgrid__row kp-formgrid__row--buttons" }, h("div", { class: "kp-formgrid__control" }, h("div", { class: "kp-formgrid__buttons" }, add, change, drop))),
        ),
      ),
      grid,
      note,
    ),
  );
  attachHeats(data);
  return { grid, note, heading, sentence, feelingLabel, feel, add, change, drop };
}
