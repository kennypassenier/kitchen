// The Calm settings row "Keep everything offline" / "Alles offline bewaren" (feat-offline-kitchen, Kenny 02/11/2026:
// on by default). A device-level setting like calm mode and the theme: the kit keeps it per device (`keepAll`, which
// since feat-db-pages-1 also decides what its local database stores: everything, or only the kept keys), so it is not
// saved in the kitchen. The row says how much room the copy takes on this device (`usage()`: the local database and
// the queue together). Its button "Clear offline copy" empties the kit's local database (`db.clear()`, chassis-rs
// 4.6.0: the stores and cursors go, the queue and the keep choices stay, usage drops to 0) and its response cache
// (`clearCopy`). It was hidden while the kit had no such call (Kenny 03/11/2026 "Knop verbergen").
//
// With the setting off, the row also says how many recipes are kept one by one (feat-offline-recipe, the recipe page's
// "Keep offline" toggle): the dishes the local database holds (api/recipe-keep.js `keptRecipeCount`).

import { h, $ } from "../../dom.js";
import { runFlashButton } from "/static/kp/dist/js/flash.js";
import { kitData } from "../../api/kit-data.js";
import { lang, t } from "../../i18n/index.js";
import { sizeText } from "../../offline/size.js";
import { keptRecipeCount } from "../../api/recipe-keep.js";
import { row } from "./parts.js";

/** The switch and the clear button of the row. */
export function offlineControls() {
  const offlineInput = /** @type {HTMLInputElement} */ (
    h("input", { class: "kp-switch__input", type: "checkbox", role: "switch", id: "st-offline-switch" })
  );
  const offlineControl = h("label", { class: "kp-switch" }, offlineInput, h("span", { class: "kp-switch__state", "aria-hidden": "true" }), h("span", null, t("set.offlineSwitch")));
  const clearButton = h(
    "button",
    { type: "button", class: "kp-button kp-button--sm", id: "st-offline-clear", "data-kp-flash-button": "", "data-kp-flash-words": t("set.offlineCleared"), "data-kp-flash-line": "#st-offline-line", title: t("set.offlineClearHint") },
    t("set.offlineClear"),
  );
  return { offlineInput, offlineControl, clearButton };
}

/**
 * The row in the Calm grid. The clear button sits in the value cell under its hint, not in the actions column: that
 * column holds the rows' same-width "Use default" buttons, and the wider "Clear offline copy" started 30 px off them at
 * 1280 and wrapped to its own line at 390 (measure.mjs at the 6.0.0 release checks, fix-settings-clear-align-1).
 * @param {ReturnType<typeof offlineControls>} c
 */
export const offlineRow = (c) =>
  row({ id: "offline", title: t("set.offlineTitle"), text: t("set.offlineText"), control: c.offlineControl, said: t("set.offlineReading"), extra: hintAndClear(c.clearButton) });

/** The hint and the clear button as direct children of the value cell (settings.css keys on `.st-value > .st-hint`). @param {Node} button */
function hintAndClear(button) {
  const both = document.createDocumentFragment();
  both.append(h("small", { class: "st-hint" }, t("set.offlineClearHint")), button);
  return both;
}

/**
 * Say what the setting does now, how much room the copy takes and, with the setting off, how many recipes are kept
 * one by one (null: not counted, "keep everything" is on).
 * @param {HTMLElement} root @param {boolean} on @param {{ used: number, max: number }} usage
 * @param {{ recipes: number, dishes: number } | null} kept
 */
function paint(root, on, usage, kept) {
  const said = /** @type {HTMLElement} */ ($("#st-offline-said", root));
  const used = sizeText(usage.used, lang());
  const base = on ? t("set.offlineOn", used, sizeText(usage.max, lang())) : t("set.offlineOff", used);
  said.textContent = !on && kept ? `${base} ${t("set.offlineKept", kept.recipes)}` : base;
}

/**
 * How many recipes are kept one by one; null while "keep everything" is on.
 * @param {{ all: boolean }} settings @returns {Promise<{ recipes: number, dishes: number } | null>}
 */
const countKept = async (settings) => (settings.all ? null : keptRecipeCount());

/** Read the device's setting and usage into the row; a failure is said on the row and in the console. @param {HTMLElement} root @param {HTMLInputElement} input */
async function refresh(root, input) {
  try {
    const kit = await kitData();
    const [settings, usage] = await Promise.all([kit.settings(), kit.usage()]);
    input.checked = settings.all;
    paint(root, settings.all, usage, await countKept(settings));
  } catch (e) {
    console.warn("Kitchen: the offline setting could not be read", e);
    /** @type {HTMLElement} */ ($("#st-offline-said", root)).textContent = t("set.offlineFailed");
  }
}

/**
 * Wire the row: the switch turns keeping on or off for this device, the button clears the copy. Returns the clean-up.
 * @param {HTMLElement} root @param {ReturnType<typeof offlineControls>} c
 */
export function wireOffline(root, c) {
  const { offlineInput, clearButton } = c;
  const onToggle = () => {
    void kitData()
      .then((kit) => kit.keepAll(offlineInput.checked))
      .then(() => refresh(root, offlineInput))
      .catch((e) => {
        console.warn("Kitchen: the offline setting could not be changed", e);
        /** @type {HTMLElement} */ ($("#st-offline-line", root)).textContent = t("set.offlineFailed");
      });
  };
  const onClear = () =>
    void runFlashButton(clearButton, async () => {
      try {
        const kit = await kitData();
        await kit.db.clear();
        await kit.clearCopy();
        await refresh(root, offlineInput);
        return t("set.offlineCleared");
      } catch (e) {
        console.warn("Kitchen: the offline copy could not be cleared", e);
        return { error: t("set.offlineClearFailed"), remedy: t("set.remedy") };
      }
    });
  offlineInput.addEventListener("change", onToggle);
  clearButton.addEventListener("click", onClear);
  void refresh(root, offlineInput);
  return () => {
    offlineInput.removeEventListener("change", onToggle);
    clearButton.removeEventListener("click", onClear);
  };
}
