// Cook mode: /cook?id=<recipe id>[&mini=1].
//
// One screen in the approved order: the Begin card, which opens the
// mise-en-place checklist; cook mode (one step at a time, the recipe's
// parallel tracks as lanes, the running timers beside it, an attention band
// when one ends); the timer discs; the calm switch; and, when the last step is
// done, the offer to log tonight's dinner. Everything is the package's own
// component with its standard behaviour; this file gives them the recipe.
//
// The place in the recipe (active step, every track, the steps done) is kept
// by focus-steps itself (data-kp-remember). The page keeps only what the
// package does not cover, per recipe in sessionStorage: the running timers,
// whether Begin was pressed and when each step really started and ended.
//
// The timeline (Kenny, 24/10/2026 05:16) is the timing page's gantt, set up by
// recipe/timeline.js: the tracks as rows, a bar per step, the package's line
// for now, the step the cook is on as its running bar and the steps passed as
// finished bars. It follows the real progress: what is still to do is planned
// from this moment, so a step ended early or late shifts the rest.

import { h, $ } from "../dom.js";
import { loadKitchen, onKitchen, recipeById, create, ingredientName } from "../api.js";
import { attachChecklists, setChecklistItems, setChecklistState, getChecklistItems } from "/static/kp/js/checklist.js";
import { attachFocusSteps, setFocusSteps, setFocusStepsState, goToStep, getStepIndex } from "/static/kp/js/focus-steps.js";
import { attachTimers, setTimersState, getTimers, restoreTimers, stopTimer } from "/static/kp/js/timer.js";
import { attachTimerDiscs, timerDiscOf } from "/static/kp/js/timer-disc.js";
import { attachAttention, setAttention } from "/static/kp/js/attention.js";
import { attachCardStates, setCardState } from "/static/kp/js/card-state.js";
import { attachCalm, isCalm, calmScope, motionAllowed } from "/static/kp/js/calm.js";
import { statePlate } from "/static/kp/js/state-plate.js";
import { memoryFor } from "/static/kp/js/remember.js";
import { showPhotos } from "../recipe/photos.js";
import { mountTimeline, drawTimeline, setTimelineState } from "../recipe/timeline.js";
import { lanesOf as scheduleLanes } from "../recipe/schedule.js";
import { wordsFor } from "../recipe/words.js";
import { t, lang } from "../i18n/index.js";

/** @typedef {import("../api.js").Item} Item */

/** The dial the discs measure: 60 minutes, the classic Time Timer (Kenny's default). */
const DIAL_MINUTES = 60;
const MIN = 60000;
const TIMELINE_EVERY_MS = 10000;

/** "2 cloves", "400 g", "1" (a piece) or "" (no amount). @param {Item} ing */
function amountOf(ing) {
  if (ing.amount === null || ing.amount === undefined) return "";
  const n = Math.round(ing.amount * 100) / 100;
  const forms = /** @type {Record<string, string[]>} */ (wordsFor(lang()).units)[ing.unit];
  const unit = ing.unit === "pc" ? "" : forms ? forms[n === 1 ? 0 : 1] : ing.unit || "";
  return `${n} ${unit}`.trim();
}

/** Today's date as stored (ISO, Brussels). */
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" }).format(new Date());

/** "put the pasta water on" → "Put the pasta water on". @param {string} s */
const sentence = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** @param {string} href @param {string} label @param {string} [extra] */
const link = (href, label, extra = "") => h("a", { class: `kp-button ${extra}`.trim(), href }, label);

/** A formgrid row whose control holds buttons and whose value says what they do. @param {string} label @param {HTMLElement[]} buttons @param {string | HTMLElement} says */
function actionRow(label, buttons, says) {
  return h(
    "div",
    { class: "kp-formgrid__row" },
    h("span", { class: "kp-formgrid__label" }, label),
    // One button is the row's action, so the package centres the row on it and gives it the control track on a phone.
    buttons.length === 1
      ? h("div", { class: "kp-formgrid__actions" }, buttons[0])
      : h("div", { class: "kp-formgrid__control" }, h("div", { class: "kp-formgrid__buttons" }, ...buttons)),
    typeof says === "string" ? h("p", { class: "kp-formgrid__value" }, says) : says,
  );
}

/** A section: a heading and its one sentence. @param {string} id @param {string} title @param {string} lead @param {...Node} body */
function section(id, title, lead, ...body) {
  return h(
    "section",
    { class: "ck-sec", id, "aria-labelledby": `${id}-h` },
    h("div", { class: "ck-head" }, h("h2", { id: `${id}-h` }, title), h("p", null, lead)),
    ...body,
  );
}

