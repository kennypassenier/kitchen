// Calm settings: the approved design's settings section (research/audhd-recepten/recipe, as rebuilt in
// grid-fix): one form grid with the calm switch, the theme and the language, each with what it says now.
// The same grid then holds the kitchen settings the other screens read: dinner time, pace, time to spare,
// timer sound and the wheel's odds. Calm mode and the theme are kept per device by kp-themes itself; the
// rest is saved with patchSettings and confirmed on the row's button the way the design confirms (flash).

import { h, $ } from "../dom.js";
import { loadKitchen, patchSettings } from "../api.js";
import { setCardState, attachCardStates } from "/kp/js/card-state.js";
import { attachCalm } from "/kp/js/calm.js";
import { attachSwitches } from "/kp/js/forms.js";
import { attachThemePickers, themeMenuMarkup, THEMES, PICK_EVENT } from "/kp/js/theme-picker.js";
import { attachSegmented, setSegmentedValues } from "/kp/js/segmented.js";
import { attachTimes, setTime } from "/kp/js/timefield.js";
import { attachSelects, drawnSelect } from "/kp/js/combobox.js";
import { attachFlashButtons, runFlashButton } from "/kp/js/flash.js";

/** @typedef {{ key: string, label: string, text: string, said: (value: string) => string, def: string, defSaid: string }} Kitchen */

/** What each kitchen setting is called, says and falls back to. */
const SPARES = ["0", "5", "10", "15"];
const SOUNDS = { chime: "Chime", bell: "Bell", buzzer: "Buzzer", off: "Off" };
const ODDS = { equal: "All equal", recency: "Long not eaten first", freezer: "Freezer first" };
const DEFAULTS = { dinner_time: "18:30", pace: "normal", spare: "0", timer_sound: "chime", odds: "equal", lang: "en" };

/** @param {string} v */
const spareWords = (v) => (v === "0" ? "no time to spare" : `${v} minutes to spare`);

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
function card(id, title, text, loading) {
  return h(
    "section",
    { class: "kp-card st-card", id, "data-kp-state": "loading", "aria-label": title, "data-kp-loading-words": loading },
    h("div", { class: "kp-card__stage" }, h("div", { class: "kp-card__data st-data", id: `${id}-data` })),
  );
}

