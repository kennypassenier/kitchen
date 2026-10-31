// Small shells of the cook screen that several sections use: the section builder with this page's classes, the
// whole-screen plate for a recipe that cannot be shown, and the page header.

import { h } from "../../dom.js";
import { statePlate } from "/static/kp/dist/kp-themes.min.js";
import { t } from "../../i18n/index.js";
import { section as sectionOf } from "../../ui/cards.js";

/** A section: a heading and its one sentence. @param {string} id @param {string} title @param {string} lead @param {...Node} body */
export const section = (id, title, lead, ...body) => sectionOf({ sec: "ck-sec", head: "ck-head" }, id, title, lead, ...body);

/** The whole screen is one plate (no recipe id, or the recipe is gone). @param {import("./index.js").CookCtx} ctx @param {string} title @param {string} text @param {string} label @param {string} href */
export function plateScreen(ctx, title, text, label, href) {
  ctx.root.replaceChildren(
    h(
      "section",
      { class: "kp-card ck-plate", "aria-labelledby": "ck-plate-h" },
      h("h1", { class: "kp-sr-only", id: "ck-plate-h" }, t("cook.mode")),
      statePlate(document, { kind: "empty", title, text, actionLabel: label, onAction: () => ctx.navigate(href) }),
    ),
  );
}

/** The page header: the title, its sentence and the actions the recipe fills in later. */
export function buildHeader() {
  const title = h("h1", { class: "kp-page-header__title" }, t("cook.title"));
  const lead = h("p", { class: "kp-page-header__description" }, t("cook.lead"));
  const actions = h("div", { class: "kp-page-header__actions" });
  const header = h("header", { class: "kp-page-header" }, h("div", { class: "kp-page-header__inner" }, h("div", null, title, lead), actions));
  return { header, title, lead, actions };
}
