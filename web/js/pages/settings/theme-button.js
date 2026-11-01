// The theme control of the settings row: the kit's theme menu behind a button that wears the current theme's name
// ("Formal ▾", Kenny 01/11/2026 20:21), where the header's menu is a bare palette icon. The menu, its options, the
// preview and the stored choice are the kit's (themeMenuMarkup + attachThemePickers); only the trigger is dressed.

import { themeMenuMarkup, THEMES } from "/static/kp/dist/kp-themes.min.js";
import { h } from "../../dom.js";
import { t } from "../../i18n/index.js";

/** A theme's own name. @param {string} name */
export const themeLabel = (name) => THEMES.find((th) => th.name === name)?.label ?? name;

/** The menu in a host element, its trigger a labelled kp-button. @returns {HTMLElement} */
export function themeButtonHost() {
  const host = h("div", { id: "st-theme-host" });
  host.innerHTML = themeMenuMarkup({ id: "st-theme-menu", label: t("shell.theme") });
  const trigger = /** @type {HTMLElement} */ (host.querySelector("[popovertarget]"));
  trigger.className = "kp-button st-theme-button";
  trigger.replaceChildren(h("span", { "data-st-theme-name": "" }), h("span", { "aria-hidden": "true" }, " ▾"));
  return host;
}

/** Write the current theme's name on the button. @param {HTMLElement} host @param {string} name */
export function paintThemeName(host, name) {
  const word = host.querySelector("[data-st-theme-name]");
  if (word) word.textContent = themeLabel(name);
  // The visible name is part of the accessible one ("Theme: Dark"), so voice control can say what it sees.
  host.querySelector("[popovertarget]")?.setAttribute("aria-label", `${t("shell.theme")}: ${themeLabel(name)}`);
}
