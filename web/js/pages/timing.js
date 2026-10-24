// "When do I start?": backward timing. Say when dinner is and the screen counts back through the recipe's
// step times to the moment each track starts: the two-way sentence, the plan as lanes, the start as a disc
// and one gentle nudge. The approved design is research/audhd-recepten/timing (4 of 4 approved; the disc is
// a 60-minute dial). The clock is the real one; dinner time, pace and time to spare come from the settings
// and a change in the sentence saves them.

import { h, $ } from "../dom.js";
import { loadKitchen, patchSettings, recipeById } from "../api.js";
import { setCardState, attachCardStates } from "/static/kp/js/card-state.js";
import { attachTimes, setTime } from "/static/kp/js/timefield.js";
import { attachSelects, combobox, attachComboboxes, drawnSelect } from "/static/kp/js/combobox.js";
import { attachSentences, sentence, setSentenceWhy } from "/static/kp/js/sentence.js";
import { mountTimeline, drawTimeline, setTimelineState } from "../recipe/timeline.js";
import { attachTimerDiscs } from "/static/kp/js/timer-disc.js";
import { attachCountdowns } from "/static/kp/js/countdown.js";
import { setAttention, attachAttention } from "/static/kp/js/attention.js";
import { attachSnoozes, setSnoozedUntil } from "/static/kp/js/snooze.js";
import { attachSwitches } from "/static/kp/js/forms.js";

/** @typedef {import("../api.js").Item} Item */
/** @typedef {{ id: string, label: string, steps: Step[], start: number, series: 1 | 2 | 3 | 4 | 5 }} Lane */
/** @typedef {{ id: string, lane: string, label: string, say: string, mins: number, active: boolean, start: number, end: number }} Step */
/** @typedef {{ serve: number, end: number, lanes: Lane[], start: number, total: number, first: string }} Plan */

const MIN = 60000;
/** The slow-day pace stretches only the hands-on steps. */
const SLOW = 1.25;
const DEFAULTS = { dinner_time: "18:30", pace: "normal", spare: 0 };
const SPARES = [0, 5, 10, 15];
const DIGITS_KEY = "kitchen:timing-digits";

