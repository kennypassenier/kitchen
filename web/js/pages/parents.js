// The parents' wheel (route "/parents"): the same page Kenny's parents open on eten.kp-soft.dev, from the same module
// (web/eten/wheel.js), in the language Kitchen is shown in (the module has the words of both), with the dishes in that
// language from behind the login (`/data/wheel/en`, `/data/wheel/nl`), so it works away from home too. The dishes are
// kept on the Dishes page.

import { readWheelEnglish, readWheelDutch } from "../api.js";
import { mountWheel } from "/eten/wheel.js";
import { h } from "../dom.js";
import { t, lang } from "../i18n/index.js";

/** @param {HTMLElement} root */
export function mount(root) {
  document.title = `${t("nav.parents")} · Kitchen`;
  return mountWheel(root, {
    lang: lang(),
    load: () => (lang() === "nl" ? readWheelDutch() : readWheelEnglish()),
    emptyAction: () => [h("a", { class: "kp-button kp-button--primary kp-stateplate__action", href: "/dishes", title: t("parents.dishesTitle") }, t("parents.openDishes"))],
  });
}