/**
 * @param {HTMLElement} root
 * @param {{ params: URLSearchParams, navigate: (href: string) => void }} ctx
 */
export function mount(root, { params, navigate }) {
  const recipeId = params.get("id") ?? "";
  const mini = params.get("mini") === "1";
  const storeKey = `kitchen:cook:${recipeId}:${mini ? "mini" : "full"}`;
  // "Yes, cook this" and every "Cook it" arrive with `fresh=1` (Kenny, 29/10/2026): cooking starts at step 1 with no old
  // timers or marks. The mark is taken off the address at once, so a reload of this page keeps the progress made since.
  const fresh = params.get("fresh") === "1";
  if (fresh) {
    const clean = new URL(location.href);
    clean.searchParams.delete("fresh");
    history.replaceState(history.state, "", `${clean.pathname}${clean.search}${clean.hash}`);
  }
  document.title = `${t("cook.title")} · Kitchen`;

  /** @type {(() => void)[]} */
  const undo = [];
  let dead = false;
  let seq = 0;

  // ------------------------------------------------------------------ remembered place
  /** @type {{ started?: boolean, timers?: any[], marks?: Record<string, { start?: number, end?: number }> }} */
  let memo = {};
  try {
    if (fresh) sessionStorage.removeItem(storeKey);
    memo = JSON.parse(sessionStorage.getItem(storeKey) ?? "{}") ?? {};
  } catch {
    memo = {};
  }
  const keep = () => {
    try {
      sessionStorage.setItem(storeKey, JSON.stringify(memo));
    } catch {
      /* no storage: the place is lost on reload, nothing else */
    }
  };

  // ------------------------------------------------------------------ whole-screen plates
  /** @param {string} title @param {string} text @param {string} label @param {string} href */
  function plateScreen(title, text, label, href) {
    root.replaceChildren(
      h(
        "section",
        { class: "kp-card ck-plate", "aria-labelledby": "ck-plate-h" },
        h("h1", { class: "kp-sr-only", id: "ck-plate-h" }, t("cook.mode")),
        statePlate(document, { kind: "empty", title, text, actionLabel: label, onAction: () => navigate(href) }),
      ),
    );
  }

  if (!recipeId) {
    plateScreen(t("cook.notHere"), t("cook.noId"), t("shell.openWheel"), "/");
    return () => {};
  }

  // ------------------------------------------------------------------ the shell, drawn loading from the first frame
  const title = h("h1", { class: "kp-page-header__title" }, t("cook.title"));
  const lead = h("p", { class: "kp-page-header__description" }, t("cook.lead"));
  const actions = h("div", { class: "kp-page-header__actions" });
  const header = h(
    "header",
    { class: "kp-page-header" },
    h("div", { class: "kp-page-header__inner" }, h("div", null, title, lead), actions),
  );

  // Begin
  const beginTitle = h("h3", { class: "kp-card__title" }, t("cook.yourRecipe"));
  // Placeholder rows while loading, so the card holds its filled height.
  const facts = h(
    "dl",
    { class: "kp-kv" },
    ...[t("cook.serves"), t("cook.time"), t("cook.dirties")].map((k) => h("div", { class: "kp-kv__row" }, h("dt", null, k), h("dd", null, "\u2014"))),
  );
  const beginBtn = h("button", { type: "button", class: "kp-button kp-button--primary kp-button--lg" }, t("cook.begin"));
  const beginCard = h(
    "article",
    { class: "kp-card ck-begin__card", "data-kp-state": "loading", "aria-labelledby": "ck-begin-t", "data-kp-loading-words": t("cook.loading") },
    h("div", { class: "kp-card__header" }, beginTitle),
    h(
      "div",
      { class: "kp-card__stage" },
      h(
        "div",
        { class: "kp-card__data" },
        h(
          "div",
          { class: "kp-formgrid" },
          facts,
          actionRow(t("cook.startHere"), [beginBtn], t("cook.startHereSays")),
        ),
      ),
    ),
  );
  beginTitle.id = "ck-begin-t";

  // The checklist
  const mise = h("div", {
    class: "kp-checklist",
    id: "ck-mise",
    "data-kp-checklist": "",
    "aria-label": t("cook.miseLabel"),
    "data-kp-state": "loading",
    "data-kp-checklist-empty": t("cook.miseEmpty"),
    style: "--kp-checklist-min-rows: 10",
  });
  const startBtn = h("button", { type: "button", class: "kp-button kp-button--primary kp-button--lg", "aria-disabled": "true" }, t("cook.startCooking"));
  const skipBtn = h("button", { type: "button", class: "kp-button kp-button--lg" }, t("cook.skip"));
  const readout = h("p", { class: "kp-formgrid__value", role: "status" }, t("cook.takeOut"));
  const miseOpen = h(
    "div",
    { class: "ck-mise", hidden: true },
    mise,
    h(
      "div",
      { class: "kp-formgrid" },
      actionRow(t("cook.allOut"), [startBtn], readout),
      actionRow(t("cook.missing"), [skipBtn], t("cook.missingSays")),
    ),
  );

  // Cook mode
  const band = h("div", { class: "kp-attention", "aria-label": t("cook.needsYou") });
  const steps = h("div", {
    class: "kp-focus-steps",
    id: "ck-steps",
    "data-kp-focus-steps": "",
    "data-kp-focus-steps-timers": "ck-timers",
    "data-kp-focus-steps-wake": "true",
    "data-kp-track-attention": "off",
    "data-kp-state": "loading",
    "data-kp-focus-steps-empty": t("cook.noSteps"),
    "data-kp-focus-steps-empty-action": t("timing.openRecipe"),
    "data-kp-remember": storeKey,
    "aria-label": t("cook.steps"),
  });
  // The photos of the step in hand, large (Kenny, 24/10/2026 05:23); empty and hidden for a step without any.
  const stepPhotos = h("div", { class: "ck-photos", hidden: true });
  const timers = h("div", {
    class: "kp-timers",
    id: "ck-timers",
    "data-kp-timers": "",
    "data-kp-timers-ring": "60",
    "data-kp-timers-sound": "chime",
    "data-kp-timers-empty": t("cook.noTimer"),
    "aria-label": t("cook.kitchenTimers"),
  });
  // The screen (Kenny, 29/10/2026): the package's steps hold a Screen Wake Lock for the whole of cook mode (asked when the
  // steps are given, asked again when the tab is visible again, let go when the page is left). This badge says so, and only
  // while it holds; the package's own screen line is hidden in favour of it (cook.css).
  const wakeBadge = h("span", { class: "kp-badge kp-badge--success ck-wake", role: "status", hidden: true }, t("cook.screenOn"));
  steps.addEventListener("kp-focus-steps-wake", (e) => {
    wakeBadge.hidden = /** @type {CustomEvent} */ (e).detail?.state !== "on";
  });
  const cook = section(
    "ck-cook",
    t("cook.secCook"),
    t("cook.secCookText"),
    h(
      "div",
      { class: "ck-cook" },
      h("div", { class: "ck-cook__main" }, h("div", { class: "ck-part-row" }, h("h3", { class: "ck-part" }, t("cook.steps")), wakeBadge), band, steps, stepPhotos),
      h(
        "div",
        { class: "ck-cook__side" },
        h("h3", { class: "ck-part" }, t("cook.timersRunning")),
        h("p", { class: "ck-part-note" }, t("cook.timersNote")),
        timers,
      ),
    ),
  );

  // The timeline
  const timelineSlot = h("div", { class: "ck-timeline__slot", id: "ck-timeline-slot" });
  const timelineCard = h(
    "article",
    { class: "kp-card ck-timelinecard", "data-kp-state": "ready", "aria-label": t("cook.timeline") },
    h("div", { class: "kp-card__stage" }, h("div", { class: "kp-card__data" }, timelineSlot)),
  );
  const timelineSection = section(
    "ck-timeline",
    t("cook.timeline"),
    t("cook.timelineText"),
    timelineCard,
  );

  // Discs
  const discs = h("div", { class: "ck-discs" });
  const discCard = h(
    "article",
    { class: "kp-card ck-disccard", "data-kp-state": "loading", "aria-label": t("cook.discsLabel"), "data-kp-loading-words": t("cook.loadingTimers") },
    h("div", { class: "kp-card__stage" }, h("div", { class: "kp-card__data" }, discs)),
  );
  const discSection = section(
    "ck-discs",
    t("cook.secDiscs"),
    t("cook.secDiscsText", DIAL_MINUTES),
    discCard,
  );

  // Calm
  const calmSwitch = h("input", { class: "kp-switch__input", type: "checkbox", role: "switch", id: "ck-calm", "data-kp-calm-switch": "" });
  const calmLine = h("p", { class: "kp-formgrid__value", role: "status" });
  const calmSection = section(
    "ck-calm",
    t("set.calmTitle"),
    t("cook.calmText"),
    h(
      "div",
      { class: "kp-formgrid ck-calm" },
      h(
        "div",
        { class: "kp-formgrid__row" },
        h("label", { class: "kp-formgrid__label", for: "ck-calm" }, t("set.calmTitle")),
        h("div", { class: "kp-formgrid__control" }, h("label", { class: "kp-switch" }, calmSwitch, h("span", null, t("cook.calmSwitch")))),
        calmLine,
      ),
    ),
  );
  const paintCalm = () => {
    const scope = calmScope(document);
    const words = scope === "motion" ? t("cook.scopeMotion") : scope === "all" ? t("cook.scopeAll") : t("cook.scopeEffects");
    const loading = document.documentElement.getAttribute("data-kp-calm-loading") === "still" ? t("cook.loadStill") : t("cook.loadBreathes");
    calmLine.textContent = isCalm(document)
      ? t("cook.calmOn", words, loading)
      : t("cook.calmOff");
  };
  document.addEventListener("kp-calm-change", paintCalm);
  undo.push(() => document.removeEventListener("kp-calm-change", paintCalm));

  // Done
  const doneBtn = h("button", { type: "button", class: "kp-button kp-button--primary kp-button--lg" }, t("cook.logDinner"));
  const doneSays = h("p", { class: "kp-formgrid__value" }, t("cook.logSays"));
  const doneFail = h("div", { class: "kp-alert kp-alert--destructive", role: "alert", hidden: true });
  const doneCard = h(
    "article",
    { class: "kp-card ck-donecard" },
    h("div", { class: "kp-card__body" }, doneFail, h("div", { class: "kp-formgrid" }, actionRow(t("cook.dinnerOut"), [doneBtn], doneSays))),
  );
  const doneSection = section(
    "ck-done",
    t("cook.secDone"),
    t("cook.secDoneText"),
    doneCard,
  );
  doneSection.hidden = true;

  const beginSection = section(
    "ck-begin",
    t("cook.secBegin"),
    t("cook.secBeginText"),
    h("div", { class: "ck-begin" }, beginCard, miseOpen),
  );

  root.replaceChildren(header, beginSection, cook, timelineSection, discSection, calmSection, doneSection);

  // Wire the package's components.
  // The place the package remembered is forgotten before the steps are given, so they open on step 1.
  if (fresh) memoryFor(steps, "focus-steps")?.forget("progress");
  undo.push(attachCardStates(root));
  undo.push(attachChecklists(root));
  undo.push(attachFocusSteps(root));
  undo.push(attachTimers(root));
  undo.push(attachAttention(root));
  undo.push(attachCalm(root));
  const line = mountTimeline(timelineSlot, {
    label: t("cook.ganttLabel"),
    loading: t("cook.loadingSteps"),
    strings: { ganttOk: t("cook.ganttOk"), ganttRunning: t("cook.ganttNow"), ganttPlanned: t("cook.ganttPlanned") },
    redraw: () => paintTimeline(),
  });
  undo.push(line.detach);
  setChecklistState(mise, "loading");
  setFocusStepsState(steps, "loading");
  setTimersState(timers, "loading");
  paintCalm();

  /** @type {Item | null} */
  let recipe = null;
  /** @type {Item[]} */
  let shown = [];
  let started = false;

  // ------------------------------------------------------------------ Begin and the checklist
  const openMise = () => {
    if (!miseOpen.hidden || !recipe) return;
    miseOpen.hidden = false;
    paintStart();
    $(".kp-checklist__check", mise)?.focus();
  };
  const paintStart = () => {
    const items = getChecklistItems(mise);
    const left = items.filter((i) => !i.checked).length;
    const all = items.length > 0 && left === 0;
    startBtn.setAttribute("aria-disabled", String(!all));
    readout.textContent = !items.length
      ? t("cook.nothingOut")
      : all
        ? t("cook.everythingOut")
        : t("cook.stillOut", left, items.length);
  };
  beginBtn.addEventListener("click", openMise);
  for (const type of ["kp-checklist-change", "kp-checklist-undo", "kp-checklist-clear", "kp-checklist-render"]) mise.addEventListener(type, paintStart);

  const begin = () => {
    started = true;
    memo.started = true;
    keep();
    cook.scrollIntoView({ block: "start", behavior: motionAllowed(cook) ? "smooth" : "auto" });
    steps.focus({ preventScroll: true });
  };
  startBtn.addEventListener("click", () => {
    if (startBtn.getAttribute("aria-disabled") !== "true") begin();
  });
  skipBtn.addEventListener("click", begin);

  // ------------------------------------------------------------------ steps, tracks and the timers' next step
  /** The recipe's steps the cook sees: all, or the mini ones. @param {Item} r */
  const stepsOf = (r) => (mini ? r.steps.filter((/** @type {Item} */ s) => s.mini) : r.steps);

  /** @param {Item} r @param {Item[]} list @returns {import("/static/kp/js/focus-steps.js").FocusStep[]} */
  function focusSteps(r, list) {
    /** @param {string | null} id */
    const trackName = (id) => (id ? (r.tracks.find((/** @type {Item} */ t) => t.id === id)?.name ?? id) : undefined);
    return list.map((s) => ({
      id: s.id,
      title: sentence(s.say) || undefined,
      text: s.text,
      ingredients: (s.uses ?? []).map((/** @type {Item} */ u) => ({ amount: u.amount, name: u.name })),
      timer: s.timer ? { seconds: s.timer.seconds, name: s.timer.name } : undefined,
      note: s.note || undefined,
      noteTone: s.note_tone === "warning" ? "warning" : undefined,
      track: trackName(s.track),
    }));
  }

  /**
   * Where a finished timer leads: the step after the one that started it, or the next step on the same track.
   * @param {Item} timer @returns {{ index: number, number: number, text: string } | null}
   */
  function nextAfter(timer) {
    const at = shown.findIndex((s) => s.id === timer.id);
    if (at < 0) return null;
    const track = shown[at].track;
    let to = -1;
    for (let i = at + 1; i < shown.length; i++) {
      if (!track || shown[i].track === track) {
        to = i;
        break;
      }
    }
    if (to < 0) return null;
    const lane = track ? shown.filter((s) => s.track === track) : shown;
    return { index: to, number: lane.indexOf(shown[to]) + 1, text: shown[to].text };
  }

  const refreshBand = () => {
    const done = getTimers(timers).filter((tm) => tm.state === "done");
    setAttention(
      band,
      done.map((tm) => {
        const next = nextAfter(tm);
        const action = h(
          "button",
          { type: "button", class: "kp-button kp-button--sm", ...(next ? { "data-ck-from": shown.findIndex((x) => x.id === tm.id) } : { "data-ck-stop": tm.id }) },
          next ? t("cook.goToStep", next.number) : t("cook.stopTimer", tm.name),
        );
        return {
          key: tm.id,
          severity: /** @type {const} */ ("warning"),
          title: t("cook.timerDone", tm.name),
          text: next ? t("cook.nextIs", next.number, next.text) : t("cook.nothingLeft"),
          action,
        };
      }),
    );
  };
  band.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (!button) return;
    if (button.hasAttribute("data-ck-from")) {
      // Back to the step that started the timer, then on with the view's own Next, so that step counts as done.
      goToStep(steps, Number(button.getAttribute("data-ck-from")));
      $(".kp-focus-steps__next", steps)?.click();
    }
    else if (button.hasAttribute("data-ck-stop")) stopTimer(timers, button.getAttribute("data-ck-stop") ?? "");
  });

  // ------------------------------------------------------------------ discs follow the running timers
  /** @type {Map<string, { el: HTMLElement, detach: () => void }>} */
  const discOf = new Map();

  const paintDiscCard = () => {
    if (discOf.size) setCardState(discCard, "ready");
    else
      setCardState(discCard, "empty", {
        title: t("cook.noTimerTitle"),
        text: t("cook.noTimerText"),
        action: h("button", { type: "button", class: "kp-button", onclick: () => steps.focus() }, t("cook.goSteps")),
      });
  };

  /** @param {{ id: string, name: string, seconds: number, remaining: number, state: string }} tm */
  function addDisc(tm) {
    if (discOf.has(tm.id) || tm.state === "done") return;
    const el = h("div", {
      class: "kp-timer-disc",
      "data-kp-timer-disc": `${Math.max(1, tm.remaining)}s`,
      "data-kp-timer-disc-name": tm.name,
      "data-kp-timer-disc-scale": DIAL_MINUTES,
    });
    discs.append(el);
    const detach = attachTimerDiscs(el);
    discOf.set(tm.id, { el, detach });
    if (tm.state === "running") timerDiscOf(el)?.start();
    paintDiscCard();
  }
  /** @param {string} id */
  function dropDisc(id) {
    const d = discOf.get(id);
    if (!d) return;
    d.detach();
    d.el.remove();
    discOf.delete(id);
    paintDiscCard();
  }

  /** @param {Event} event */
  const onTimer = (event) => {
    const { timer, action } = /** @type {CustomEvent} */ (event).detail ?? {};
    switch (event.type) {
      case "kp-timer-start":
        dropDisc(timer.id);
        addDisc(timer);
        break;
      case "kp-timer-change": {
        const clock = discOf.get(timer.id) ? timerDiscOf(/** @type {{ el: HTMLElement }} */ (discOf.get(timer.id)).el) : null;
        if (action === "pause") clock?.pause();
        else if (action === "resume") clock?.start();
        else if (action === "add") clock?.add(60);
        break;
      }
      case "kp-timer-stop":
        dropDisc(timer.id);
        break;
    }
    refreshBand();
    memo.timers = getTimers(timers);
    keep();
  };
  const timerEvents = ["kp-timer-start", "kp-timer-change", "kp-timer-done", "kp-timer-stop"];
  for (const type of timerEvents) timers.addEventListener(type, onTimer);

  // ------------------------------------------------------------------ the timeline follows the progress
  let finished = false;

  /**
   * Where the cook is, as focus-steps keeps it: the step in hand and the steps passed (with tracks it stores the passed
   * ones; one track is a plain sequence, so every step before the one in hand is passed).
   * @returns {{ active: number, done: Set<number> }}
   */
  function progressNow() {
    if (finished) return { active: -1, done: new Set(shown.map((_, i) => i)) };
    const saved = memoryFor(steps, "focus-steps")?.read("progress", null);
    const active = Math.max(0, Math.min(shown.length - 1, Number(saved?.index) || 0));
    const done = Array.isArray(saved?.done) ? new Set(/** @type {number[]} */ (saved.done)) : new Set(shown.map((_, i) => i).filter((i) => i < active));
    return { active, done };
  }

  /** The recipe's rows (recipe/schedule.js: one per track that has a step here, else one for the whole recipe; a step with no track is in every row). */
  function lanesOf() {
    const { lanes: found, rowsOf } = scheduleLanes(shown, /** @type {Item[]} */ (recipe?.tracks ?? []));
    const lanes = found.map((l) => ({ id: l.id, label: l.name ?? String(recipe?.name ?? ""), series: l.series }));
    return { lanes, rowsOf };
  }

  /** Draw the plan from this moment: passed steps where they really were, the one in hand growing, the rest counted on from now. */
  function paintTimeline() {
    if (!recipe) return;
    if (!shown.length) {
      setTimelineState(line.el, "empty", t("cook.noSteps"), { text: t("cook.noStepsText") });
      return;
    }
    const now = Date.now();
    const { active, done } = progressNow();
    const marks = (memo.marks ??= {});
    // The real times: a step's start is when it came into hand, its end when it was passed.
    shown.forEach((s, i) => {
      const m = marks[s.id];
      if (done.has(i)) {
        if (!m?.end) marks[s.id] = { start: m?.start, end: now };
      } else if (m?.end) delete marks[s.id];
      if (i === active && !done.has(i) && !marks[s.id]?.start) marks[s.id] = { ...marks[s.id], start: now };
    });
    keep();
    const { lanes, rowsOf } = lanesOf();
    const first = Math.min(now, ...Object.values(marks).map((m) => m.start ?? now));
    /** @type {Map<string, number>} */
    const cursor = new Map(lanes.map((l) => [l.id, first]));
    /** @type {import("../recipe/timeline.js").TimelineRun[]} */
    const runs = [];
    /** @type {import("../recipe/timeline.js").TimelineZone[]} */
    const left = [];
    const clock = (/** @type {number} */ ms) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms));
    let last = now;
    /** @type {Map<string, number>} where each step starts in this plan, for the steps that run alongside it */
    const starts = new Map();
    shown.forEach((s, i) => {
      const rows = rowsOf(s);
      const mins = Math.max(1, Number(s.mins) || 0);
      const m = marks[s.id];
      const ahead = Math.max(...rows.map((r) => cursor.get(r) ?? first));
      const say = sentence(s.say || String(s.text));
      const how = t("cook.how", mins, s.active);
      /** @type {{ start: number, end: number, state: "ok" | "running" | "planned", words: string }[]} */
      const parts = [];
      let next;
      if (done.has(i)) {
        const start = Math.min(m?.start ?? ahead, now - 1000);
        const end = Math.max(start + 30000, Math.min(now, m?.end ?? start + mins * MIN));
        parts.push({ start, end, state: "ok", words: t("cook.howDone", how) });
        next = end;
      } else if (i === active) {
        const start = m?.start ?? now;
        const planned = start + mins * MIN;
        parts.push({ start, end: now, state: "running", words: t("cook.howOnIt", how) });
        // What is left of its time is a thin band in the row (the package's lane stretch); past its time the rest of the plan begins from this moment.
        if (planned > now) for (const row of rows) left.push({ id: `${row}:${s.id}`, lane: row, from: now, to: planned, label: t("cook.until", say, clock(planned)), tone: "info" });
        next = Math.max(now, planned);
      } else {
        // A step that runs alongside another (`with`) is planned from where that one is planned; it does not push its rows back.
        const partner = typeof s.with === "string" ? starts.get(s.with) : undefined;
        // A step with a fixed `start` (minutes from the recipe's start, Kenny 29/10/2026) is planned there, counted from the
        // moment cooking began (`first`); it cannot begin before the real now, and what lies between is a planned wait.
        const pinned = typeof s.start === "number" && Number.isFinite(s.start) && s.start >= 0;
        const fixed = pinned ? first + s.start * MIN : null;
        const start = fixed !== null ? Math.max(now, fixed) : partner !== undefined ? Math.max(now, partner) : Math.max(now, ahead);
        const waits = fixed !== null && start > ahead + MIN / 2 ? Math.round((start - Math.max(now, ahead)) / MIN) : 0;
        parts.push({ start, end: start + mins * MIN, state: "planned", words: waits > 0 ? t("cook.howToDoAt", how, clock(start), waits) : t("cook.howToDo", how) });
        next = partner !== undefined ? Math.max(ahead, start + mins * MIN) : start + mins * MIN;
      }
      starts.set(s.id, parts[0].start);
      for (const row of rows) cursor.set(row, next);
      last = Math.max(last, next);
      for (const row of rows) {
        parts.forEach((part) =>
          runs.push({
            id: `${row}:${s.id}`,
            lane: row,
            label: say,
            start: part.start,
            end: part.end,
            state: part.state,
            series: lanes.find((l) => l.id === row)?.series,
            detail: `${say}, ${part.words}`,
          }),
        );
      }
    });
    drawTimeline(line.el, {
      lanes: lanes.map((l) => ({ ...l, sub: t("cook.nOfMDone", shown.filter((s, i) => rowsOf(s).includes(l.id) && done.has(i)).length, shown.filter((s) => rowsOf(s).includes(l.id)).length) })),
      runs,
      zones: left,
      from: first - MIN,
      to: last + 3 * MIN,
    });
  }
  // The place changes after the package has written it down: look a moment later.
  const followProgress = () => window.setTimeout(() => !dead && (paintTimeline(), paintPhotos()), 0);
  for (const type of ["kp-focus-steps-change", "kp-focus-steps-track", "kp-focus-steps-resume"]) steps.addEventListener(type, followProgress);
  steps.addEventListener("kp-focus-steps-done", () => {
    finished = true;
    followProgress();
  });
  // The plan counts on from the real now, so it is looked at again while a step runs over its time.
  const timelineTick = window.setInterval(paintTimeline, TIMELINE_EVERY_MS);
  undo.push(() => clearInterval(timelineTick));

  // ------------------------------------------------------------------ the place, and the end
  steps.addEventListener("kp-focus-steps-empty-action", () => navigate(`/recipe?id=${encodeURIComponent(recipeId)}`));
  steps.addEventListener("kp-focus-steps-done", () => {
    doneSection.hidden = false;
    doneSection.scrollIntoView({ block: "nearest", behavior: motionAllowed(doneSection) ? "smooth" : "auto" });
    doneBtn.focus({ preventScroll: true });
  });

  let logging = false;
  doneBtn.addEventListener("click", async () => {
    if (logging || !recipe) return;
    logging = true;
    doneBtn.setAttribute("aria-disabled", "true");
    doneFail.hidden = true;
    try {
      await create("log", { dish_id: recipe.dish_id ?? null, recipe_id: recipe.id, date: today(), feeling: null, note: "" });
      if (dead) return;
      doneCard.replaceChildren(
        statePlate(document, {
          kind: "empty",
          title: t("cook.logged"),
          text: t("cook.loggedText"),
          actionLabel: t("shell.openWheel"),
          onAction: () => navigate("/"),
        }),
      );
    } catch (e) {
      doneFail.replaceChildren(
        h("strong", null, t("cook.logFailed")),
        h("p", null, e instanceof Error ? e.message : String(e)),
      );
      doneFail.hidden = false;
      doneBtn.textContent = t("common.tryAgain");
    } finally {
      logging = false;
      doneBtn.removeAttribute("aria-disabled");
    }
  });

  // ------------------------------------------------------------------ states
  const showLoading = () => {
    setCardState(beginCard, "loading");
    setChecklistState(mise, "loading");
    setFocusStepsState(steps, "loading");
    setTimersState(timers, "loading");
    setCardState(discCard, "loading");
    setTimelineState(line.el, "loading");
  };
  /** @param {string} message */
  const showError = (message) => {
    setCardState(beginCard, "error", { title: t("cook.recipeFailed"), text: message });
    setChecklistState(mise, "error", message);
    setFocusStepsState(steps, "error", message);
    setTimersState(timers, "error");
    setCardState(discCard, "error", { title: t("cook.timersFailed"), text: message });
    setTimelineState(line.el, "error", t("cook.timelineFailed"), { text: message });
  };

  /** The photos of the step the cook is on. */
  function paintPhotos() {
    const step = shown[getStepIndex(steps)];
    const ids = /** @type {string[]} */ (step?.photos ?? []);
    stepPhotos.hidden = ids.length === 0;
    if (ids.length === 0) return;
    const key = ids.join(",");
    if (stepPhotos.dataset.key === key) return;
    stepPhotos.dataset.key = key;
    const gallery = stepPhotos.firstElementChild;
    if (gallery instanceof HTMLElement) showPhotos(gallery, ids, t("edit.stepPhoto"));
    else stepPhotos.append(showPhotos(null, ids, t("edit.stepPhoto")));
  }

  /** @param {Item} r */
  function fill(r) {
    recipe = r;
    shown = stepsOf(r);
    document.title = `${t("cook.cookName", r.name)} · Kitchen`;
    title.textContent = t("cook.cookColon", r.name);
    lead.textContent = mini
      ? t("cook.leadMini")
      : t("cook.lead");
    const base = `/cook?id=${encodeURIComponent(r.id)}`;
    actions.replaceChildren(
      link(`/recipe?id=${encodeURIComponent(r.id)}`, t("cook.backToRecipe")),
      mini ? link(base, t("cook.fullVersion")) : link(`${base}&mini=1`, t("cook.miniVersion")),
    );

    beginTitle.textContent = r.name;
    const fact = (/** @type {string} */ k, /** @type {string} */ v) => h("div", { class: "kp-kv__row" }, h("dt", null, k), h("dd", null, v));
    facts.replaceChildren(
      fact(t("cook.serves"), t("cook.portionCount", r.portions)),
      fact(t("cook.time"), t("cook.timeText", r.minutes, r.hands_on)),
      ...(r.gear ? [fact(t("cook.dirties"), r.gear)] : []),
      ...(mini ? [fact(t("bad.miniVersion"), r.mini_note || t("cook.onlyMatter"))] : []),
    );
    setCardState(beginCard, "ready");

    // The mise en place: ingredients by group, the tools after the first group.
    /** @type {Item[]} */
    const items = [];
    const MAIN = t("edit.groupMain");
    const TOOLS = t("edit.tools");
    const groups = [...new Set(r.ingredients.map((/** @type {Item} */ i) => i.group || MAIN))];
    const order = r.tools.length ? [groups[0], TOOLS, ...groups.slice(1)] : groups;
    for (const g of order) {
      if (g === TOOLS && r.tools.length) for (const tool of r.tools) items.push({ id: `tool-${tool.id}`, label: tool.name, detail: "", group: TOOLS });
      else for (const i of r.ingredients) if ((i.group || MAIN) === g) items.push({ id: i.id, label: ingredientName(i.ingredient, lang()), detail: amountOf(i), group: g });
    }
    setChecklistState(mise, "ready");
    setChecklistItems(mise, items);
    paintStart();

    setFocusStepsState(steps, "ready");
    setFocusSteps(steps, focusSteps(r, shown));
    steps.setAttribute("aria-label", r.name);
    delete stepPhotos.dataset.key;
    paintPhotos();

    setTimersState(timers, "ready");
    if (Array.isArray(memo.timers) && memo.timers.length && !getTimers(timers).length) {
      restoreTimers(timers, memo.timers);
      for (const tm of getTimers(timers)) addDisc(tm);
    }
    paintDiscCard();
    refreshBand();
    finished = false;
    paintTimeline();
    started = Boolean(memo.started);
  }

  /** The settings that act on this screen: the timers' sound. @param {Item} settings */
  const applySettings = (settings) => timers.setAttribute("data-kp-timers-sound", settings.timer_sound || "chime");
  undo.push(
    onKitchen((k) => {
      if (!dead) applySettings(k.settings ?? {});
    }),
  );

  // ------------------------------------------------------------------ load, and Try again
  /** @param {boolean} force */
  async function load(force) {
    const mine = ++seq;
    try {
      const k = await loadKitchen({ force });
      if (dead || mine !== seq) return;
      applySettings(k.settings ?? {});
      const r = recipeById(recipeId);
      if (!r) {
        plateScreen(t("cook.notHere"), t("cook.removed"), t("shell.openWheel"), "/");
        return;
      }
      fill(r);
    } catch (e) {
      if (dead || mine !== seq) return;
      showError(e instanceof Error ? e.message : t("cook.loadFailed"));
    }
  }
  const retry = () => {
    showLoading();
    void load(true);
  };
  for (const [el, type] of /** @type {const} */ ([
    [root, "kp-card-retry"],
    [mise, "kp-checklist-retry"],
    [steps, "kp-focus-steps-retry"],
    [timers, "kp-timers-retry"],
    [line.el, "kp-gantt-retry"],
  ]))
    el.addEventListener(type, retry);

  void load(false);

  return () => {
    dead = true;
    seq++;
    for (const stop of undo.splice(0)) stop();
    for (const d of discOf.values()) d.detach();
    discOf.clear();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    void started;
  };
}
