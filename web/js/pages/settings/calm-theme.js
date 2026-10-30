// The two device-level rows: calm mode and the theme. The package keeps both per device; this only says what they are now.

import { $ } from "../../dom.js";
import { PICK_EVENT, THEMES } from "/static/kp/js/theme-picker.js";
import { t } from "../../i18n/index.js";

/** The reading under a row. @param {HTMLElement} root @param {string} key */
export const saidOf = (root, key) => /** @type {HTMLElement} */ ($(`#st-${key}-said`, root));

/** What calm mode is doing now. @param {HTMLElement} root */
function paintCalm(root) {
  const doc = document.documentElement;
  const on = doc.hasAttribute("data-kp-calm");
  const readout = saidOf(root, "calm");
  readout.toggleAttribute("data-on", on);
  if (!on) {
    readout.textContent = t("set.calmOff");
    return;
  }
  const scope = doc.getAttribute("data-kp-calm-scope") ?? "effects";
  const what = /** @type {Record<string, string>} */ ({ motion: t("set.scopeMotion"), effects: t("set.scopeEffects"), all: t("set.scopeAll") })[scope] ?? t("set.scopeDefault");
  readout.textContent = t("set.calmOn", what, doc.getAttribute("data-kp-calm-loading") === "still");
}

/**
 * Keep the calm and theme readings current; returns the clean-up.
 * @param {HTMLElement} root @param {{ calmInput: HTMLInputElement, themeHost: HTMLElement }} el
 */
export function watchCalmAndTheme(root, el) {
  const doc = document.documentElement;
  const calm = () => paintCalm(root);
  doc.addEventListener("kp-calm-change", calm);
  el.calmInput.addEventListener("change", calm);
  calm();
  const themeLabel = (/** @type {string} */ name) => THEMES.find((th) => th.name === name)?.label ?? name;
  const paintTheme = (/** @type {string} */ name) => {
    saidOf(root, "theme").textContent = t("set.themeOn", themeLabel(name));
  };
  paintTheme(doc.getAttribute("data-theme") ?? "formal");
  el.themeHost.addEventListener(PICK_EVENT, (event) => paintTheme(/** @type {CustomEvent} */ (event).detail.theme));
  return () => doc.removeEventListener("kp-calm-change", calm);
}
