// The editor page's skeleton: the page header (heading, one sentence, Back and the kit's unsaved bar), the contents list
// beside the form and the scope the form sits in. Nothing here knows a recipe; the session fills it.

import { h } from "../../dom.js";
import { t } from "../../i18n/index.js";
import { stageCard } from "../../ui/cards.js";

/** @param {string} backHref */
export function buildShell(backHref) {
  // `data-kp-track="app"`: the page marks the changed sections itself (bar.js). Nothing is kept by the bar across a reload:
  // the editor's own draft does that.
  const bar = h("div", { class: "kp-unsaved", id: "rl-unsaved", "data-kp-unsaved": true, "data-kp-unsaved-for": "#rl-editor-scope", "data-kp-track": "app", "data-kp-keep": "off", "data-kp-undo-ms": "0", "data-kp-name": "recipe-editor" });
  const back = h("a", { class: "kp-button", href: backHref }, t("ep.back"));
  const title = h("h1", { class: "kp-page-header__title" }, t("ep.opening"));
  const lede = h("p", { class: "kp-page-header__description" });
  const header = h("header", { class: "kp-page-header" }, h("div", { class: "kp-page-header__inner" }, h("div", null, title, lede), h("div", { class: "kp-page-header__actions" }, back, bar)));
  const contents = h("nav", { class: "kp-contents kp-contents--sticky", "data-kp-contents": true, "data-kp-contents-for": "#rl-editor-scope", "data-kp-contents-min": "2", "data-kp-contents-title": t("ep.index"), "data-kp-contents-offset": "96", "aria-label": t("ep.index") });
  const fold = h("details", { class: "kp-accordion__item rl-editpage__index" }, h("summary", { class: "kp-accordion__summary rl-editpage__indexsummary" }, t("ep.index")), h("div", { class: "kp-accordion__body" }, contents));
  // The card is the page's loading, failed and not-found plate until the form takes its place.
  const plate = stageCard({ id: "rl-plate", label: t("ep.opening"), loading: t("ep.opening"), cls: "rl-editpage__plate", dataCls: "rl-editpage__platedata" });
  const alert = h("div", { class: "kp-alert kp-alert--destructive", role: "alert", hidden: true });
  const scope = h("div", { class: "rl-editpage__main", id: "rl-editor-scope" });
  const main = h("div", { class: "rl-editpage__col" }, alert, scope, plate);
  const root = h("div", { class: "rl-editpage rl-editor" }, header, h("div", { class: "rl-editpage__grid" }, fold, main));
  return { root, header, title, lede, back, bar, contents, fold, plate, alert, scope };
}

/** The plate for a recipe that is not there. */
export function notFoundPlate() {
  return h("div", { class: "kp-empty" }, h("p", { class: "kp-empty__title" }, t("ep.notFoundTitle")), h("p", { class: "kp-empty__body" }, t("ep.notFoundText")), h("a", { class: "kp-button kp-button--primary", href: "/recipes" }, t("ep.openRecipes")));
}
