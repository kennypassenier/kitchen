// Calm settings: the approved design's settings section (research/audhd-recepten/recipe, as rebuilt in
// grid-fix): one form grid with the calm switch, the theme and the language, each with what it says now.
// The same grid then holds the kitchen settings the other screens read: dinner time, pace, time to spare,
// timer sound and the wheel's odds. Calm mode and the theme are kept per device by kp-themes itself; the
// rest is saved with patchSettings and confirmed on the row's button the way the design confirms (flash).

import { h, $ } from "../dom.js";
import { loadKitchen, patchSettings } from "../api.js";
import { setCardState, attachCardStates } from "/static/kp/js/card-state.js";
import { attachCalm } from "/static/kp/js/calm.js";
import { attachSwitches } from "/static/kp/js/forms.js";
import { attachThemePickers, themeMenuMarkup, THEMES, PICK_EVENT } from "/static/kp/js/theme-picker.js";
import { attachSegmented, setSegmentedValues } from "/static/kp/js/segmented.js";
import { attachTimes, setTime } from "/static/kp/js/timefield.js";
import { attachSelects, drawnSelect } from "/static/kp/js/combobox.js";
import { attachFlashButtons, runFlashButton } from "/static/kp/js/flash.js";
import { t } from "../i18n/index.js";
import { section as sectionOf, stageCard } from "../ui/cards.js";

/** @typedef {{ key: string, label: string, text: string, said: (value: string) => string, def: string, defSaid: string }} Kitchen */

/** What each kitchen setting is called, says and falls back to. */
const SPARES = ["0", "5", "10", "15"];
const SOUND_KEYS = ["chime", "bell", "buzzer", "off"];
const ODDS_KEYS = ["equal", "recency", "freezer"];
const soundName = (/** @type {string} */ v) => t(`set.sound.${v}`);
const oddsName = (/** @type {string} */ v) => t(`set.odds.${v}`);
const DEFAULTS = { dinner_time: "18:30", pace: "normal", spare: "0", timer_sound: "chime", odds: "equal", lang: "en" };

/** @param {string} v */
const spareWords = (v) => (v === "0" ? t("set.spareNone") : t("set.spareSome", v));

/**
 * One row of the form grid: the name with its sentence, the control, what it says now and (for a saved setting) the
 * button that puts the default back.
 * @param {{ id: string, title: string, text: string, control: Node, said?: string, extra?: Node | null, action?: Node | null, controlLabelFor?: string }} o
 */
function row({ id, title, text, control, said = "", extra = null, action = null, controlLabelFor }) {
  return h(
    "div",
    { class: "kp-formgrid__row", id: `st-row-${id}` },
    h(
      controlLabelFor ? "label" : "div",
      { class: "kp-formgrid__label st-name", for: controlLabelFor },
      h("span", { class: "st-name__title", id: `st-${id}-t` }, title),
      h("span", { class: "st-name__text" }, text),
    ),
    h("div", { class: "kp-formgrid__control" }, control),
    h("div", { class: "kp-formgrid__value st-value" }, h("p", { class: "st-said", id: `st-${id}-said`, role: "status", "aria-live": "polite" }, said), extra, h("p", { class: "st-line", id: `st-${id}-line`, role: "status" })),
    h("div", { class: "kp-formgrid__actions" }, action),
  );
}

/** A segmented control of the package. @param {string} label @param {[string, string][]} items @param {string} id */
function segmented(label, items, id) {
  return h(
    "div",
    { class: "kp-segmented kp-formgrid__short", "data-kp-segmented": "single", role: "radiogroup", "aria-label": label, id },
    ...items.map(([value, text]) =>
      h("button", { type: "button", class: "kp-segmented__item", "data-value": value, role: "radio", "aria-checked": "false" }, h("span", { class: "kp-segmented__label" }, text)),
    ),
  );
}

/** A card of this screen, in its loading state from the first frame. @param {string} id @param {string} title @param {string} text @param {string} loading */
const card = (id, title, text, loading) => stageCard({ id, label: title, loading, cls: "st-card", dataCls: "st-data" });

