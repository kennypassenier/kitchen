// What each kitchen setting is called, says and falls back to.

import { t } from "../../i18n/index.js";

export const SPARES = ["0", "5", "10", "15"];
export const SOUND_KEYS = ["chime", "bell", "buzzer", "off"];
export const ODDS_KEYS = ["equal", "recency", "freezer"];
export const soundName = (/** @type {string} */ v) => t(`set.sound.${v}`);
export const oddsName = (/** @type {string} */ v) => t(`set.odds.${v}`);
export const DEFAULTS = { dinner_time: "18:30", pace: "normal", spare: "0", timer_sound: "chime", odds: "equal", lang: "en" };

/** @param {string} v */
export const spareWords = (v) => (v === "0" ? t("set.spareNone") : t("set.spareSome", v));
