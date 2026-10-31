// The code that opens cook mode on a phone, the printable sheet and its four options: they follow the recipe and the portions.

import { h } from "../../dom.js";
import { setCardState, setQr, attachSegmented } from "/static/kp/dist/kp-themes.min.js";
import { WORDS } from "../../recipe/words.js";
import { minutesText } from "../../recipe/amounts.js";
import { createSheet } from "../../recipe/sheet.js";

/** The four print choices on the form grid. @param {import("./index.js").RecipeCtx} ctx */
export function drawPrintOptions(ctx) {
  const { printOptions } = ctx.el;
  printOptions.replaceChildren(
    ...Object.entries(ctx.words.printOptions).map(([name, spec]) => {
      const label = h("span", { class: "kp-formgrid__label", id: `rp-print-${name}` }, spec.label);
      const group = h(
        "div",
        { class: "kp-segmented", "data-kp-segmented": "single", role: "radiogroup", "aria-labelledby": `rp-print-${name}`, "data-print-option": name },
        ...spec.items.map(([value, text], i) =>
          h("button", { type: "button", class: "kp-segmented__item", "data-value": value, role: "radio", "aria-checked": String(i === 0) }, h("span", { class: "kp-segmented__label" }, text)),
        ),
      );
      return h("div", { class: "kp-formgrid__row" }, label, h("div", { class: "kp-formgrid__control" }, group), h("p", { class: "kp-formgrid__value" }, spec.hint));
    }),
  );
  attachSegmented(printOptions);
}

/** The sheet's preview, and what the options and the print button do to it. @param {import("./index.js").RecipeCtx} ctx */
export function createShare(ctx) {
  const { frame, printOptions, printButton, code, paper } = ctx.el;
  /** @type {Awaited<ReturnType<typeof createSheet>> | null} */
  let sheet = null;
  const sheetReady = createSheet(frame).then((s) => (sheet = s), () => null);
  printOptions.addEventListener("kp-segmented-change", (event) => {
    const group = /** @type {HTMLElement} */ (event.target).closest("[data-print-option]");
    const value = /** @type {CustomEvent} */ (event).detail.value;
    if (group instanceof HTMLElement && value) sheet?.option(/** @type {any} */ (group.dataset.printOption), value);
  });
  printButton.addEventListener("click", () => sheet?.print());

  /** The code, for the recipe as it is now. */
  function paintShare() {
    if (!ctx.recipe) return;
    code.setAttribute("data-kp-qr-label", ctx.words.qrLabel(ctx.recipe.name));
    setQr(code, { value: `${location.origin}/cook?id=${encodeURIComponent(ctx.id)}`, state: undefined });
  }
  /** The sheet, for the recipe and the portions as they are now. */
  function paintSheet() {
    if (!ctx.recipe) return;
    const r = ctx.recipe;
    void sheetReady.then(() => {
      if (!ctx.alive || !sheet) return;
      const words = ctx.words;
      sheet.draw({ recipe: r, portions: ctx.portions, words, lang: words === WORDS.nl ? "nl" : "en", total: minutesText(r.minutes ?? 0, words) });
      setCardState(paper.el, "ready");
    });
  }
  return { paintShare, paintSheet };
}
