// The unsaved bar of the editor page: the kit's own (attachUnsaved), in app-tracking mode. The kit counts the rows marked
// `data-kp-changed`; here a row is a section of the form, marked by comparing the recipe body with how the form opened
// (recipe/editor/sections.js). The bar's Save, Discard and the leave question come back as events the page answers.

import { attachUnsaved, markUnsavedClean, setUnsavedSaving, UNSAVED_SAVE_EVENT, UNSAVED_DISCARD_EVENT, UNSAVED_LEAVE_EVENT } from "/static/kp/dist/js/unsaved.js";
import { SECTIONS } from "../../recipe/editor/sections.js";
import { FORM_EVENTS } from "../../recipe/editor/index.js";

const REFRESH_MS = 150;

/** Mark the sections that changed. @param {HTMLElement} scope @param {string[]} changed @param {{ was: string, now: string }} words */
export function markSections(scope, changed, words) {
  for (const def of SECTIONS) {
    const el = scope.querySelector(`#${def.id}`);
    if (!el) continue;
    const on = changed.includes(def.key);
    el.toggleAttribute("data-kp-changed", on);
    if (on) {
      el.setAttribute("data-kp-was", words.was);
      el.setAttribute("data-kp-now", words.now);
    } else {
      el.removeAttribute("data-kp-was");
      el.removeAttribute("data-kp-now");
    }
  }
}

/**
 * @param {{ root: HTMLElement, bar: HTMLElement, scope: HTMLElement, changed: () => string[], words: () => { was: string, now: string }, onSave: () => void, onDiscard: () => void, onLeave: (path: string) => void }} o
 */
export function createBar({ root, bar, scope, changed, words, onSave, onDiscard, onLeave }) {
  // Attached while the scope is still empty: the kit then holds no per-control baseline, so its Discard puts no value back
  // by itself (the page resets the whole form instead).
  const detach = attachUnsaved(root);
  let timer = 0;
  const refreshNow = () => {
    clearTimeout(timer);
    markSections(scope, changed(), words());
  };
  const refresh = () => {
    clearTimeout(timer);
    timer = window.setTimeout(refreshNow, REFRESH_MS);
  };
  for (const type of FORM_EVENTS) scope.addEventListener(type, refresh);
  bar.addEventListener(UNSAVED_SAVE_EVENT, () => onSave());
  bar.addEventListener(UNSAVED_DISCARD_EVENT, () => onDiscard());
  bar.addEventListener(UNSAVED_LEAVE_EVENT, (event) => {
    const to = new URL(/** @type {CustomEvent} */ (event).detail.href, location.href);
    // Another site: the kit asks its own question and leaves.
    if (to.origin !== location.origin) return;
    event.preventDefault();
    onLeave(to.pathname + to.search + to.hash);
  });
  return {
    refresh,
    refreshNow,
    clean: () => markUnsavedClean(bar),
    saving: (/** @type {boolean} */ on) => setUnsavedSaving(bar, on),
    dispose: () => {
      clearTimeout(timer);
      detach();
    },
  };
}
