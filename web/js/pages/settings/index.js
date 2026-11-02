// Calm settings: the approved design's settings section (research/audhd-recepten/recipe, as rebuilt in
// grid-fix): one form grid with the calm switch, the theme and the language, each with what it says now, and since
// feat-offline-kitchen the device's offline copy ("Keep everything offline", offline-row.js).
// The same grid then holds the kitchen settings the other screens read: dinner time, pace, time to spare,
// timer sound and the wheel's odds. Calm mode and the theme are kept per device by kp-themes itself; the
// rest is saved with patchSettings and confirmed on the row's button the way the design confirms (flash).

// Split on 30/10/2026 (docs/agent/MODULARITY.md): this file joins the parts. frame.js builds the two cards and their
// controls, calm-theme.js reads the device-level rows, rows.js says how each saved row reads and writes, save.js
// saves them and fills them from the kitchen.

import { setCardState, attachCardStates } from "/static/kp/dist/js/card-state.js";
import { attachCalm } from "/static/kp/dist/js/calm.js";
import { attachSwitches } from "/static/kp/dist/js/forms.js";
import { attachThemePickers } from "/static/kp/dist/js/picker.js";
import { attachSegmented } from "/static/kp/dist/js/segmented.js";
import { attachTimes } from "/static/kp/dist/js/timefield.js";
import { attachSelects } from "/static/kp/dist/js/combobox.js";
import { attachFlashButtons } from "/static/kp/dist/js/flash.js";
import { t } from "../../i18n/index.js";
import { buildFrame } from "./frame.js";
import { watchCalmAndTheme } from "./calm-theme.js";
import { settingRows } from "./rows.js";
import { wireSaves, load } from "./save.js";
import { wireOffline } from "./offline-row.js";

/** @param {HTMLElement} root */
export function mount(root) {
  document.title = `${t("nav.settings")} · Kitchen`;
  /** @type {(() => void)[]} */
  const cleanups = [];
  const el = buildFrame(root);
  /** @type {import("./save.js").SettingsCtx} */
  const ctx = { root, alive: true, el, rows: settingRows(el), lastSaved: {} };
  cleanups.push(() => {
    ctx.alive = false;
  });
  setCardState(el.calmCard, "loading");
  setCardState(el.kitchenCard, "loading");
  cleanups.push(attachCardStates(root));
  cleanups.push(attachSwitches(root), attachCalm(root), attachThemePickers(el.themeHost), attachSegmented(root), attachTimes(el.kitchenGrid), attachSelects(el.kitchenGrid), attachFlashButtons(root));
  cleanups.push(watchCalmAndTheme(root, el));
  cleanups.push(wireOffline(root, el));
  wireSaves(ctx);
  root.addEventListener("kp-card-retry", () => void load(ctx, true));
  void load(ctx);
  return () => {
    for (const off of cleanups) off();
  };
}
