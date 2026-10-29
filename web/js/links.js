// Links out of Kitchen, shared by the recipe sources page, an item's page and the import drawer.

import { h } from "./dom.js";
import { t } from "./i18n/index.js";

/**
 * A link to a website outside Kitchen (Kenny, 29/10/2026 15:11: "links moeten in een nieuwe tab openen"): a new tab,
 * no opener, and the words "opens in a new tab" for a screen reader.
 * @param {string} href @param {string} text
 */
export const externalLink = (href, text) =>
  h("a", { href, target: "_blank", rel: "noopener noreferrer" }, text, h("span", { class: "kp-sr-only" }, ` (${t("src.newTab")})`));

/** The host of a web address without "www.", for a link's text; the address itself when it does not parse. @param {string} url */
export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
