// The parents' wheel in English (route "/parents"): the same page Kenny's parents open in Dutch on eten.kp-soft.dev,
// from the same module (web/eten/wheel.js), so Kenny sees exactly what they see. The dishes behind it are kept on
// the Dishes page.

import { readWheelEnglish } from "../api.js";
import { mountWheel } from "/eten/wheel.js";
import { h } from "../dom.js";

/** @param {HTMLElement} root */
export function mount(root) {
  document.title = "Parents' wheel · Kitchen";
  return mountWheel(root, {
    lang: "en",
    load: () => readWheelEnglish(),
    emptyAction: () => [h("a", { class: "kp-button kp-button--primary kp-stateplate__action", href: "/dishes", title: "Go to the dishes, where a dish is put on this wheel" }, "Open the dishes")],
  });
}
