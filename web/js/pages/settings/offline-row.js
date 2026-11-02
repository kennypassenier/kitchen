// The Calm settings row "Keep everything offline" / "Alles offline bewaren" (feat-offline-kitchen, Kenny 02/11/2026:
// on by default). A device-level setting like calm mode and the theme: the kit keeps it per device (`keepAll`), so it
// is not saved in the kitchen. The row says how much room the copy takes on this device (`usage()`), and its button
// "Clear offline copy" deletes the copy; edits still waiting to be sent are not touched (the kit's `clearCopy` keeps
// the queue), so nothing typed is lost by clearing.
//
// With the setting off, the row also says how many recipes are kept one by one (feat-offline-recipe, the recipe page's
// "Keep offline" toggle), once per-recipe keeping is live (offline/config.js PER_RECIPE_KEEP). "Clear offline copy"
// clears those copies too (the kit's `clearCopy` clears every kept answer); the recipes stay marked, so the next read
// with a connection copies them again.

import { h, $ } from "../../dom.js";
import { runFlashButton } from "/static/kp/dist/js/flash.js";
import { kitData } from "../../api/kit-data.js";
import { lang, t } from "../../i18n/index.js";
import { sizeText } from "../../offline/size.js";
import { PER_RECIPE_KEEP } from "../../offline/config.js";
import { keptCount } from "../../offline/kept.js";
import { loadKitchen } from "../../api.js";
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

/** The row in the Calm grid. @param {ReturnType<typeof offlineControls>} c */
export const offlineRow = (c) =>
  row({ id: "offline", title: t("set.offlineTitle"), text: t("set.offlineText"), control: c.offlineControl, said: t("set.offlineReading"), extra: h("small", { class: "st-hint" }, t("set.offlineClearHint")), action: c.clearButton });

/**
 * Say what the setting does now, how much room the copy takes and, with the setting off, how many recipes are kept
 * one by one (null: not counted, per-recipe keeping is not live).
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
 * How many recipes are kept one by one, counted on the kitchen as last read; null while per-recipe keeping is not live
 * or "keep everything" is on.
 * @param {{ all: boolean, items: string[] }} settings @returns {Promise<{ recipes: number, dishes: number } | null>}
 */
async function countKept(settings) {
  if (!PER_RECIPE_KEEP || settings.all) return null;
  return keptCount(settings.items, await loadKitchen());
}

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
        await (await kitData()).clearCopy();
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
