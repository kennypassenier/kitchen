// The six saved settings: how each is read from its control, written to it, said and patched.

import { setSegmentedValues, setTime, drawnSelect } from "/static/kp/dist/kp-themes.min.js";
import { t } from "../../i18n/index.js";
import { DEFAULTS, SOUND_KEYS, ODDS_KEYS, soundName, spareWords } from "./consts.js";

/** @typedef {{ read: () => string, write: (v: string) => void, said: (v: string) => string, patch: (v: string) => Record<string, unknown>, def: string }} SettingRow */

/** @param {HTMLElement} g */
const segValue = (g) => g.querySelector('[aria-checked="true"]')?.getAttribute("data-value") ?? "";

/** A package select written from code. @param {HTMLSelectElement} select @param {string} v */
function writeSelect(select, v) {
  select.value = v;
  drawnSelect(select)?.refresh();
}

/** The rows with a segmented control or the time field. @param {{ langGroup: HTMLElement, dinner: HTMLElement, pace: HTMLElement }} el @returns {Record<string, SettingRow>} */
function controlRows({ langGroup, dinner, pace }) {
  return {
    lang: {
      read: () => segValue(langGroup),
      write: (v) => setSegmentedValues(langGroup, [v]),
      said: (v) => (v === "nl" ? t("set.langNl") : t("set.langEn")),
      patch: (v) => ({ lang: v }),
      def: DEFAULTS.lang,
    },
    dinner: {
      read: () => /** @type {HTMLInputElement | null} */ (dinner.querySelector('input[type="hidden"]'))?.value ?? "",
      write: (v) => setTime(dinner, v),
      said: (v) => t("set.dinnerSaid", v),
      patch: (v) => ({ dinner_time: v }),
      def: DEFAULTS.dinner_time,
    },
    pace: {
      read: () => segValue(pace),
      write: (v) => setSegmentedValues(pace, [v]),
      said: (v) => (v === "slow" ? t("set.paceSaidSlow") : t("set.paceSaidNormal")),
      patch: (v) => ({ pace: v }),
      def: DEFAULTS.pace,
    },
  };
}

/** The rows with a select. @param {{ spare: HTMLSelectElement, sound: HTMLSelectElement, odds: HTMLSelectElement }} el @returns {Record<string, SettingRow>} */
function selectRows({ spare, sound, odds }) {
  return {
    spare: {
      read: () => spare.value,
      write: (v) => writeSelect(spare, v),
      said: (v) => t("set.spareSaid", spareWords(v)),
      patch: (v) => ({ spare: Number(v) }),
      def: DEFAULTS.spare,
    },
    sound: {
      read: () => sound.value,
      write: (v) => writeSelect(sound, v),
      said: (v) => (v === "off" ? t("set.soundOff") : t("set.soundSaid", soundName(v))),
      patch: (v) => ({ timer_sound: v }),
      def: DEFAULTS.timer_sound,
    },
    odds: {
      read: () => odds.value,
      write: (v) => writeSelect(odds, v),
      said: (v) => ({ equal: t("set.oddsEqual"), recency: t("set.oddsRecency"), freezer: t("set.oddsFreezer") })[/** @type {"equal"} */ (v)] ?? "",
      patch: (v) => ({ odds: v }),
      def: DEFAULTS.odds,
    },
  };
}

/**
 * What each row reads and says.
 * @param {{ langGroup: HTMLElement, dinner: HTMLElement, pace: HTMLElement, spare: HTMLSelectElement, sound: HTMLSelectElement, odds: HTMLSelectElement }} el
 * @returns {Record<string, SettingRow>}
 */
export function settingRows(el) {
  return { ...controlRows(el), ...selectRows(el) };
}

/** What the kitchen's settings say, brought to the values the rows take. @param {Record<string, any>} s @returns {Record<string, string>} */
export function haveOf(s) {
  return {
    lang: s.lang === "nl" ? "nl" : "en",
    dinner: typeof s.dinner_time === "string" && /^\d{1,2}:\d{2}$/.test(s.dinner_time) ? s.dinner_time : DEFAULTS.dinner_time,
    pace: s.pace === "slow" ? "slow" : "normal",
    spare: String(Number.isFinite(Number(s.spare)) ? Number(s.spare) : 0),
    sound: SOUND_KEYS.includes(s.timer_sound) ? s.timer_sound : DEFAULTS.timer_sound,
    odds: ODDS_KEYS.includes(s.odds) ? s.odds : DEFAULTS.odds,
  };
}
