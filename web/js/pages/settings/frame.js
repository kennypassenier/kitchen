// The settings screen's controls and its two cards, in their loading state from the first frame, grids already in place.

import { h, $ } from "../../dom.js";
import { themeMenuMarkup } from "/static/kp/dist/kp-themes.min.js";
import { t } from "../../i18n/index.js";
import { section as sectionOf } from "../../ui/cards.js";
import { SPARES, SOUND_KEYS, ODDS_KEYS, DEFAULTS, soundName, oddsName } from "./consts.js";
import { row, segmented, card, reset, resetText } from "./parts.js";

/** The calm switch, the theme menu and the language choice. */
function calmControls() {
  const calmInput = /** @type {HTMLInputElement} */ (
    h("input", { class: "kp-switch__input", type: "checkbox", role: "switch", id: "st-calm-switch", "data-kp-calm-switch": "" })
  );
  const calmControl = h("label", { class: "kp-switch" }, calmInput, h("span", { class: "kp-switch__state", "aria-hidden": "true" }), h("span", null, t("set.useCalm")));
  const themeHost = h("div", { id: "st-theme-host" });
  themeHost.innerHTML = themeMenuMarkup({ id: "st-theme-menu", label: t("shell.theme") });
  const langGroup = segmented(t("shell.language"), [["nl", "NL"], ["en", "EN"]], "st-lang");
  for (const item of langGroup.querySelectorAll(".kp-segmented__item")) item.setAttribute("aria-label", item.getAttribute("data-value") === "nl" ? "Nederlands" : "English");
  return { calmInput, calmControl, themeHost, langGroup };
}

/** A package select with its options. @param {string} id @param {string} name @param {HTMLElement[]} options */
const selectOf = (id, name, options) => h("select", { class: "kp-field__input", id, name, "data-kp-select": "" }, ...options);

/** The kitchen settings' controls: dinner time, pace, time to spare, timer sound, the wheel's odds. */
function kitchenControls() {
  const presets = `${t("timing.early")}=18:00,${t("timing.usual")}=18:30,${t("timing.late")}=19:30`;
  const dinner = h("div", { class: "kp-time", id: "st-dinner", "data-kp-time": "", "data-kp-name": "dinner_time", "data-kp-label": t("set.dinnerTitle"), "data-kp-value": DEFAULTS.dinner_time, "data-kp-time-step": "5", "data-kp-time-presets": presets });
  const pace = segmented(t("set.paceTitle"), [["normal", t("set.paceNormal")], ["slow", t("set.paceSlow")]], "st-pace");
  const spare = selectOf("st-spare", "spare", SPARES.map((v) => h("option", { value: v }, v === "0" ? t("set.noTime") : t("timing.minutes", Number(v)))));
  const sound = selectOf("st-sound", "timer_sound", SOUND_KEYS.map((v) => h("option", { value: v }, soundName(v))));
  const odds = selectOf("st-odds", "odds", ODDS_KEYS.map((v) => h("option", { value: v }, v === "equal" ? t("set.defaultSuffix", oddsName(v)) : oddsName(v))));
  return { dinner, pace, spare, sound, odds };
}

const GRID = { class: "kp-formgrid", "data-kp-formgrid-lines": "lines", "data-kp-formgrid-align": "center" };

/** @param {ReturnType<typeof calmControls>} c */
function calmGridOf(c) {
  return h(
    "div",
    GRID,
    row({ id: "calm", title: t("set.calmTitle"), text: t("set.calmText"), control: c.calmControl, said: t("set.calmOffShort") }),
    row({ id: "theme", title: t("shell.theme"), text: t("set.themeText"), control: c.themeHost, said: "" }),
    row({ id: "lang", title: t("shell.language"), text: t("set.langText"), control: c.langGroup, said: "", extra: resetText(t("set.langDefault")), action: reset("lang", t("set.langDefault")) }),
  );
}

/** @param {ReturnType<typeof kitchenControls>} k */
function kitchenGridOf(k) {
  const sound = soundName("chime").toLowerCase();
  const odds = oddsName("equal").toLowerCase();
  return h(
    "div",
    GRID,
    row({ id: "dinner", title: t("set.dinnerTitle"), text: t("set.dinnerText"), control: k.dinner, extra: resetText("18:30"), action: reset("dinner", "18:30") }),
    row({ id: "pace", title: t("set.paceTitle"), text: t("set.paceText"), control: k.pace, extra: resetText(t("set.paceDef")), action: reset("pace", t("set.paceDef")) }),
    row({ id: "spare", title: t("set.spareTitle"), text: t("set.spareText"), control: k.spare, controlLabelFor: "st-spare", extra: resetText(t("set.spareDef")), action: reset("spare", t("set.spareDef")) }),
    row({ id: "sound", title: t("set.soundTitle"), text: t("set.soundText"), control: k.sound, controlLabelFor: "st-sound", extra: resetText(sound), action: reset("sound", sound) }),
    row({ id: "odds", title: t("set.oddsTitle"), text: t("set.oddsText"), control: k.odds, controlLabelFor: "st-odds", extra: resetText(odds), action: reset("odds", odds) }),
  );
}

/** @param {string} id @param {string} title @param {string} text @param {HTMLElement} body */
const section = (id, title, text, body) => sectionOf({ sec: "st-sec", head: "st-sec__head" }, id, title, text, body);

/** Both cards with their grids, put into the root. @param {HTMLElement} root */
export function buildFrame(root) {
  const calmCard = card("st-calm-card", t("set.calmCard"), t("set.loading"));
  const kitchenCard = card("st-kitchen-card", t("set.kitchenCard"), t("set.loading"));
  const calm = calmControls();
  const kitchen = kitchenControls();
  const calmGrid = calmGridOf(calm);
  const kitchenGrid = kitchenGridOf(kitchen);
  /** @type {HTMLElement} */ ($("#st-calm-card-data", calmCard)).append(calmGrid);
  /** @type {HTMLElement} */ ($("#st-kitchen-card-data", kitchenCard)).append(kitchenGrid);
  root.replaceChildren(
    h("header", { class: "st-intro" }, h("h1", null, t("nav.settings")), h("p", null, t("set.intro"))),
    section("st-calm", t("set.calmCard"), t("set.calmSecText"), calmCard),
    section("st-kitchen", t("set.kitchenCard"), t("set.kitchenSecText"), kitchenCard),
  );
  return { calmCard, kitchenCard, calmGrid, kitchenGrid, ...calm, ...kitchen };
}