/** @param {HTMLElement} root */
export function mount(root) {
  document.title = "Calm settings · Recepten";
  /** @type {(() => void)[]} */
  const cleanups = [];
  let alive = true;
  cleanups.push(() => {
    alive = false;
  });

  // ---- the frame: both cards loading from the first frame, their grids already in place ----------------------
  const calmCard = card("st-calm-card", "Motion, theme and language", "", "Reading your settings");
  const kitchenCard = card("st-kitchen-card", "Dinner, pace and timers", "", "Reading your settings");

  /** @param {string} id @param {string} title @param {string} text @param {HTMLElement} body */
  const section = (id, title, text, body) =>
    h("section", { class: "st-sec", id, "aria-labelledby": `${id}-h` }, h("div", { class: "st-sec__head" }, h("h2", { id: `${id}-h` }, title), h("p", null, text)), body);

  // Calm mode
  const calmInput = /** @type {HTMLInputElement} */ (
    h("input", { class: "kp-switch__input", type: "checkbox", role: "switch", id: "st-calm-switch", "data-kp-calm-switch": "" })
  );
  const calmControl = h("label", { class: "kp-switch" }, calmInput, h("span", { class: "kp-switch__state", "aria-hidden": "true" }), h("span", null, "Use calm mode"));
  // Theme
  const themeHost = h("div", { id: "st-theme-host" });
  themeHost.innerHTML = themeMenuMarkup({ id: "st-theme-menu", label: "Theme" });
  // Language
  const langGroup = segmented("Language", [["nl", "NL"], ["en", "EN"]], "st-lang");
  for (const item of langGroup.querySelectorAll(".kp-segmented__item")) item.setAttribute("aria-label", item.getAttribute("data-value") === "nl" ? "Dutch" : "English");
  // Kitchen
  const dinner = h("div", { class: "kp-time", id: "st-dinner", "data-kp-time": "", "data-kp-name": "dinner_time", "data-kp-label": "Dinner time", "data-kp-value": DEFAULTS.dinner_time, "data-kp-time-step": "5", "data-kp-time-presets": "Early=18:00,Usual=18:30,Late=19:30" });
  const pace = segmented("Cooking pace", [["normal", "Normal"], ["slow", "Slow"]], "st-pace");
  const spare = h("select", { class: "kp-field__input", id: "st-spare", name: "spare", "data-kp-select": "" }, ...SPARES.map((v) => h("option", { value: v }, v === "0" ? "No time" : `${v} minutes`)));
  const sound = h("select", { class: "kp-field__input", id: "st-sound", name: "timer_sound", "data-kp-select": "" }, ...Object.entries(SOUNDS).map(([v, t]) => h("option", { value: v }, t)));
  const odds = h("select", { class: "kp-field__input", id: "st-odds", name: "odds", "data-kp-select": "" }, ...Object.entries(ODDS).map(([v, t]) => h("option", { value: v }, v === "equal" ? `${t} (default)` : t)));

  /** The button of a saved row: puts the default back, and says what it did. @param {string} key @param {string} defSaid */
  const reset = (key, defSaid) =>
    h("button", { type: "button", class: "kp-button kp-button--sm", id: `st-${key}-reset`, "data-kp-flash-button": "", "data-kp-flash-words": "Saved,Not saved", "data-kp-flash-line": `#st-${key}-line`, title: `Puts back ${defSaid}` }, "Use default");
  /** The sentence under a saved row's reading that says what its button does. @param {string} defSaid */
  const resetText = (defSaid) => h("small", { class: "st-hint" }, `Use default puts back ${defSaid}.`);

  const calmGrid = h(
    "div",
    { class: "kp-formgrid", "data-kp-formgrid-lines": "lines" },
    row({ id: "calm", title: "Calm mode", text: "Turns movement and effects off with one switch. Loading keeps a slow pulse so you can tell it is working.", control: calmControl, said: "Calm mode is off." }),
    row({ id: "theme", title: "Theme", text: "How the app looks. The choice applies at once and is kept for next time.", control: themeHost, said: "" }),
    row({
      id: "lang",
      title: "Language",
      text: "The language of the recipes and the buttons. Dutch arrives later: the screens are English for now.",
      control: langGroup,
      said: "",
      extra: resetText("English"),
      action: reset("lang", "English"),
    }),
  );
  const kitchenGrid = h(
    "div",
    { class: "kp-formgrid", "data-kp-formgrid-lines": "lines" },
    row({ id: "dinner", title: "Dinner time", text: "When you usually eat. The timing screen counts back from it.", control: dinner, extra: resetText("18:30"), action: reset("dinner", "18:30") }),
    row({ id: "pace", title: "Cooking pace", text: "A slow day stretches the steps you do with your hands; the ones you walk away from stay as they are.", control: pace, extra: resetText("normal"), action: reset("pace", "normal") }),
    row({ id: "spare", title: "Time to spare", text: "Minutes between everything being ready and eating.", control: spare, controlLabelFor: "st-spare", extra: resetText("no time"), action: reset("spare", "no time") }),
    row({ id: "sound", title: "Timer sound", text: "What a cooking timer plays when it ends. Off keeps it silent.", control: sound, controlLabelFor: "st-sound", extra: resetText("chime"), action: reset("sound", "chime") }),
    row({ id: "odds", title: "Wheel odds", text: "How the wheel weighs your dishes when it spins.", control: odds, controlLabelFor: "st-odds", extra: resetText("all equal"), action: reset("odds", "all equal") }),
  );
  /** @type {HTMLElement} */ ($("#st-calm-card-data", calmCard)).append(calmGrid);
  /** @type {HTMLElement} */ ($("#st-kitchen-card-data", kitchenCard)).append(kitchenGrid);

  root.replaceChildren(
    h("header", { class: "st-intro" }, h("h1", null, "Calm settings"), h("p", null, "The few things that make the app quieter and fit your kitchen. Each change applies at once.")),
    section("st-calm", "Motion, theme and language", "The three settings a sensitive day reaches for first: one switch that turns movement and effects off, the theme, and the language.", calmCard),
    section("st-kitchen", "Dinner, pace and timers", "What the other screens read: when you eat, how fast you cook, how long the table can wait, the timer sound and how the wheel chooses.", kitchenCard),
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
      readout.textContent = "Calm mode is off. Everything moves the way the theme draws it.";
      return;
    }
    const scope = doc.getAttribute("data-kp-calm-scope") ?? "effects";
    const what = /** @type {Record<string, string>} */ ({ motion: "transitions are off; entrances, glow and flicker still play", effects: "transitions, entrances, glow and flicker are off", all: "everything is off" })[scope] ?? "movement is off";
    readout.textContent = `Calm mode is on: ${what}. ${doc.getAttribute("data-kp-calm-loading") === "still" ? "Loading holds still." : "Loading breathes as one slow pulse."}`;
  };
  doc.addEventListener("kp-calm-change", paintCalm);
  cleanups.push(() => doc.removeEventListener("kp-calm-change", paintCalm));
  calmInput.addEventListener("change", paintCalm);
  paintCalm();

  const themeLabel = (/** @type {string} */ name) => THEMES.find((t) => t.name === name)?.label ?? name;
  const paintTheme = (/** @type {string} */ name) => {
    said("theme").textContent = `${themeLabel(name)} is on. It applies at once and is kept for next time.`;
  };
  paintTheme(doc.getAttribute("data-theme") ?? "formal");
  themeHost.addEventListener(PICK_EVENT, (event) => paintTheme(/** @type {CustomEvent} */ (event).detail.theme));

  // ---- the saved settings ---------------------------------------------------------------------------------------
  /** What each row reads and says. @type {Record<string, { read: () => string, write: (v: string) => void, said: (v: string) => string, patch: (v: string) => Record<string, unknown>, def: string }>} */
  const rows = {
    lang: {
      read: () => segValue(langGroup),
      write: (v) => setSegmentedValues(langGroup, [v]),
      said: (v) => (v === "nl" ? "Dutch chosen, kept for when it arrives. The screens stay English for now." : "English. Dutch arrives later; your choice is kept."),
      patch: (v) => ({ lang: v }),
      def: DEFAULTS.lang,
    },
    dinner: {
      read: () => timeNow(),
      write: (v) => setTime(dinner, v),
      said: (v) => `Dinner is at ${v}.`,
      patch: (v) => ({ dinner_time: v }),
      def: DEFAULTS.dinner_time,
    },
    pace: {
      read: () => segValue(pace),
      write: (v) => setSegmentedValues(pace, [v]),
      said: (v) => (v === "slow" ? "Slow: hands-on steps take a quarter longer." : "Normal: steps take the time the recipe says."),
      patch: (v) => ({ pace: v }),
      def: DEFAULTS.pace,
    },
    spare: {
      read: () => spare.value,
      write: (v) => {
        spare.value = v;
        drawnSelect(spare)?.refresh();
      },
      said: (v) => `Counting back leaves ${spareWords(v)}.`,
      patch: (v) => ({ spare: Number(v) }),
      def: DEFAULTS.spare,
    },
    sound: {
      read: () => sound.value,
      write: (v) => {
        sound.value = v;
        drawnSelect(sound)?.refresh();
      },
      said: (v) => (v === "off" ? "Timers end without a sound." : `Timers end with the ${v}.`),
      patch: (v) => ({ timer_sound: v }),
      def: DEFAULTS.timer_sound,
    },
    odds: {
      read: () => odds.value,
      write: (v) => {
        odds.value = v;
        drawnSelect(odds)?.refresh();
      },
      said: (v) => ({ equal: "Every dish has the same chance.", recency: "Dishes you have not eaten for a long time come up first.", freezer: "Dishes from the freezer come up first." })[/** @type {"equal"} */ (v)] ?? "",
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
        return "Saved";
      } catch (e) {
        return { error: e instanceof Error ? e.message : "The kitchen did not answer.", remedy: "Your choice is still set on this screen: try again in a minute." };
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
      sound: s.timer_sound in SOUNDS ? s.timer_sound : DEFAULTS.timer_sound,
      odds: s.odds in ODDS ? s.odds : DEFAULTS.odds,
    };
    if (!SPARES.includes(have.spare)) spare.append(h("option", { value: have.spare }, `${have.spare} minutes`));
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
      const text = `${e instanceof Error ? e.message : "The kitchen did not answer."} Your calm mode and theme are kept on this device and still work.`;
      setCardState(calmCard, "error", { title: "Your settings could not be read", text });
      setCardState(kitchenCard, "error", { title: "Your settings could not be read", text });
    }
  }
  root.addEventListener("kp-card-retry", () => void load(true));
  void load();

  return () => {
    for (const off of cleanups) off();
  };
}
