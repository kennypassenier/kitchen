// A button that opens a small kit popover (`.kp-popover.kp-popover--panel[popover]`, kp-themes 12.2.0's plate for content
// rather than a list): the browser's own popover gives light dismiss, Escape and focus return; the kit's CSS anchors the
// plate under the button, keeps it fixed so it follows the button down a long page and flips it above near the bottom edge.
// Used where a rare action should cost a button, not a card (send to phone, print options, add a safe dish).

import { h } from "../dom.js";

let counter = 0;

/**
 * @param {{ label: string, content: Node[], plate?: string, button?: string, name?: string }} o
 *   `label` is the button's word (a ▾ is added), `content` the plate's children, `plate` extra classes on the plate,
 *   `button` the button's classes (default `kp-button`), `name` what the plate is called for a screen reader.
 * @returns {{ wrap: HTMLElement, button: HTMLButtonElement, plate: HTMLElement, setLabel: (text: string) => void }}
 */
export function popoverButton({ label, content, plate = "", button = "kp-button", name = label }) {
  const id = `app-pop-${(counter += 1)}`;
  const word = h("span", null, label);
  const trigger = /** @type {HTMLButtonElement} */ (
    h("button", { type: "button", class: button, popovertarget: id, "aria-haspopup": "dialog" }, word, h("span", { "aria-hidden": "true" }, " ▾"))
  );
  const panel = h("div", { popover: "auto", id, class: `kp-popover kp-popover--panel app-popover ${plate}`.trim(), role: "dialog", "aria-label": name }, ...content);
  // Style properties, not a style attribute: the page's CSP allows the first only.
  trigger.style.setProperty("anchor-name", `--${id}`);
  panel.style.setProperty("position-anchor", `--${id}`);
  /** @param {string} text */
  const setLabel = (text) => {
    word.textContent = text;
  };
  return { wrap: h("span", { class: "app-popover-wrap" }, trigger, panel), button: trigger, plate: panel, setLabel };
}
