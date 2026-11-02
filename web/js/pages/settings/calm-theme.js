// The two device-level rows: calm mode and the theme. The package keeps both per device; this only says what they are now.

import { $ } from "../../dom.js";
import { PICK_EVENT, THEMES } from "/static/kp/dist/kp-themes.min.js";
import { t } from "../../i18n/index.js";

/** A theme's own name. @param {string} name */
const themeLabel = (name) => THEMES.find((th) => th.name === name)?.label ?? name;

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
 * Name the theme on the settings row's labelled trigger after a pick in ANOTHER menu (the header's). The kit renames the
 * trigger only for a pick in its own menu (kp-themes 12.2.0, kp-gaps/kitchen.md), so the row said "Formal" while the page
 * wore Dark. Same words and accessible name as the kit writes: the option's own text. Drop when the kit follows every pick.
 * @param {HTMLElement} host @param {string} name
 */
function nameTrigger(host, name) {
  const trigger = host.querySelector('[data-kp-theme-trigger="label"]');
  const word = trigger?.querySelector(".kp-theme-menu__current");
  const option = host.querySelector(`[data-kp-theme="${CSS.escape(name)}"]`)?.textContent?.trim();
  if (!(trigger instanceof HTMLElement) || !word || !option) return;
  word.textContent = option;
  trigger.setAttribute("aria-label", `${trigger.dataset.kpThemeLabel ?? ""}: ${option}`);
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
  const paintTheme = (/** @type {string} */ name) => {
    saidOf(root, "theme").textContent = t("set.themeOn", themeLabel(name));
  };
  paintTheme(doc.getAttribute("data-theme") ?? "formal");
  // On the document: the header's menu changes the theme too, and the pick event bubbles.
  const picked = (/** @type {Event} */ event) => {
    const name = /** @type {CustomEvent} */ (event).detail.theme;
    paintTheme(name);
    if (!(event.target instanceof Node && el.themeHost.contains(event.target))) nameTrigger(el.themeHost, name);
  };
  doc.addEventListener(PICK_EVENT, picked);
  return () => {
    doc.removeEventListener("kp-calm-change", calm);
    doc.removeEventListener(PICK_EVENT, picked);
  };
}