/** @param {number} n */
const pad = (n) => String(n).padStart(2, "0");
const ZONE = "Europe/Brussels";
const parts = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** @param {number} ms @returns {Record<string, number>} the Brussels wall clock at that moment */
function wall(ms) {
  return Object.fromEntries(parts.formatToParts(new Date(ms)).filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)]));
}
/** @param {string} time `HH:MM` @returns {number} that time today in Brussels, epoch ms */
function at(time) {
  const [hh, mm] = time.split(":").map(Number);
  const w = wall(Date.now());
  const guess = Date.UTC(w.year, w.month - 1, w.day, hh, mm);
  const seen = wall(guess);
  // The guess was read as UTC: move it by what Brussels shows against what was asked.
  return guess - (Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute) - guess);
}
/** @param {number} ms @returns {string} `HH:MM` in Brussels */
function hm(ms) {
  const w = wall(ms);
  return `${pad(w.hour)}:${pad(w.minute)}`;
}
/** @param {number} minutes @returns {string} "50 minutes" or "1 h 18 min" */
const words = (minutes) => (minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
/** @param {string} text */
const sentenceCase = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

/** Steps that can be counted back: a recipe needs at least one step with minutes. @param {Item} recipe */
const timedSteps = (recipe) => (recipe.steps ?? []).filter((/** @type {Item} */ s) => Number(s.mins) > 0);
/** @param {Item} recipe */
const hasTimes = (recipe) => timedSteps(recipe).length > 0;

/**
 * Count back from dinner: every lane ends `spare` minutes before it, each step takes its minutes (hands-on ones
 * stretched by the pace) and a lane starts where its first step starts. A step without a track is where the
 * tracks meet: it closes every lane. A recipe without tracks is one lane.
 * @param {Item} recipe
 * @param {{ serve: number, spare: number, pace: number, dropped: Set<string> }} input
 * @returns {Plan | null}
 */
function planFor(recipe, { serve, spare, pace, dropped }) {
  const steps = timedSteps(recipe);
  if (steps.length === 0) return null;
  const tracks = /** @type {Item[]} */ (recipe.tracks ?? []);
  const known = new Set(tracks.map((t) => t.id));
  const meeting = steps.filter((s) => !s.track || !known.has(s.track));
  /** @type {{ id: string, label: string, series: 1 | 2 | 3 | 4 | 5, steps: Item[] }[]} */
  let sources = tracks
    .map((t, i) => ({ id: t.id, label: t.name, series: /** @type {1 | 2 | 3 | 4 | 5} */ ((i % 5) + 1), steps: [...steps.filter((s) => s.track === t.id), ...meeting] }))
    .filter((t) => t.steps.some((s) => s.track === t.id));
  if (sources.length === 0) sources = [{ id: "all", label: recipe.short || recipe.name, series: 1, steps }];
  const kept = sources.filter((t) => !dropped.has(t.id));
  const use = kept.length > 0 ? kept : sources;
  const end = serve - spare * MIN;
  const lanes = use.map((src) => {
    let cursor = end;
    const timed = [...src.steps]
      .reverse()
      .map((s) => {
        const mins = Math.ceil(Number(s.mins) * (s.active ? pace : 1));
        cursor -= mins * MIN;
        return { id: `${src.id}:${s.id}`, lane: src.id, label: sentenceCase(s.say || s.text), say: s.say || String(s.text).toLowerCase(), mins, active: Boolean(s.active), start: cursor, end: cursor + mins * MIN };
      })
      .reverse();
    return { id: src.id, label: src.label, series: src.series, steps: timed, start: cursor };
  });
  const start = Math.min(...lanes.map((l) => l.start));
  const first = lanes.flatMap((l) => l.steps).find((s) => s.start === start);
  return { serve, end, lanes, start, total: end - start, first: first?.say ?? "" };
}

/** "Chop the onion at 17:40, switch the oven on at 18:00 and …", in one sentence. @param {Plan} p */
function startsInWords(p) {
  const sorted = [...p.lanes].sort((a, b) => a.start - b.start);
  const parts = sorted.map((l) => `${l.steps[0].say} at ${hm(l.start)}`);
  if (parts.length === 1) return `${sentenceCase(parts[0])}.`;
  return `${sentenceCase(parts[0])}, ${parts.slice(1).join(" and ")}.`;
}

/** A package button. @param {string} text @param {string} [extra] @param {(e: Event) => void} [onclick] */
function button(text, extra = "", onclick) {
  return h("button", { type: "button", class: `kp-button ${extra}`.trim(), onclick }, text);
}

/** A card in the shape every data card of this screen has. @param {{ id: string, title: string, text: string, loading: string, mod: string }} o */
function card({ id, title, text, loading, mod }) {
  return h(
    "section",
    { class: `kp-card tm-card tm-card--${mod}`, id, "data-kp-state": "loading", "aria-labelledby": `${id}-t`, "data-kp-loading-words": loading },
    h("div", { class: "kp-card__header" }, h("h3", { class: "kp-card__title", id: `${id}-t` }, title)),
    h("p", { class: "kp-card__body", id: `${id}-body` }, text),
    h("div", { class: "kp-card__stage" }, h("div", { class: "kp-card__data tm-data", id: `${id}-data` })),
  );
}

/** A top-level section: heading, one sentence, then its card. @param {string} id @param {string} title @param {string} text @param {HTMLElement} body */
function section(id, title, text, body) {
  return h("section", { class: "tm-sec", id, "aria-labelledby": `${id}-h` }, h("div", { class: "tm-sec__head" }, h("h2", { id: `${id}-h` }, title), h("p", null, text)), body);
}

/** @param {HTMLElement} root @param {{ params: URLSearchParams, navigate: (href: string) => void }} ctx */
export function mount(root, { params, navigate }) {
  const recipeId = params.get("id");
  document.title = "When do I start? · Kitchen";
  /** @type {(() => void)[]} */
  const cleanups = [];
  /** @type {Item | null} */
  let recipe = null;
  let alive = true;
  cleanups.push(() => {
    alive = false;
  });

  // ---- the frame, in its loading state from the first frame ---------------------------------------------------
  const pickCard = card({
    id: "tm-pick-card",
    title: "Your recipes with step times",
    text: "Only recipes whose steps say how long they take can be counted back.",
    loading: "Reading the recipes",
    mod: "pick",
  });
  const sentenceCard = card({ id: "tm-sentence-card", title: "The sentence", text: "", loading: "Reading the step times", mod: "sentence" });
  const planCard = card({ id: "tm-plan-card", title: "Tonight’s plan", text: "", loading: "Counting back from the step times", mod: "plan" });
  const timerCard = card({ id: "tm-timer-card", title: "Until you start", text: "", loading: "Working out the start", mod: "timer" });
  const nudgeCard = card({ id: "tm-nudge-card", title: "The nudge", text: "", loading: "Looking up the start", mod: "nudge" });
  const nonePlate = card({ id: "tm-none-card", title: "Pick a recipe", text: "The sections below fill in once there is a recipe to count back through.", loading: "Reading the recipes", mod: "none" });

  const sections = [
    h(
      "header",
      { class: "tm-intro" },
      h("h1", null, "When do I start?"),
      h("p", null, "Say when you eat and the screen counts back through the recipe’s step times to the moment each part of the meal starts."),
    ),
    section("tm-pick", "Which recipe?", "Choose the recipe to count back from; only recipes with step times are listed.", pickCard),
  ];
  if (recipeId) {
    sections.push(
      section("tm-sentence", "We eat at: the sentence that counts back", "A sentence you fill in. Say when dinner is and it counts back through the recipe’s step times to the moment you start; change the start instead and dinner moves.", sentenceCard),
      section("tm-plan", "Tonight’s plan: one lane per track", "Every part of the meal on its own lane, counted back from dinner, so you see when each one starts and what runs at the same time.", planCard),
      section("tm-timer", "Time until you start: a disc, not ticking numbers", "The wait until the start moment as a coloured disc that shrinks to nothing, so the time left is seen at a glance and no numbers change.", timerCard),
      section("tm-nudge", "A gentle nudge before the start", "Shortly before the start the screen says so once, in plain words, and offers Not yet. Past the start it offers a new dinner time, never a reproach.", nudgeCard),
    );
  } else {
    sections.push(section("tm-none", "Counting back", "Once a recipe is chosen the sentence, the plan, the disc and the nudge appear here.", nonePlate));
  }
  root.replaceChildren(...sections);
  for (const c of root.querySelectorAll(".kp-card")) setCardState(/** @type {HTMLElement} */ (c), "loading");
  cleanups.push(attachCardStates(root));

  // ---- the picker (always there) ------------------------------------------------------------------------------
  const pickData = /** @type {HTMLElement} */ ($("#tm-pick-card-data", root));
  pickData.append(
    h(
      "div",
      { class: "kp-formgrid", "data-kp-formgrid-lines": "lines" },
      h(
        "div",
        { class: "kp-formgrid__row" },
        h("label", { class: "kp-formgrid__label", for: "tm-recipe" }, "Recipe"),
        h(
          "div",
          { class: "kp-formgrid__control" },
          h(
            "div",
            { class: "kp-combobox", "data-kp-combobox": "", "data-kp-match": "substring" },
            h("input", { class: "kp-combobox__input", type: "text", role: "combobox", id: "tm-recipe", "aria-expanded": "false", "aria-controls": "tm-recipe-list", placeholder: "Search your recipes" }),
            h("ul", { class: "kp-combobox__list", id: "tm-recipe-list", role: "listbox", hidden: true }),
            h("p", { class: "kp-combobox__status", "data-kp-combobox-status": "", role: "status", "aria-live": "polite" }),
          ),
        ),
        h("p", { class: "kp-formgrid__value", id: "tm-pick-said", role: "status" }, "Reading the recipes."),
        h("div", { class: "kp-formgrid__actions", id: "tm-pick-actions" }),
      ),
    ),
  );
  const box = /** @type {HTMLElement} */ ($(".kp-combobox", pickData));
  cleanups.push(attachComboboxes(pickData));

  // ---- the sentence's frame ------------------------------------------------------------------------------------
  /** @type {HTMLElement | null} */
  let form = null;
  let eatEl = /** @type {HTMLElement | null} */ (null);
  let startEl = /** @type {HTMLElement | null} */ (null);
  let paceEl = /** @type {HTMLSelectElement | null} */ (null);
  let spareEl = /** @type {HTMLSelectElement | null} */ (null);
  const readout = h("p", { class: "tm-readout tm-readout--sentence", id: "tm-sentence-readout", role: "status" });
  const late = h("div", { class: "kp-alert kp-alert--info tm-late", id: "tm-late", hidden: true });
  const lateTitle = h("strong");
  const lateText = h("span");
  const lateGo = button("", "kp-button--sm");
  late.append(h("div", { class: "kp-alert__body" }, lateTitle, " ", lateText), lateGo);

  if (recipeId) {
    const data = /** @type {HTMLElement} */ ($("#tm-sentence-card-data", root));
    const field = (/** @type {string} */ inner) => `<span class="kp-sentence__field">${inner}</span>`;
    data.innerHTML =
      `<form class="kp-sentence" data-kp-sentence id="tm-sentence" data-kp-look="underline" data-kp-sentence-size="lg" aria-label="When do I start" onsubmit="return false">` +
      `<p class="kp-sentence__text">We eat at ` +
      field(`<span class="kp-time" id="tm-eat" data-kp-time data-kp-time-look="inline" data-kp-label="We eat at" data-kp-name="eat" data-kp-value="18:30" data-kp-time-step="5" data-kp-time-min="16:00" data-kp-time-max="22:00" data-kp-time-presets="Early=18:00,Usual=18:30,Late=19:30"></span>`) +
      `, so I start at ` +
      field(`<span class="kp-time" id="tm-start" data-kp-time data-kp-time-look="inline" data-kp-label="I start at" data-kp-name="start" data-kp-value="17:40" data-kp-time-step="5"></span>`) +
      `. I cook at a ` +
      field(`<select name="pace" aria-label="Cooking pace" id="tm-pace"><option value="normal">normal</option><option value="slow">slow</option></select>`) +
      ` pace and want ` +
      field(`<select name="spare" aria-label="Time to spare" id="tm-spare">${SPARES.map((n) => `<option value="${n}">${n === 0 ? "no time" : `${n} minutes`}</option>`).join("")}</select>`) +
      ` to spare.</p></form>`;
    data.append(readout, late);
    form = /** @type {HTMLElement} */ ($("#tm-sentence", data));
    eatEl = /** @type {HTMLElement} */ ($("#tm-eat", data));
    startEl = /** @type {HTMLElement} */ ($("#tm-start", data));
    paceEl = /** @type {HTMLSelectElement} */ ($("#tm-pace", data));
    spareEl = /** @type {HTMLSelectElement} */ ($("#tm-spare", data));
    cleanups.push(attachTimes(form), attachSelects(form), attachSentences(form));
  }

  // ---- the plan's frame -----------------------------------------------------------------------------------------
  /** @type {HTMLElement | null} */
  let gantt = null;
  const planReadout = h("p", { class: "tm-readout", id: "tm-plan-readout", role: "status" }, "Press a bar or a diamond to read it.");
  if (recipeId) {
    const data = /** @type {HTMLElement} */ ($("#tm-plan-card-data", root));
    const slot = h("div", { id: "tm-gantt-slot" });
    data.append(slot, planReadout);
    // The timeline setup is the one shared with cook mode (recipe/timeline.js).
    const line = mountTimeline(slot, { label: "Tonight's cooking plan, one lane per track", loading: "Counting back from the step times", redraw: () => recipe && drawPlan() });
    gantt = line.el;
    cleanups.push(line.detach);
    // A data area loads under the busy card, with the lane names and the axis beside it.
    setCardState(planCard, "ready");
    gantt.addEventListener("kp-gantt-open", (event) => {
      const { run, point } = /** @type {CustomEvent} */ (event).detail;
      if (run) planReadout.textContent = `${sentenceCase(run.detail)}, ${hm(new Date(run.start).getTime())} to ${hm(new Date(run.end).getTime())}.`;
      else if (point) planReadout.textContent = `${point.label} at ${hm(new Date(point.at).getTime())}.`;
    });
  }

  // ---- the disc's frame -----------------------------------------------------------------------------------------
  const discSlot = h("div", { class: "tm-timer__disc", id: "tm-disc-slot" });
  const digitsSlot = h("div", { class: "tm-timer__digits", id: "tm-digits-slot" });
  const timerReadout = h("p", { class: "tm-readout", id: "tm-timer-readout", role: "status" });
  const upNote = h("div", { class: "kp-alert kp-alert--info tm-up", id: "tm-timer-up", hidden: true });
  const upText = h("span");
  const upTitle = h("strong");
  upNote.append(h("div", { class: "kp-alert__body" }, upTitle, " ", upText));
  const digitsSwitch = /** @type {HTMLInputElement} */ (h("input", { class: "kp-switch__input", type: "checkbox", role: "switch", id: "tm-digits-switch" }));
  let numbers = false;
  try {
    numbers = localStorage.getItem(DIGITS_KEY) === "on";
  } catch {
    // The choice lasts for this visit only.
  }
  digitsSwitch.checked = numbers;
  if (recipeId) {
    const data = /** @type {HTMLElement} */ ($("#tm-timer-card-data", root));
    data.append(
      h("div", { class: "tm-timer" }, discSlot, digitsSlot),
      timerReadout,
      upNote,
      h(
        "div",
        { class: "kp-formgrid", "data-kp-formgrid-lines": "lines" },
        h(
          "div",
          { class: "kp-formgrid__row" },
          h("label", { class: "kp-formgrid__label", for: "tm-digits-switch" }, h("span", null, "Minutes as digits")),
          h(
            "div",
            { class: "kp-formgrid__control" },
            h("label", { class: "kp-switch" }, digitsSwitch, h("span", { class: "kp-switch__state", "aria-hidden": "true" }), h("span", null, "Show digits beside the disc")),
          ),
          h("p", { class: "kp-formgrid__value", id: "tm-digits-said" }, "The disc alone is the calm default; the digits are for days they help."),
        ),
      ),
    );
    cleanups.push(attachSwitches(data));
  }

  // ---- the nudge's frame ----------------------------------------------------------------------------------------
  const band = h("div", { class: "kp-attention", id: "tm-band", "aria-label": "What needs you now" });
  const quiet = h("p", { class: "tm-readout", id: "tm-nudge-quiet", role: "status" });
  const snoozeSlot = h("div", { id: "tm-snooze-slot" });
  const snoozeBox = h("div", { class: "tm-nudge-snooze" }, h("p", { class: "tm-label", id: "tm-snooze-label" }, "Not yet? Remind me in:"), snoozeSlot);
  if (recipeId) {
    /** @type {HTMLElement} */ ($("#tm-nudge-card-data", root)).append(band, quiet, snoozeBox);
    cleanups.push(attachAttention(root));
  }

  // ---- state: what the sentence says, the way the settings keep it ----------------------------------------------
  const state = { eat: DEFAULTS.dinner_time, pace: DEFAULTS.pace, spare: DEFAULTS.spare, /** @type {Set<string>} */ dropped: new Set() };
  /** @type {number | null} */
  let snoozedUntil = null;
  /** @type {Promise<unknown>} */
  let saving = Promise.resolve();
  /** @type {(() => void)[]} */
  let discDetach = [];
  let discStart = 0;
  /** @type {HTMLElement | null} */
  let disc = null;
  /** @type {(() => void) | null} */
  let snoozeDetach = null;

  const paceFactor = () => (state.pace === "slow" ? SLOW : 1);
  const current = () => (recipe ? planFor(recipe, { serve: at(state.eat), spare: state.spare, pace: paceFactor(), dropped: state.dropped }) : null);

  /** Save settings one after the other, and say so in the sentence when they could not be saved. @param {Record<string, unknown>} patch */
  function save(patch) {
    saving = saving.then(async () => {
      try {
        await patchSettings(patch);
        if (form) setSentenceWhy(form, null);
      } catch (e) {
        if (form) setSentenceWhy(form, `Not saved: ${e instanceof Error ? e.message : String(e)} Tonight’s plan still counts with what you chose.`);
      }
    });
  }

  /** Dinner moves to `ms`; shown and saved. @param {number} ms */
  function moveDinner(ms) {
    state.eat = hm(ms);
    if (eatEl) setTime(eatEl, state.eat);
    save({ dinner_time: state.eat });
    state.dropped.clear();
    snoozedUntil = null;
    draw();
  }

  // ---- drawing --------------------------------------------------------------------------------------------------
  function drawSentence() {
    const p = current();
    if (!p || !startEl || !spareEl || !paceEl) return;
    setTime(startEl, hm(p.start));
    const lanes = p.lanes.length === 1 ? "one track" : `${p.lanes.length} tracks`;
    readout.textContent = `${words(Math.round(p.total / MIN))} of cooking in ${lanes}. ${startsInWords(p)}`;
    const passed = Date.now() >= p.start;
    late.hidden = !passed;
    if (passed) {
      const newServe = Date.now() + p.total + state.spare * MIN;
      lateTitle.textContent = `${hm(p.start)} has passed. Nothing is lost.`;
      lateText.textContent = `Start now and dinner is at ${hm(newServe)} instead of ${state.eat}.`;
      lateGo.textContent = `Eat at ${hm(newServe)} instead`;
      lateGo.dataset.serve = String(newServe);
    }
    if (form) sentence(form)?.refresh();
  }

  function drawPlan() {
    const p = current();
    if (!p || !gantt || !recipe) return;
    const lanes = p.lanes.map((l) => ({ id: l.id, label: l.label, sub: `Start at ${hm(l.start)}` }));
    drawTimeline(gantt, {
      lanes: p.lanes.map((l) => ({ id: l.id, label: l.label, sub: `Start at ${hm(l.start)}`, series: l.series })),
      runs: p.lanes.flatMap((l) =>
        l.steps.map((s) => ({
          id: s.id,
          lane: l.id,
          label: s.label,
          start: s.start,
          end: s.end,
          state: /** @type {const} */ ("planned"),
          series: l.series,
          detail: `${s.say}, ${s.mins} min, ${s.active ? "hands on" : "you can walk away"}`,
        })),
      ),
      points: p.lanes.map((l) => ({ id: `${l.id}-start`, lane: l.id, at: l.start, kind: "start", label: `Start: ${l.steps[0].say}`, planned: true })),
      kinds: [{ kind: "start", label: "Where a track starts", shape: "diamond", tone: "info" }],
      // The window holds the plan, not the whole day up to the real now: ten minutes before the first start to a quarter hour after dinner.
      from: p.start - 10 * MIN,
      to: p.serve + 15 * MIN,
      zones: [{ id: "eat", from: p.serve, to: p.serve + 12 * MIN, label: `We eat at ${hm(p.serve)}`, tone: "info" }],
    });
    const dropped = state.dropped.size > 0 ? ` Left out tonight: ${[...state.dropped].map((id) => /** @type {Item[]} */ (recipe?.tracks ?? []).find((t) => t.id === id)?.name ?? id).join(", ")}.` : "";
    /** @type {HTMLElement} */ ($("#tm-plan-card-body", root)).textContent =
      `Counted back from dinner at ${hm(p.serve)}: ${words(Math.round(p.total / MIN))} from the first step to the table. ${p.lanes.map((l) => `${l.label} at ${hm(l.start)}`).join(", ")}.${dropped}`;
  }

  function buildDisc() {
    const p = current();
    if (!p) return;
    for (const off of discDetach) off();
    discDetach = [];
    discStart = p.start;
    // A full dial is 60 minutes (Kenny's changed default): a longer wait leaves the disc full until the last hour.
    discSlot.innerHTML = `<div class="kp-timer-disc" data-kp-timer-disc-until="${p.start}" data-kp-timer-disc-timezone="${ZONE}" data-kp-timer-disc-name="Start cooking" data-kp-timer-disc-scale="60"></div>`;
    digitsSlot.innerHTML = `<div class="kp-countdown tm-digits" data-kp-countdown-until="${p.start}" data-kp-countdown-timezone="${ZONE}" data-kp-countdown-name="Minutes to the start"></div>`;
    disc = /** @type {HTMLElement} */ (discSlot.firstElementChild);
    discDetach.push(attachTimerDiscs(discSlot), attachCountdowns(digitsSlot));
    digitsSlot.hidden = !numbers;
    upNote.hidden = true;
    // The wait is a moment, not a length: both clocks count down to the start by themselves and have no controls.
    disc.addEventListener("kp-countdown-change", drawTimerLine);
    disc.addEventListener("kp-countdown-end", () => {
      const q = current();
      upTitle.textContent = `It is ${hm(Date.now())}.`;
      upText.textContent = q ? `First: ${q.first}. ${startsInWords(q)}` : "";
      upNote.hidden = false;
      drawTimerLine();
      drawNudge();
    });
  }

  function drawTimer() {
    const p = current();
    if (!p) return;
    /** @type {HTMLElement} */ ($("#tm-timer-card-body", root)).textContent =
      `Dinner at ${state.eat}, so the start is ${hm(p.start)}. ${p.start > Date.now() ? `From now that is ${words(Math.max(1, Math.round((p.start - Date.now()) / MIN)))}.` : "That moment has come."}`;
    // The disc is one wait to one moment: it is built again only when that moment moves.
    if (!disc || p.start !== discStart) buildDisc();
    drawTimerLine();
  }

  function drawTimerLine() {
    const p = current();
    if (!p) return;
    const left = Math.round((p.start - Date.now()) / MIN);
    timerReadout.textContent = left > 0 ? `You start at ${hm(p.start)}, in ${words(left)}.` : `It is ${hm(p.start)} or later: the start has come.`;
  }

  /** @returns {import("/static/kp/js/attention.js").AttentionItem[]} */
  function nudgeItems() {
    const p = current();
    if (!p || !recipe) return [];
    const now = Date.now();
    const toStart = p.start - now;
    /** @type {import("/static/kp/js/attention.js").AttentionItem[]} */
    const items = [];
    const cook = () => navigate(`/cook?id=${encodeURIComponent(String(recipe?.id))}`);
    const names = (/** @type {string} */ id) => /** @type {Item[]} */ (recipe?.tracks ?? []).find((t) => t.id === id)?.name ?? id;
    if (state.dropped.size > 0) {
      items.push({
        key: "dropped",
        severity: "info",
        title: `Left out tonight: ${[...state.dropped].map(names).join(", ")}`,
        text: `The plan counts without it. Dinner stays at ${state.eat}.`,
        action: button("Put it back", "kp-button--sm", () => {
          state.dropped.clear();
          draw();
        }),
      });
    }
    if (snoozedUntil !== null) {
      items.push({ key: "snoozed", severity: "info", title: `I will remind you at ${hm(snoozedUntil)}`, text: `Until then nothing else asks for you. The start is ${hm(p.start)}.` });
      return items;
    }
    if (toStart > 10 * MIN) return items;
    if (toStart > 0) {
      items.push({
        key: "soon",
        severity: "info",
        title: `Start in ${words(Math.max(1, Math.ceil(toStart / MIN)))}`,
        text: `First: ${p.first}. Put the board and a knife out now and the first step is already half done.`,
        action: button("I am starting", "kp-button--primary kp-button--sm", cook),
      });
      return items;
    }
    if (-toStart < 2 * MIN) {
      items.push({
        key: "now",
        severity: "warning",
        title: `It is ${hm(p.start)}: time to start`,
        text: startsInWords(p),
        action: button("Start now", "kp-button--primary kp-button--sm", cook),
      });
      return items;
    }
    // Past the start: never a reproach, a new dinner time, or one track left out when that is enough.
    const newServe = now + p.total + state.spare * MIN;
    const actions = h("span", { class: "tm-band-actions" }, button(`Eat at ${hm(newServe)}`, "kp-button--primary kp-button--sm", () => moveDinner(newServe)));
    /** @type {string[]} */
    const fixers = [];
    if (recipe && p.lanes.length > 1) {
      for (const lane of p.lanes) {
        const without = planFor(recipe, { serve: at(state.eat), spare: state.spare, pace: paceFactor(), dropped: new Set([...state.dropped, lane.id]) });
        if (without && without.lanes.length < p.lanes.length && without.start >= now) fixers.push(lane.id);
      }
    }
    for (const id of fixers.slice(0, 2)) {
      actions.append(
        button(`Keep ${state.eat} without ${names(id)}`, "kp-button--sm", () => {
          state.dropped.add(id);
          draw();
        }),
      );
    }
    items.push({
      key: "late",
      severity: "warning",
      title: `It is ${hm(now)}, ${words(Math.round(-toStart / MIN))} past the start. Nothing is lost.`,
      text: `Start now and dinner is at ${hm(newServe)}.${fixers.length ? ` Or keep ${state.eat} and leave one track out.` : ""}`,
      action: actions,
    });
    return items;
  }

  function drawNudge() {
    const p = current();
    if (!p) return;
    if (snoozedUntil !== null && Date.now() >= snoozedUntil) snoozedUntil = null;
    /** @type {HTMLElement} */ ($("#tm-nudge-card-t", root)).textContent = `${recipe?.name}, dinner at ${state.eat}`;
    /** @type {HTMLElement} */ ($("#tm-nudge-card-body", root)).textContent = `The start is ${hm(p.start)}. It is ${hm(Date.now())} now.`;
    const list = nudgeItems();
    setAttention(band, list);
    const early = p.start - Date.now() > 10 * MIN;
    quiet.textContent = list.length === 0 ? `Nothing to do yet. The first nudge comes 10 minutes before ${hm(p.start)}.` : "";
    // Not yet is for a nudge that can wait: not past the start, and only while there is a nudge to put off.
    const waitable = !early && p.start - Date.now() > -2 * MIN && list.some((i) => i.key === "soon" || i.key === "now" || i.key === "snoozed");
    snoozeBox.hidden = !waitable;
    if (waitable && !snoozeDetach) buildSnooze();
    if (!waitable && snoozeDetach) {
      snoozeDetach();
      snoozeDetach = null;
      snoozeSlot.replaceChildren();
    }
  }

  function buildSnooze() {
    snoozeSlot.innerHTML = `<div class="kp-snooze" data-kp-snooze data-kp-snooze-choices="5m 10m pick" data-kp-snooze-max="1h" data-kp-look="chips" data-kp-time-zone="Europe/Brussels"></div>`;
    snoozeDetach = attachSnoozes(snoozeSlot);
    const el = /** @type {HTMLElement} */ (snoozeSlot.firstElementChild);
    el.addEventListener("kp-snooze", (event) => {
      snoozedUntil = new Date(/** @type {CustomEvent} */ (event).detail.until).getTime();
      drawNudge();
    });
    el.addEventListener("kp-snooze-end", () => {
      snoozedUntil = null;
      drawNudge();
    });
    if (snoozedUntil !== null) setSnoozedUntil(el, new Date(snoozedUntil).toISOString());
  }

  function draw() {
    drawSentence();
    drawPlan();
    drawTimer();
    drawNudge();
  }

  // ---- the sentence's behaviour ---------------------------------------------------------------------------------
  if (form && eatEl && startEl && paceEl && spareEl) {
    const onTime = (/** @type {Event} */ event) => {
      const { value } = /** @type {CustomEvent} */ (event).detail;
      if (!value || !recipe) return;
      const source = /** @type {HTMLElement} */ (event.target).closest("[data-kp-time]");
      if (source === eatEl) {
        if (value === state.eat) return;
        state.eat = value;
        save({ dinner_time: value });
      } else if (source === startEl) {
        const p = current();
        if (!p || value === hm(p.start)) return;
        // The start was typed: dinner is where the steps and the spare time end after it.
        state.eat = hm(at(value) + p.total + state.spare * MIN);
        if (eatEl) setTime(eatEl, state.eat);
        save({ dinner_time: state.eat });
      }
      state.dropped.clear();
      snoozedUntil = null;
      draw();
    };
    const onChange = (/** @type {Event} */ event) => {
      if (event.target === paceEl) {
        state.pace = paceEl?.value === "slow" ? "slow" : "normal";
        save({ pace: state.pace });
      } else if (event.target === spareEl) {
        state.spare = Number(spareEl?.value);
        save({ spare: state.spare });
      } else return;
      draw();
    };
    form.addEventListener("kp-time-change", onTime);
    form.addEventListener("change", onChange);
    lateGo.addEventListener("click", () => moveDinner(Number(lateGo.dataset.serve)));
  }
  digitsSwitch.addEventListener("change", () => {
    numbers = digitsSwitch.checked;
    digitsSlot.hidden = !numbers;
    try {
      localStorage.setItem(DIGITS_KEY, numbers ? "on" : "off");
    } catch {
      // The choice lasts for this visit only.
    }
  });

  // ---- the states -----------------------------------------------------------------------------------------------
  const dataCards = [sentenceCard, timerCard, nudgeCard];

  /** The recipes that can be counted back, A to Z. @param {import("../api.js").Kitchen} k */
  const countable = (k) => k.recipes.filter(hasTimes).sort((a, b) => String(a.name).localeCompare(String(b.name)));

  /** @param {unknown} e */
  function failed(e) {
    const text = e instanceof Error ? e.message : "The kitchen did not answer.";
    const options = (/** @type {string} */ title) => ({ title, text: `${text} The recipe is still there; nothing was changed.` });
    setCardState(pickCard, "error", options("The recipes could not be read"));
    setCardState(nonePlate, "error", options("The recipes could not be read"));
    for (const c of dataCards) setCardState(c, "error", options("The step times could not be read"));
    // The timeline shows its own failed plate (with Retry) inside the plan card, as the package's timeline does.
    if (gantt) {
      const o = options("The step times could not be read");
      setCardState(planCard, "ready");
      setTimelineState(gantt, "error", o.title, { text: o.text });
    } else setCardState(planCard, "error", options("The step times could not be read"));
  }

  /** The plate of a recipe that cannot be counted back, with the one action that helps. @param {string} title @param {string} text @param {HTMLElement} action */
  const plate = (title, text, action) => ({ title, text, action });

  /** @param {import("../api.js").Kitchen} k */
  function fill(k) {
    const list = countable(k);
    // The picker: recipes with step times, the chosen one set.
    const listEl = /** @type {HTMLElement} */ ($("#tm-recipe-list", root));
    listEl.querySelectorAll("li[data-kp-option]").forEach((li) => li.remove());
    for (const r of list) listEl.prepend(h("li", { class: "kp-combobox__option", role: "option", "data-kp-option": "", "data-value": r.id }, r.name));
    // Options are kept in name order: prepend reversed them.
    const options = [...listEl.querySelectorAll("li[data-kp-option]")].reverse();
    listEl.prepend(...options);
    const handle = combobox(box);
    handle?.refresh();
    const said = /** @type {HTMLElement} */ ($("#tm-pick-said", root));
    const actions = /** @type {HTMLElement} */ ($("#tm-pick-actions", root));
    box.addEventListener("kp-combobox-change", (event) => {
      const { value } = /** @type {CustomEvent} */ (event).detail;
      if (value && value !== recipeId) navigate(`/timing?id=${encodeURIComponent(value)}`);
    });
    recipe = recipeId ? recipeById(recipeId) : null;
    actions.replaceChildren();
    if (list.length === 0) {
      setCardState(pickCard, "empty", plate("No recipe has step times yet", "Counting back needs to know how long each step takes. Give a recipe’s steps their minutes and it appears here.", h("a", { class: "kp-button kp-button--primary", href: "/recipes" }, "Open the recipes")));
      setCardState(nonePlate, "empty", plate("No recipe has step times yet", "Counting back needs step times. Open the recipes and give a recipe’s steps their minutes.", h("a", { class: "kp-button kp-button--primary", href: "/recipes" }, "Open the recipes")));
      return;
    }
    setCardState(pickCard, "ready");
    if (recipe && hasTimes(recipe)) {
      handle?.set([String(recipe.id)]);
      const lanes = /** @type {Item[]} */ (recipe.tracks ?? []).length;
      said.textContent = `${timedSteps(recipe).length} steps with times${lanes > 1 ? ` in ${lanes} tracks` : ""}, ${words(Number(recipe.minutes) || 0)} start to plate.`;
      actions.append(h("a", { class: "kp-button kp-button--sm", href: `/recipe?id=${encodeURIComponent(String(recipe.id))}` }, "Open the recipe"));
    } else {
      said.textContent = recipeId ? "That recipe has no step times yet." : "Choose a recipe to count back from dinner.";
    }

    if (!recipeId) {
      setCardState(nonePlate, "empty", plate("Pick a recipe", "Choose one above and this page counts back from dinner to the moment you start.", h("button", { type: "button", class: "kp-button kp-button--primary", onclick: () => /** @type {HTMLInputElement | null} */ ($("#tm-recipe", root))?.focus() }, "Choose a recipe")));
      return;
    }
    // The recipe of the link: missing, without step times, or ready.
    if (!recipe || !hasTimes(recipe)) {
      const title = recipe ? "This recipe has no step times yet" : "That recipe is not in the kitchen";
      const text = recipe
        ? "Counting back needs to know how long each step takes. Give every step a time and the sentence, the plan, the disc and the nudge fill themselves in."
        : "The link may be old. Choose one of your recipes to count back from dinner.";
      const again = () => h(recipe ? "a" : "button", recipe ? { class: "kp-button kp-button--primary", href: `/recipe?id=${encodeURIComponent(String(recipe?.id))}` } : { type: "button", class: "kp-button kp-button--primary", onclick: () => /** @type {HTMLInputElement | null} */ ($("#tm-recipe", root))?.focus() }, recipe ? "Open the recipe" : "Choose a recipe");
      for (const c of dataCards) setCardState(c, "empty", plate(title, text, again()));
      if (gantt) setTimelineState(gantt, "ready");
      setCardState(planCard, "empty", plate(title, text, again()));
      return;
    }

    const s = k.settings ?? {};
    state.eat = typeof s.dinner_time === "string" && /^\d{1,2}:\d{2}$/.test(s.dinner_time) ? s.dinner_time : DEFAULTS.dinner_time;
    state.pace = s.pace === "slow" ? "slow" : "normal";
    state.spare = Number.isFinite(Number(s.spare)) ? Number(s.spare) : DEFAULTS.spare;
    if (spareEl && !SPARES.includes(state.spare)) spareEl.append(h("option", { value: state.spare }, `${state.spare} minutes`));
    if (eatEl) {
      // A dinner time outside the usual window still shows: the window widens to hold it.
      const mins = Number(state.eat.slice(0, 2)) * 60 + Number(state.eat.slice(3));
      if (mins < 16 * 60) eatEl.setAttribute("data-kp-time-min", state.eat);
      if (mins > 22 * 60) eatEl.setAttribute("data-kp-time-max", state.eat);
      setTime(eatEl, state.eat);
    }
    if (paceEl) paceEl.value = state.pace;
    if (spareEl) spareEl.value = String(state.spare);
    for (const el of [paceEl, spareEl]) if (el) drawnSelect(el)?.refresh();
    /** @type {HTMLElement} */ ($("#tm-sentence-card-t", root)).textContent = String(recipe.name);
    const tracks = /** @type {Item[]} */ (recipe.tracks ?? []);
    /** @type {HTMLElement} */ ($("#tm-sentence-card-body", root)).textContent =
      tracks.length > 1 ? `${tracks.length} things cook at once: ${tracks.map((t) => String(t.name).toLowerCase()).join(", ").replace(/, ([^,]*)$/, " and $1")}.` : "One track, one step after the other.";
    setCardState(sentenceCard, "ready");
    if (gantt) setTimelineState(gantt, "ready");
    setCardState(planCard, "ready");
    setCardState(timerCard, "ready");
    setCardState(nudgeCard, "ready");
    draw();
  }

  /** @param {boolean} force */
  async function load(force) {
    for (const c of root.querySelectorAll(".kp-card")) {
      if (c === planCard && gantt) {
        setCardState(planCard, "ready");
        setTimelineState(gantt, "loading");
      } else setCardState(/** @type {HTMLElement} */ (c), "loading");
    }
    try {
      const k = await loadKitchen({ force });
      if (alive) fill(k);
    } catch (e) {
      if (alive) failed(e);
    }
  }
  root.addEventListener("kp-card-retry", () => void load(true));
  gantt?.addEventListener("kp-gantt-retry", () => void load(true));
  void load(false);

  // The clock is the real one: the late note, the nudge and the disc's drift are looked at every 15 seconds.
  const tick = window.setInterval(() => {
    if (!recipe || current() === null || planCard.getAttribute("data-kp-state") !== "ready") return;
    drawSentence();
    drawTimer();
    drawNudge();
  }, 15000);
  cleanups.push(() => clearInterval(tick));
  cleanups.push(() => {
    for (const off of discDetach) off();
    snoozeDetach?.();
  });

  return () => {
    for (const off of cleanups) off();
  };
}
