// Parts of the recipe page that need no page state: the words of the steps-with-photos section, the source row and the
// steps with their photos.

import { h } from "../dom.js";
import { t, lang } from "../i18n/index.js";
import { showPhotos } from "./photos.js";

/** The words of the steps-with-photos section (Kenny, 24/10/2026 05:23); the rest of the page keeps its words in recipe/words.js. */
export const STEP_WORDS = {
  nl: { title: "De stappen", lede: "Elke stap met de foto's die hem duidelijker maken.", step: (/** @type {number} */ n) => `Stap ${n}`, photo: "Foto van het gerecht", stepPhoto: "Foto bij de stap" },
  en: { title: "The steps", lede: "Every step with the photos that make it clearer.", step: (/** @type {number} */ n) => `Step ${n}`, photo: "Photo of the dish", stepPhoto: "Step photo" },
};

/**
 * Where the recipe came from (Kenny, 29/10/2026): a fact row with the address as a link that opens in a new tab; only a
 * plain http(s) address is ever a link.
 * @param {unknown} source
 */
export function sourceRow(source) {
  let url;
  try {
    url = typeof source === "string" && source.trim() ? new URL(source.trim()) : null;
  } catch {
    url = null;
  }
  if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) return null;
  return h("div", { class: "rp-source" }, h("dt", null, t("rec.source")), h("dd", null, h("a", { href: url.href, target: "_blank", rel: "noopener noreferrer" }, url.hostname.replace(/^www\./, ""))));
}

/**
 * The steps, each with the photos it carries; the card is there only when a step has a photo.
 * @param {{ el: HTMLElement, title: HTMLElement, lede: HTMLElement }} stepCard @param {HTMLElement} stepList @param {Record<string, any>} r
 */
export function paintStepPhotos(stepCard, stepList, r) {
  const text = STEP_WORDS[lang()];
  const list = /** @type {Record<string, any>[]} */ (r.steps ?? []);
  stepCard.el.hidden = !list.some((s) => (s.photos ?? []).length > 0);
  stepCard.title.textContent = text.title;
  stepCard.lede.textContent = text.lede;
  stepList.replaceChildren(
    ...list.map((s, i) =>
      h(
        "li",
        { class: "rp-stepphotos__item" },
        h("div", { class: "rp-stepphotos__text" }, h("h3", { class: "kp-fw-semibold" }, text.step(i + 1)), h("p", null, s.text)),
        (s.photos ?? []).length > 0 ? showPhotos(null, s.photos, `${text.stepPhoto} ${i + 1}`) : null,
      ),
    ),
  );
}
