// The filter chips as small menus (Kenny, 01/11/2026 20:21, "Klein menu"): each chip is the kit's menu button; it opens a
// menu with Want, Not and Either way (menuitemradio, the current one checked) and shows its answer on the chip as a mark
// and a word, so nothing hides in a press count any more. The model stays the truth (tri.js maps it); this file only
// draws the chips of one group and reports a pick.

import { attachMenuButtons, setMenu, MENU_SELECT_EVENT } from "/static/kp/dist/kp-themes.min.js";
import { h } from "../../dom.js";
import { t } from "../../i18n/index.js";
import { TRI_STATES, isTriState, stateOf, markOf } from "./tri.js";

/** @typedef {{ value: string, label: string, count?: number | null }} ChipItem */
/** @typedef {import("./tri.js").TriState} TriState */

/** The chip menus of one group: its host, its chips by value, and the detach of the kit's wiring. @type {WeakMap<HTMLElement, { items: ChipItem[], counts: Record<string, number | null>, detach: () => void }>} */
const GROUPS = new WeakMap();

/** The words of one answer. @param {TriState} state */
const wordOf = (state) => t(state === "want" ? "wheel.triWant" : state === "not" ? "wheel.triNot" : "wheel.triEither");
/** @param {TriState} state */
const hintOf = (state) => t(state === "want" ? "wheel.triWantHint" : state === "not" ? "wheel.triNotHint" : "wheel.triEitherHint");

/** The menu of one chip, its current answer checked. @param {HTMLElement} wrapper @param {TriState} now */
function fillMenu(wrapper, now) {
  const items = TRI_STATES.map((state) => ({ label: wordOf(state), hint: hintOf(state), value: state, attrs: { role: "menuitemradio", "aria-checked": String(state === now) } }));
  setMenu(wrapper, [{ items }]);
}

/** Paint one chip's answer and count. @param {HTMLElement} wrapper @param {ChipItem} item @param {TriState} state @param {number | null | undefined} count */
function paintChip(wrapper, item, state, count) {
  const button = /** @type {HTMLElement} */ (wrapper.querySelector(".wl-chip__btn"));
  button.dataset.state = state;
  /** @type {HTMLElement} */ (button.querySelector(".wl-chip__mark")).textContent = markOf(state);
  /** @type {HTMLElement} */ (button.querySelector(".wl-chip__state")).textContent = state === "either" ? "" : wordOf(state);
  const badge = /** @type {HTMLElement} */ (button.querySelector(".wl-chip__count"));
  badge.textContent = count == null ? "" : String(count);
  badge.hidden = count == null;
  button.setAttribute("aria-label", t("wheel.chipSays", item.label, wordOf(state), count ?? null));
  fillMenu(wrapper, state);
}

/** One chip: the kit's menu button around a small button with its mark, name, word and count. @param {ChipItem} item */
function buildChip(item) {
  const button = h(
    "button",
    { type: "button", class: "kp-button kp-button--sm wl-chip__btn" },
    h("span", { class: "wl-chip__mark", "aria-hidden": "true" }),
    h("span", { class: "wl-chip__label" }, item.label),
    h("span", { class: "wl-chip__state", "aria-hidden": "true" }),
    h("span", { class: "kp-badge wl-chip__count", "aria-hidden": "true" }),
  );
  return h("div", { class: "kp-menu-button wl-chip", "data-kp-menu-button": "", "data-value": item.value }, button, h("div", { class: "kp-menu kp-menu--rich", role: "menu", "aria-label": item.label }));
}

/**
 * Draw a group's chips (again only when the list of values changed) and paint every answer from the tri.
 * @param {HTMLElement} host @param {ChipItem[]} items @param {import("./logic.js").Tri} tri
 */
export function setChips(host, items, tri) {
  let g = GROUPS.get(host);
  const same = g && g.items.map((i) => i.value + i.label).join() === items.map((i) => i.value + i.label).join();
  if (!g || !same) {
    g?.detach();
    host.replaceChildren(...items.map(buildChip));
    g = { items, counts: g?.counts ?? {}, detach: attachMenuButtons(host) };
    GROUPS.set(host, g);
  }
  paintChips(host, tri);
}

/** Paint every chip's answer and count. @param {HTMLElement} host @param {import("./logic.js").Tri} tri */
export function paintChips(host, tri) {
  const g = GROUPS.get(host);
  if (!g) return;
  for (const item of g.items) {
    const wrapper = /** @type {HTMLElement | null} */ (host.querySelector(`.wl-chip[data-value="${CSS.escape(item.value)}"]`));
    if (wrapper) paintChip(wrapper, item, stateOf(tri, item.value), g.counts[item.value] ?? item.count);
  }
}

/** The counts beside the names (null: not known yet). @param {HTMLElement} host @param {Record<string, number | null>} counts @param {import("./logic.js").Tri} tri */
export function setChipCounts(host, counts, tri) {
  const g = GROUPS.get(host);
  if (!g) return;
  g.counts = counts;
  paintChips(host, tri);
}

/** Listen for a pick in any of the group's menus. @param {HTMLElement} host @param {(value: string, state: TriState) => void} onPick @returns {() => void} */
export function onChipPick(host, onPick) {
  const listener = (/** @type {Event} */ e) => {
    const state = /** @type {CustomEvent} */ (e).detail?.value;
    const value = /** @type {HTMLElement | null} */ (e.target instanceof Element ? e.target.closest(".wl-chip") : null)?.dataset.value;
    if (value !== undefined && isTriState(state)) onPick(value, state);
  };
  host.addEventListener(MENU_SELECT_EVENT, listener);
  return () => {
    host.removeEventListener(MENU_SELECT_EVENT, listener);
    GROUPS.get(host)?.detach();
  };
}