/** @param {HTMLElement} root */
export function mount(root) {
  document.title = `${t("nav.settings")} · Kitchen`;
  /** @type {(() => void)[]} */
  const cleanups = [];
  let alive = true;
  cleanups.push(() => {
    alive = false;
  });

  // ---- the frame: both cards loading from the first frame, their grids already in place ----------------------
  const calmCard = card("st-calm-card", t("set.calmCard"), "", t("set.loading"));
  const kitchenCard = card("st-kitchen-card", t("set.kitchenCard"), "", t("set.loading"));

  /** @param {string} id @param {string} title @param {string} text @param {HTMLElement} body */
  const section = (id, title, text, body) => sectionOf({ sec: "st-sec", head: "st-sec__head" }, id, title, text, body);

  // Calm mode
  const calmInput = /** @type {HTMLInputElement} */ (
    h("input", { class: "kp-switch__input", type: "checkbox", role: "switch", id: "st-calm-switch", "data-kp-calm-switch": "" })
  );
  const calmControl = h("label", { class: "kp-switch" }, calmInput, h("span", { class: "kp-switch__state", "aria-hidden": "true" }), h("span", null, t("set.useCalm")));
  // Theme
  const themeHost = h("div", { id: "st-theme-host" });
  themeHost.innerHTML = themeMenuMarkup({ id: "st-theme-menu", label: t("shell.theme") });
  // Language
  const langGroup = segmented(t("shell.language"), [["nl", "NL"], ["en", "EN"]], "st-lang");
  for (const item of langGroup.querySelectorAll(".kp-segmented__item")) item.setAttribute("aria-label", item.getAttribute("data-value") === "nl" ? "Nederlands" : "English");
  // Kitchen
  const dinner = h("div", { class: "kp-time", id: "st-dinner", "data-kp-time": "", "data-kp-name": "dinner_time", "data-kp-label": t("set.dinnerTitle"), "data-kp-value": DEFAULTS.dinner_time, "data-kp-time-step": "5", "data-kp-time-presets": `${t("timing.early")}=18:00,${t("timing.usual")}=18:30,${t("timing.late")}=19:30` });
  const pace = segmented(t("set.paceTitle"), [["normal", t("set.paceNormal")], ["slow", t("set.paceSlow")]], "st-pace");
  const spare = h("select", { class: "kp-field__input", id: "st-spare", name: "spare", "data-kp-select": "" }, ...SPARES.map((v) => h("option", { value: v }, v === "0" ? t("set.noTime") : t("timing.minutes", Number(v)))));
  const sound = h("select", { class: "kp-field__input", id: "st-sound", name: "timer_sound", "data-kp-select": "" }, ...SOUND_KEYS.map((v) => h("option", { value: v }, soundName(v))));
  const odds = h("select", { class: "kp-field__input", id: "st-odds", name: "odds", "data-kp-select": "" }, ...ODDS_KEYS.map((v) => h("option", { value: v }, v === "equal" ? t("set.defaultSuffix", oddsName(v)) : oddsName(v))));

  /** The button of a saved row: puts the default back, and says what it did. @param {string} key @param {string} defSaid */
  const reset = (key, defSaid) =>
    h("button", { type: "button", class: "kp-button kp-button--sm", id: `st-${key}-reset`, "data-kp-flash-button": "", "data-kp-flash-words": t("set.flashWords"), "data-kp-flash-line": `#st-${key}-line`, title: t("set.putsBack", defSaid) }, t("set.useDefault"));
  /** The sentence under a saved row's reading that says what its button does. @param {string} defSaid */
  const resetText = (defSaid) => h("small", { class: "st-hint" }, t("set.useDefaultHint", defSaid));

  const calmGrid = h(
    "div",
    { class: "kp-formgrid", "data-kp-formgrid-lines": "lines", "data-kp-formgrid-align": "center" },
    row({ id: "calm", title: t("set.calmTitle"), text: t("set.calmText"), control: calmControl, said: t("set.calmOffShort") }),
    row({ id: "theme", title: t("shell.theme"), text: t("set.themeText"), control: themeHost, said: "" }),
    row({
      id: "lang",
      title: t("shell.language"),
      text: t("set.langText"),
      control: langGroup,
      said: "",
      extra: resetText(t("set.langDefault")),
      action: reset("lang", t("set.langDefault")),
    }),
  );
  const kitchenGrid = h(
    "div",
    { class: "kp-formgrid", "data-kp-formgrid-lines": "lines", "data-kp-formgrid-align": "center" },
    row({ id: "dinner", title: t("set.dinnerTitle"), text: t("set.dinnerText"), control: dinner, extra: resetText("18:30"), action: reset("dinner", "18:30") }),
    row({ id: "pace", title: t("set.paceTitle"), text: t("set.paceText"), control: pace, extra: resetText(t("set.paceDef")), action: reset("pace", t("set.paceDef")) }),
    row({ id: "spare", title: t("set.spareTitle"), text: t("set.spareText"), control: spare, controlLabelFor: "st-spare", extra: resetText(t("set.spareDef")), action: reset("spare", t("set.spareDef")) }),
    row({ id: "sound", title: t("set.soundTitle"), text: t("set.soundText"), control: sound, controlLabelFor: "st-sound", extra: resetText(soundName("chime").toLowerCase()), action: reset("sound", soundName("chime").toLowerCase()) }),
    row({ id: "odds", title: t("set.oddsTitle"), text: t("set.oddsText"), control: odds, controlLabelFor: "st-odds", extra: resetText(oddsName("equal").toLowerCase()), action: reset("odds", oddsName("equal").toLowerCase()) }),
  );
  /** @type {HTMLElement} */ ($("#st-calm-card-data", calmCard)).append(calmGrid);
  /** @type {HTMLElement} */ ($("#st-kitchen-card-data", kitchenCard)).append(kitchenGrid);

  root.replaceChildren(
    h("header", { class: "st-intro" }, h("h1", null, t("nav.settings")), h("p", null, t("set.intro"))),
    section("st-calm", t("set.calmCard"), t("set.calmSecText"), calmCard),
    section("st-kitchen", t("set.kitchenCard"), t("set.kitchenSecText"), kitchenCard),
  );
  setCardState(calmCard, "loading");
  setCardState(kitchenCard, "loading");
  cleanups.push(attachCardStates(root));

  // ---- behaviour -------------------------------------------------------------------------------------------------
  cleanups.push(attachSwitches(root), attachCalm(root), attachThemePickers(themeHost), attachSegmented(root), attachTimes(kitchenGrid), attachSelects(kitchenGrid), attachFlashButtons(root));

  const doc = document.documentElement;
  const said = (/** @type {string} */ key) => /** @type {HTMLElement} */ ($(`#st-${key}-said`, root));
  const paintCalm = () => {
    const on = doc.hasAttribute("data-kp-calm");
    const readout = said("calm");
    readout.toggleAttribute("data-on", on);
    if (!on) {
      readout.textContent = t("set.calmOff");
      return;
    }
    const scope = doc.getAttribute("data-kp-calm-scope") ?? "effects";
    const what = /** @type {Record<string, string>} */ ({ motion: t("set.scopeMotion"), effects: t("set.scopeEffects"), all: t("set.scopeAll") })[scope] ?? t("set.scopeDefault");
    readout.textContent = t("set.calmOn", what, doc.getAttribute("data-kp-calm-loading") === "still");
  };
  doc.addEventListener("kp-calm-change", paintCalm);
  cleanups.push(() => doc.removeEventListener("kp-calm-change", paintCalm));
  calmInput.addEventListener("change", paintCalm);
  paintCalm();

  const themeLabel = (/** @type {string} */ name) => THEMES.find((th) => th.name === name)?.label ?? name;
  const paintTheme = (/** @type {string} */ name) => {
    said("theme").textContent = t("set.themeOn", themeLabel(name));
  };
  paintTheme(doc.getAttribute("data-theme") ?? "formal");
  themeHost.addEventListener(PICK_EVENT, (event) => paintTheme(/** @type {CustomEvent} */ (event).detail.theme));

  // ---- the saved settings ---------------------------------------------------------------------------------------
  /** What each row reads and says. @type {Record<string, { read: () => string, write: (v: string) => void, said: (v: string) => string, patch: (v: string) => Record<string, unknown>, def: string }>} */
  const rows = {
    lang: {
      read: () => segValue(langGroup),
      write: (v) => setSegmentedValues(langGroup, [v]),
      said: (v) => (v === "nl" ? t("set.langNl") : t("set.langEn")),
      patch: (v) => ({ lang: v }),
      def: DEFAULTS.lang,
    },
    dinner: {
      read: () => timeNow(),
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
    spare: {
      read: () => spare.value,
      write: (v) => {
        spare.value = v;
        drawnSelect(spare)?.refresh();
      },
      said: (v) => t("set.spareSaid", spareWords(v)),
      patch: (v) => ({ spare: Number(v) }),
      def: DEFAULTS.spare,
    },
    sound: {
      read: () => sound.value,
      write: (v) => {
        sound.value = v;
        drawnSelect(sound)?.refresh();
      },
      said: (v) => (v === "off" ? t("set.soundOff") : t("set.soundSaid", soundName(v))),
      patch: (v) => ({ timer_sound: v }),
      def: DEFAULTS.timer_sound,
    },
    odds: {
      read: () => odds.value,
      write: (v) => {
        odds.value = v;
        drawnSelect(odds)?.refresh();
      },
      said: (v) => ({ equal: t("set.oddsEqual"), recency: t("set.oddsRecency"), freezer: t("set.oddsFreezer") })[/** @type {"equal"} */ (v)] ?? "",
      patch: (v) => ({ odds: v }),
      def: DEFAULTS.odds,
    },
  };
  /** @param {HTMLElement} g */
  const segValue = (g) => g.querySelector('[aria-checked="true"]')?.getAttribute("data-value") ?? "";
  const timeNow = () => /** @type {HTMLInputElement | null} */ (dinner.querySelector('input[type="hidden"]'))?.value ?? "";

  /** Save one row's value, flash its button and say what it means now. @param {string} key @param {string} value */
  function saveRow(key, value) {
    const r = rows[key];
    const button = /** @type {HTMLElement} */ ($(`#st-${key}-reset`, root));
    r.write(value);
    void runFlashButton(button, async () => {
      try {
        await patchSettings(r.patch(value));
        lastSaved[key] = value;
        said(key).textContent = r.said(value);
        return t("set.saved");
      } catch (e) {
        return { error: e instanceof Error ? e.message : t("timing.noAnswer"), remedy: t("set.remedy") };
      }
    });
  }

  for (const key of Object.keys(rows)) {
    const button = /** @type {HTMLElement} */ ($(`#st-${key}-reset`, root));
    button.addEventListener("click", () => saveRow(key, rows[key].def));
  }
  for (const [key, group] of /** @type {[string, HTMLElement][]} */ ([["lang", langGroup], ["pace", pace]])) {
    group.addEventListener("kp-segmented-change", (event) => {
      const { value } = /** @type {CustomEvent} */ (event).detail;
      if (value) saveRow(key, value);
    });
  }
  dinner.addEventListener("kp-time-change", (event) => {
    const { value } = /** @type {CustomEvent} */ (event).detail;
    if (value && value !== lastSaved.dinner) saveRow("dinner", value);
  });
  spare.addEventListener("change", () => {
    if (spare.value !== lastSaved.spare) saveRow("spare", spare.value);
  });
  sound.addEventListener("change", () => {
    if (sound.value !== lastSaved.sound) saveRow("sound", sound.value);
  });
  odds.addEventListener("change", () => {
    if (odds.value !== lastSaved.odds) saveRow("odds", odds.value);
  });

  /** What the kitchen holds now, so a read does not save itself back. @type {Record<string, string>} */
  const lastSaved = {};

  /** @param {import("../api.js").Kitchen} k */
  function fill(k) {
    const s = k.settings ?? {};
    /** @type {Record<string, string>} */
    const have = {
      lang: s.lang === "nl" ? "nl" : "en",
      dinner: typeof s.dinner_time === "string" && /^\d{1,2}:\d{2}$/.test(s.dinner_time) ? s.dinner_time : DEFAULTS.dinner_time,
      pace: s.pace === "slow" ? "slow" : "normal",
      spare: String(Number.isFinite(Number(s.spare)) ? Number(s.spare) : 0),
      sound: SOUND_KEYS.includes(s.timer_sound) ? s.timer_sound : DEFAULTS.timer_sound,
      odds: ODDS_KEYS.includes(s.odds) ? s.odds : DEFAULTS.odds,
    };
    if (!SPARES.includes(have.spare)) spare.append(h("option", { value: have.spare }, t("timing.minutes", Number(have.spare))));
    Object.assign(lastSaved, have);
    for (const [key, value] of Object.entries(have)) {
      rows[key].write(value);
      said(key).textContent = rows[key].said(value);
    }
    setCardState(calmCard, "ready");
    setCardState(kitchenCard, "ready");
  }

  async function load(force = false) {
    setCardState(calmCard, "loading");
    setCardState(kitchenCard, "loading");
    try {
      const k = await loadKitchen({ force });
      if (alive) fill(k);
    } catch (e) {
      if (!alive) return;
      const text = `${e instanceof Error ? e.message : t("timing.noAnswer")} ${t("set.failedText")}`;
      setCardState(calmCard, "error", { title: t("set.failedTitle"), text });
      setCardState(kitchenCard, "error", { title: t("set.failedTitle"), text });
    }
  }
  root.addEventListener("kp-card-retry", () => void load(true));
  void load();

  return () => {
    for (const off of cleanups) off();
  };
}
