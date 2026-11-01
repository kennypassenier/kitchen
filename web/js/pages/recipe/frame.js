// The recipe page's skeleton: the sections (card, steps with photos, printable sheet, cooking log) in their
// loading state from the first frame, and the words that do not depend on the recipe.

import { h } from "../../dom.js";
import { stage, dataOf, cardSection } from "../../ui/cards.js";
import { popoverButton } from "../../ui/popover.js";
import { t } from "../../i18n/index.js";

/** The code that opens cook mode on a phone and its one sentence: they live in the "Send to phone" popover (card.js). */
function qrParts() {
  const code = h("div", { class: "kp-qr", "data-kp-qr": true, "data-kp-qr-retry": true });
  const phoneText = h("p", { class: "rp-phone__text" });
  return { code, phoneText };
}

/** The printable sheet: the preview frame and its options. */
function sheetSection() {
  const paper = cardSection("rp-paper", "rp-sec", { "data-kp-state": "loading" }, stage());
  const frame = h("iframe", { class: "rp-sheet" });
  const printTitle = h("h3", { class: "kp-fw-semibold" });
  const printText = h("p");
  const printOptions = h("div", { class: "kp-formgrid" });
  // The four options sit in a small popover beside the print button (Kenny, 01/11/2026 20:21); the preview stays.
  const options = popoverButton({ label: "", content: [printOptions], plate: "rp-options" });
  const printButton = h("button", { type: "button", class: "kp-button kp-button--primary" });
  const printLine = h("p", { class: "rp-line" });
  dataOf(paper.el).append(
    h("div", { class: "rp-print" }, frame, h("div", { class: "rp-print__words" }, printTitle, printText, h("div", { class: "rp-print__go" }, printButton, options.wrap), printLine)),
  );
  return { paper, frame, printTitle, printText, printOptions, printButton, printLine, optionsLabel: options.setLabel, optionsPlate: options.plate };
}

/** The steps with their photos; there only when a step has a photo. */
function stepPhotosSection() {
  const stepCard = cardSection("rp-stepcard", "rp-sec");
  const stepList = h("ol", { class: "rp-stepphotos" });
  stepCard.el.append(stepList);
  stepCard.el.hidden = true;
  return { stepCard, stepList };
}

/**
 * Every element of the page, not yet in the document (the page attaches it once the log is made).
 * @returns {ReturnType<typeof qrParts> & ReturnType<typeof sheetSection> & ReturnType<typeof stepPhotosSection> & { card: HTMLElement, logSec: ReturnType<typeof cardSection>, page: HTMLElement }}
 */
export function buildFrame() {
  const card = h("section", { class: "kp-card rp-card", "data-kp-state": "loading", "aria-label": t("recipe.cardLabel") }, stage());
  const qr = qrParts();
  const sheet = sheetSection();
  const logSec = cardSection("rp-log", "rp-logcard", { "data-kp-state": "loading" }, stage());
  const steps = stepPhotosSection();
  const page = h("div", { class: "rp-page" }, card, steps.stepCard.el, sheet.paper.el, logSec.el);
  return { card, logSec, page, ...qr, ...sheet, ...steps };
}

/** The words that do not depend on the recipe. @param {ReturnType<typeof buildFrame>} f @param {import("../../recipe/words.js").Words} words */
export function paintWords(f, words) {
  f.phoneText.textContent = words.phoneText;
  f.paper.title.textContent = words.sheetTitle;
  f.paper.lede.textContent = words.sheetLede;
  f.frame.setAttribute("title", words.sheetLabel);
  f.printTitle.textContent = words.printTitle;
  f.printText.textContent = words.printText;
  f.printButton.textContent = words.printButton;
  f.optionsLabel(words.printOptionsButton);
  f.optionsPlate.setAttribute("aria-label", words.printOptionsButton);
  f.printLine.textContent = words.printLine;
  f.logSec.title.textContent = words.logTitle;
  f.logSec.lede.textContent = words.logLede;
}
