// Kitchen's keyboard shortcuts on kp-themes' shortcut sheet (Kenny 04/11/2026, "Venster toevoegen"): `?` opens the
// kit's live sheet (`data-kp-shortcuts-live`, filled from kp's shortcut registry) and every Kitchen key is on it, in
// NL and EN. Keys are matched by `KeyboardEvent.key` (AZERTY types `?`, `,`, `s`, `z` and the arrows as on QWERTY; no
// key here needs AltGr).
//
// Three kinds of entry: a key of one text field (the step move, the quick field's Enter, the tag comma) is listed with
// `where: "field"` (kp-themes 12.7.0: the engine never fires it, the field's own handler does); a key a kp component
// handles elsewhere (the editor's save, the undo toast, the add row, the timeline's links, cook mode's arrows) is listed
// with a `run` that answers `false`, which leaves the key to the component (no preventDefault). Kitchen's own keys are
// kp key specs ("Alt+ArrowUp") read from a `data-kt-<name>-key` attribute with a default (`resolveKeySpec`), as kp's own
// `data-kp-<component>-key` attributes are.

import { registerShortcuts } from "/static/kp/dist/js/shortcuts.js";
import { engineKeys, resolveKeySpec } from "/static/kp/dist/js/key-spec.js";
import { h } from "../dom.js";
import { t } from "../i18n/index.js";

/** @typedef {import("/static/kp/dist/js/shortcuts.js").Shortcut} Shortcut */

/** The default keys of Kitchen's own shortcuts (kp key specs); a `data-kt-<name>-key` attribute on the host overrides one. */
export const KITCHEN_KEYS = Object.freeze({ "step-up": "Alt+ArrowUp", "step-down": "Alt+ArrowDown" });

/**
 * The registrations alive now, so a page's keys go when the page goes. `page` is the page change they were made in: a
 * page builds its elements before they are in the document, so only an element of an earlier page is swept.
 * @type {Set<{ scope: string | Element, stop: () => void, page: number }>}
 */
const live = new Set();

/** The page changes so far (`sweepKeys`). */
let page = 0;

/** A listed key that a kp component handles: the engine leaves it alone. */
export const leaveToComponent = () => false;

/**
 * The key spec `name` for `host`: its `data-kt-<name>-key` attribute, else Kitchen's default (`none` switches it off).
 * @param {Element} host @param {keyof typeof KITCHEN_KEYS} name
 */
export const keyFor = (host, name) => resolveKeySpec(host, `data-kt-${name}-key`, undefined, KITCHEN_KEYS[name]);

/** A key spec as the sheet's entry spells it, or null when the key is off. @param {ReturnType<typeof keyFor>} spec */
export const sheetKeys = (spec) => engineKeys(spec);

/**
 * Put shortcuts on the sheet (and in the engine) for as long as `scope` is on the page, or for the whole visit when the
 * scope is a name. Answers the unregister.
 * @param {string | Element} scope @param {readonly Shortcut[]} list @returns {() => void}
 */
export function listKeys(scope, list) {
  const stop = registerShortcuts(scope, list);
  const entry = { scope, stop, page };
  live.add(entry);
  return () => {
    live.delete(entry);
    stop();
  };
}

/** A page change: unregister the keys of elements of earlier pages that left the document. */
export function sweepKeys() {
  page += 1;
  for (const entry of [...live]) {
    if (typeof entry.scope !== "string" && entry.page < page && !entry.scope.isConnected) {
      live.delete(entry);
      entry.stop();
    }
  }
}

/** The sheet itself, filled by kp from the registry; `?` opens it. @returns {HTMLDialogElement} */
export function keySheet() {
  return /** @type {HTMLDialogElement} */ (
    h(
      "dialog",
      { class: "kp-shortcuts", id: "kt-keys", "data-kp-shortcuts": true, "data-kp-shortcuts-live": true, "data-kp-shortcuts-reserved-group": t("keys.anywhere"), "aria-labelledby": "kt-keys-title" },
      h("h2", { class: "kp-dialog__title", id: "kt-keys-title" }, t("keys.title")),
    )
  );
}

/** The unregister of the page-wide keys, so a language change lists them again in its words. @type {(() => void) | null} */
let pageKeys = null;

/** The keys that hold on every page: the undo toast's Ctrl+Z (it acts while a toast offers Undo). */
export function listPageKeys() {
  pageKeys?.();
  pageKeys = listKeys("kitchen", [{ keys: "Mod Z", what: t("keys.undo"), group: t("keys.anywhere"), run: leaveToComponent }]);
}

/** The sheet's own words and the page-wide keys in the language now shown. @param {HTMLDialogElement} sheet */
export function sayKeys(sheet) {
  sheet.setAttribute("data-kp-shortcuts-reserved-group", t("keys.anywhere"));
  const title = sheet.querySelector("#kt-keys-title");
  if (title) title.textContent = t("keys.title");
  listPageKeys();
}
