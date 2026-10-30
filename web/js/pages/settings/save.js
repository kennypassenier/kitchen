// Saving a row: the default buttons, the controls' change events, the flash on the row's button and what the kitchen holds.

import { h, $ } from "../../dom.js";
import { patchSettings, loadKitchen } from "../../api.js";
import { setCardState } from "/static/kp/js/card-state.js";
import { runFlashButton } from "/static/kp/js/flash.js";
import { t } from "../../i18n/index.js";
import { SPARES } from "./consts.js";
import { saidOf } from "./calm-theme.js";
import { haveOf } from "./rows.js";

/**
 * @typedef {object} SettingsCtx
 * @property {HTMLElement} root
 * @property {boolean} alive
 * @property {ReturnType<typeof import("./frame.js").buildFrame>} el
 * @property {Record<string, import("./rows.js").SettingRow>} rows
 * @property {Record<string, string>} lastSaved What the kitchen holds now, so a read does not save itself back.
 */

/** Save one row's value, flash its button and say what it means now. @param {SettingsCtx} ctx @param {string} key @param {string} value */
function saveRow(ctx, key, value) {
  const r = ctx.rows[key];
  const button = /** @type {HTMLElement} */ ($(`#st-${key}-reset`, ctx.root));
  r.write(value);
  void runFlashButton(button, async () => {
    try {
      await patchSettings(r.patch(value));
      ctx.lastSaved[key] = value;
      saidOf(ctx.root, key).textContent = r.said(value);
      return t("set.saved");
    } catch (e) {
      return { error: e instanceof Error ? e.message : t("timing.noAnswer"), remedy: t("set.remedy") };
    }
  });
}

/** Every control saves its row on change; every row's button puts its default back. @param {SettingsCtx} ctx */
export function wireSaves(ctx) {
  const { langGroup, pace, dinner, spare, sound, odds } = ctx.el;
  for (const key of Object.keys(ctx.rows)) {
    const button = /** @type {HTMLElement} */ ($(`#st-${key}-reset`, ctx.root));
    button.addEventListener("click", () => saveRow(ctx, key, ctx.rows[key].def));
  }
  for (const [key, group] of /** @type {[string, HTMLElement][]} */ ([["lang", langGroup], ["pace", pace]])) {
    group.addEventListener("kp-segmented-change", (event) => {
      const { value } = /** @type {CustomEvent} */ (event).detail;
      if (value) saveRow(ctx, key, value);
    });
  }
  dinner.addEventListener("kp-time-change", (event) => {
    const { value } = /** @type {CustomEvent} */ (event).detail;
    if (value && value !== ctx.lastSaved.dinner) saveRow(ctx, "dinner", value);
  });
  for (const [key, select] of /** @type {[string, HTMLSelectElement][]} */ ([["spare", spare], ["sound", sound], ["odds", odds]])) {
    select.addEventListener("change", () => {
      if (select.value !== ctx.lastSaved[key]) saveRow(ctx, key, select.value);
    });
  }
}

/** Put what the kitchen holds into the rows. @param {SettingsCtx} ctx @param {import("../../api.js").Kitchen} k */
function fill(ctx, k) {
  const have = haveOf(k.settings ?? {});
  if (!SPARES.includes(have.spare)) ctx.el.spare.append(h("option", { value: have.spare }, t("timing.minutes", Number(have.spare))));
  Object.assign(ctx.lastSaved, have);
  for (const [key, value] of Object.entries(have)) {
    ctx.rows[key].write(value);
    saidOf(ctx.root, key).textContent = ctx.rows[key].said(value);
  }
  setCardState(ctx.el.calmCard, "ready");
  setCardState(ctx.el.kitchenCard, "ready");
}

/** Read the kitchen and fill the rows, or fail on both cards. @param {SettingsCtx} ctx @param {boolean} [force] */
export async function load(ctx, force = false) {
  const { calmCard, kitchenCard } = ctx.el;
  setCardState(calmCard, "loading");
  setCardState(kitchenCard, "loading");
  try {
    const k = await loadKitchen({ force });
    if (ctx.alive) fill(ctx, k);
  } catch (e) {
    if (!ctx.alive) return;
    const text = `${e instanceof Error ? e.message : t("timing.noAnswer")} ${t("set.failedText")}`;
    setCardState(calmCard, "error", { title: t("set.failedTitle"), text });
    setCardState(kitchenCard, "error", { title: t("set.failedTitle"), text });
  }
}
