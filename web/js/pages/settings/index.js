// Calm settings: the approved design's settings section (research/audhd-recepten/recipe, as rebuilt in
// grid-fix): one form grid with the calm switch, the theme and the language, each with what it says now.
// The same grid then holds the kitchen settings the other screens read: dinner time, pace, time to spare,
// timer sound and the wheel's odds. Calm mode and the theme are kept per device by kp-themes itself; the
// rest is saved with patchSettings and confirmed on the row's button the way the design confirms (flash).

// Split on 30/10/2026 (docs/agent/MODULARITY.md): this file joins the parts. frame.js builds the two cards and their
// controls, calm-theme.js reads the device-level rows, rows.js says how each saved row reads and writes, save.js
// saves them and fills them from the kitchen.

import { setCardState, attachCardStates, attachCalm, attachSwitches, attachThemePickers, attachSegmented, attachTimes, attachSelects, attachFlashButtons } from "/static/kp/dist/kp-themes.min.js";
import { t } from "../../i18n/index.js";
import { buildFrame } from "./frame.js";
import { watchCalmAndTheme } from "./calm-theme.js";
import { settingRows } from "./rows.js";
import { wireSaves, load } from "./save.js";

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
  wireSaves(ctx);
  root.addEventListener("kp-card-retry", () => void load(ctx, true));
  void load(ctx);
  return () => {
    for (const off of cleanups) off();
  };
}
