// The recipe page's skeleton: the five sections (card, steps with photos, code, printable sheet, cooking log) in their
// loading state from the first frame, and the words that do not depend on the recipe.

import { h } from "../../dom.js";
import { stage, dataOf, cardSection } from "../../ui/cards.js";
import { t } from "../../i18n/index.js";

/** The QR section: a code and the steps to use it. @returns {{ share: ReturnType<typeof cardSection>, code: HTMLElement, scanTitle: HTMLElement, stepsTitle: HTMLElement, steps: HTMLElement, qrLine: HTMLElement }} */
function qrSection() {
  const share = cardSection("rp-share", "rp-sec");
  const code = h("div", { class: "kp-qr", "data-kp-qr": true, "data-kp-qr-retry": true });
  const scanTitle = h("h3", { class: "kp-fw-semibold" });
  const stepsTitle = h("h3", { class: "kp-fw-semibold" });
  const steps = h("ol", { class: "rp-steps" });
  const qrLine = h("p", { class: "rp-line" });
  share.el.append(
    h("div", { class: "rp-share__grid" }, h("div", { class: "rp-share__code" }, scanTitle, code), h("div", { class: "rp-share__words" }, stepsTitle, steps, qrLine)),
  );
  return { share, code, scanTitle, stepsTitle, steps, qrLine };
}

/** The printable sheet: the preview frame and its options. */
function sheetSection() {
  const paper = cardSection("rp-paper", "rp-sec", { "data-kp-state": "loading" }, stage());
  const frame = h("iframe", { class: "rp-sheet" });
  const printTitle = h("h3", { class: "kp-fw-semibold" });
  const printText = h("p");
  const printOptions = h("div", { class: "kp-formgrid" });
  const printButton = h("button", { type: "button", class: "kp-button kp-button--primary" });
  const printLine = h("p", { class: "rp-line" });
  dataOf(paper.el).append(
    h("div", { class: "rp-print" }, frame, h("div", { class: "rp-print__words" }, printTitle, printText, printOptions, h("div", { class: "rp-print__go" }, printButton), printLine)),
  );
  return { paper, frame, printTitle, printText, printOptions, printButton, printLine };
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
 * @returns {ReturnType<typeof qrSection> & ReturnType<typeof sheetSection> & ReturnType<typeof stepPhotosSection> & { card: HTMLElement, logSec: ReturnType<typeof cardSection>, page: HTMLElement }}
 */
export function buildFrame() {
  const card = h("section", { class: "kp-card rp-card", "data-kp-state": "loading", "aria-label": t("recipe.cardLabel") }, stage());
  const qr = qrSection();
  const sheet = sheetSection();
  const logSec = cardSection("rp-log", "rp-logcard", { "data-kp-state": "loading" }, stage());
  const steps = stepPhotosSection();
  const page = h("div", { class: "rp-page" }, card, steps.stepCard.el, qr.share.el, sheet.paper.el, logSec.el);
  return { card, logSec, page, ...qr, ...sheet, ...steps };
}

/** The words that do not depend on the recipe. @param {ReturnType<typeof buildFrame>} f @param {import("../../recipe/words.js").Words} words */
export function paintWords(f, words) {
  f.share.title.textContent = words.shareTitle;
  f.share.lede.textContent = words.shareLede;
  f.scanTitle.textContent = words.scanTitle;
  f.stepsTitle.textContent = words.stepsTitle;
  f.steps.replaceChildren(...words.qrSteps.map((s) => h("li", null, s)));
  f.qrLine.textContent = words.qrLine;
  f.paper.title.textContent = words.sheetTitle;
  f.paper.lede.textContent = words.sheetLede;
  f.frame.setAttribute("title", words.sheetLabel);
  f.printTitle.textContent = words.printTitle;
  f.printText.textContent = words.printText;
  f.printButton.textContent = words.printButton;
  f.printLine.textContent = words.printLine;
  f.logSec.title.textContent = words.logTitle;
  f.logSec.lede.textContent = words.logLede;
}
