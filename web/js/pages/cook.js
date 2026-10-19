// Cook mode: /cook?id=<recipe id>[&mini=1].
//
// One screen in the approved order: the Begin card, which opens the
// mise-en-place checklist; cook mode (one step at a time, the recipe's
// parallel tracks as lanes, the running timers beside it, an attention band
// when one ends); the timer discs; the calm switch; and, when the last step is
// done, the offer to log tonight's dinner. Everything is the package's own
// component with its standard behaviour; this file gives them the recipe.
//
// The place in the recipe and the running timers are kept per recipe in
// sessionStorage, so a reload resumes where the cook was.

import { h, $ } from "../dom.js";
import { loadKitchen, onKitchen, recipeById, create } from "../api.js";
import { attachChecklists, setChecklistItems, setChecklistState, getChecklistItems } from "/kp/js/checklist.js";
import { attachFocusSteps, setFocusSteps, setFocusStepsState, goToStep } from "/kp/js/focus-steps.js";
import { attachTimers, setTimersState, getTimers, restoreTimers, stopTimer } from "/kp/js/timer.js";
import { attachTimerDiscs, timerDiscOf } from "/kp/js/timer-disc.js";
import { attachAttention, setAttention } from "/kp/js/attention.js";
import { attachCardStates, setCardState } from "/kp/js/card-state.js";
import { attachCalm, isCalm, calmScope, motionAllowed } from "/kp/js/calm.js";
import { statePlate } from "/kp/js/state-plate.js";

/** @typedef {import("../api.js").Item} Item */

/** The dial the discs measure: 60 minutes, the classic Time Timer (Kenny's default). */
const DIAL_MINUTES = 60;
const LOAD_FAILED = "The recipe could not be loaded. Check the connection and try again.";

/** Plural forms for the units that have one. */
const PLURAL = /** @type {Record<string, string>} */ ({ clove: "cloves", pinch: "pinches", handful: "handfuls", slice: "slices" });

/** "2 cloves", "400 g", "1" (a piece) or "" (no amount). @param {Item} ing */
function amountOf(ing) {
  if (ing.amount === null || ing.amount === undefined) return "";
  const n = Math.round(ing.amount * 100) / 100;
  const unit = ing.unit === "pc" ? "" : ((n !== 1 && PLURAL[ing.unit]) || ing.unit || "");
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
    h("div", { class: "kp-formgrid__control" }, h("div", { class: "kp-formgrid__buttons" }, ...buttons)),
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
  const storeKey = `recepten:cook:${recipeId}:${mini ? "mini" : "full"}`;
  document.title = "Cook · Recepten";

  /** @type {(() => void)[]} */
  const undo = [];
  let dead = false;
  let seq = 0;

  // ------------------------------------------------------------------ remembered place
  /** @type {{ index?: number, started?: boolean, timers?: any[] }} */
  let memo = {};
  try {
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
        h("h1", { class: "kp-sr-only", id: "ck-plate-h" }, "Cook mode"),
        statePlate(document, { kind: "empty", title, text, actionLabel: label, onAction: () => navigate(href) }),
      ),
    );
  }

  if (!recipeId) {
    plateScreen("This recipe is not here", "The address has no recipe in it. The wheel picks one.", "Open the wheel", "/");
    return () => {};
  }

  // ------------------------------------------------------------------ the shell, drawn loading from the first frame
  const title = h("h1", { class: "kp-page-header__title" }, "Cook");
  const lead = h("p", { class: "kp-page-header__description" }, "One step at a time, with every timer in view.");
  const actions = h("div", { class: "kp-page-header__actions" });
  const header = h(
    "header",
    { class: "kp-page-header" },
    h("div", { class: "kp-page-header__inner" }, h("div", null, title, lead), actions),
  );

  // Begin
  const beginTitle = h("h3", { class: "kp-card__title" }, "Your recipe");
  // Placeholder rows while loading, so the card holds its filled height.
  const facts = h(
    "dl",
    { class: "kp-kv" },
    ...["Serves", "Time", "Dirties"].map((k) => h("div", { class: "kp-kv__row" }, h("dt", null, k), h("dd", null, "\u2014"))),
  );
  const beginBtn = h("button", { type: "button", class: "kp-button kp-button--primary kp-button--lg" }, "Begin");
  const beginCard = h(
    "article",
    { class: "kp-card ck-begin__card", "data-kp-state": "loading", "aria-labelledby": "ck-begin-t", "data-kp-loading-words": "Reading the recipe" },
    h("div", { class: "kp-card__header" }, beginTitle),
    h(
      "div",
      { class: "kp-card__stage" },
      h(
        "div",
        { class: "kp-card__data" },
        h(
          "div",
          { class: "kp-formgrid", "data-kp-formgrid-align": "center" },
          facts,
          actionRow("Start here", [beginBtn], "Opens the list of what to take out first. Nothing is cooked yet."),
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
    "aria-label": "Mise en place: what to take out",
    "data-kp-state": "loading",
    "data-kp-checklist-empty": "Nothing to take out for this recipe.",
    style: "--kp-checklist-min-rows: 10",
  });
  const startBtn = h("button", { type: "button", class: "kp-button kp-button--primary kp-button--lg", "aria-disabled": "true" }, "Start cooking");
  const skipBtn = h("button", { type: "button", class: "kp-button kp-button--lg" }, "Skip, start anyway");
  const readout = h("p", { class: "kp-formgrid__value", role: "status" }, "Take things out and tick them.");
  const miseOpen = h(
    "div",
    { class: "ck-mise", hidden: true },
    mise,
    h(
      "div",
      { class: "kp-formgrid", "data-kp-formgrid-align": "center" },
      actionRow("Everything is out", [startBtn], readout),
      actionRow("Something is missing", [skipBtn], "Opens cook mode now. A missing onion never blocks dinner."),
    ),
  );

  // Cook mode
  const band = h("div", { class: "kp-attention", "aria-label": "Needs you now" });
  const steps = h("div", {
    class: "kp-focus-steps",
    id: "ck-steps",
    "data-kp-focus-steps": "",
    "data-kp-focus-steps-timers": "ck-timers",
    "data-kp-focus-steps-wake": "true",
    "data-kp-track-attention": "off",
    "data-kp-state": "loading",
    "data-kp-focus-steps-empty": "This recipe has no steps yet.",
    "aria-label": "Steps",
  });
  const timers = h("div", {
    class: "kp-timers",
    id: "ck-timers",
    "data-kp-timers": "",
    "data-kp-timers-ring": "60",
    "data-kp-timers-sound": "chime",
    "data-kp-timers-empty": "No timer running. Start one from a step.",
    "aria-label": "Kitchen timers",
  });
  const cook = section(
    "ck-cook",
    "Cook mode: one step at a time",
    "One step large on the counter, with what it needs and a timer button; started timers keep running beside it whichever step you are on.",
    h(
      "div",
      { class: "ck-cook" },
      h("div", { class: "ck-cook__main" }, h("h3", { class: "ck-part" }, "Steps"), band, steps),
      h(
        "div",
        { class: "ck-cook__side" },
        h("h3", { class: "ck-part" }, "Timers running"),
        h("p", { class: "ck-part-note" }, "Every timer you start stays here, and its disc below follows it."),
        timers,
      ),
    ),
  );

  // Discs
  const discs = h("div", { class: "ck-discs" });
  const discCard = h(
    "article",
    { class: "kp-card ck-disccard", "data-kp-state": "loading", "aria-label": "Timer discs", "data-kp-loading-words": "Reading the timers" },
    h("div", { class: "kp-card__stage" }, h("div", { class: "kp-card__data" }, discs)),
  );
  const discSection = section(
    "ck-discs",
    "Time at a glance: the shrinking disc",
    `Each running timer as a coloured disc on a ${DIAL_MINUTES}-minute dial that grows smaller as time goes, so the time left is seen without reading a number.`,
    discCard,
  );

  // Calm
  const calmSwitch = h("input", { class: "kp-switch__input", type: "checkbox", role: "switch", id: "ck-calm", "data-kp-calm-switch": "" });
  const calmLine = h("p", { class: "kp-formgrid__value", role: "status" });
  const calmSection = section(
    "ck-calm",
    "Calm mode",
    "Turns movement and effects off for a day with no energy; the timers still count and still ring.",
    h(
      "div",
      { class: "kp-formgrid ck-calm", "data-kp-formgrid-align": "center" },
      h(
        "div",
        { class: "kp-formgrid__row" },
        h("label", { class: "kp-formgrid__label", for: "ck-calm" }, "Calm mode"),
        h("div", { class: "kp-formgrid__control" }, h("label", { class: "kp-switch" }, calmSwitch, h("span", null, "Hold movement and effects still"))),
        calmLine,
      ),
    ),
  );
  const paintCalm = () => {
    const scope = calmScope(document);
    const words = scope === "motion" ? "transitions only" : scope === "all" ? "everything" : "transitions and effects";
    const loading = document.documentElement.getAttribute("data-kp-calm-loading") === "still" ? "holds still" : "breathes slowly";
    calmLine.textContent = isCalm(document)
      ? `Calm is on. Holds still: ${words}. Loading: ${loading}.`
      : "Calm is off. Turn it on when movement is too much.";
  };
  document.addEventListener("kp-calm-change", paintCalm);
  undo.push(() => document.removeEventListener("kp-calm-change", paintCalm));

  // Done
  const doneBtn = h("button", { type: "button", class: "kp-button kp-button--primary kp-button--lg" }, "Log tonight's dinner");
  const doneSays = h("p", { class: "kp-formgrid__value" }, "Adds this dish to what you cooked, dated today. The wheel and the recipe's log read it.");
  const doneFail = h("div", { class: "kp-alert kp-alert--destructive", role: "alert", hidden: true });
  const doneCard = h(
    "article",
    { class: "kp-card ck-donecard" },
    h("div", { class: "kp-card__body" }, doneFail, h("div", { class: "kp-formgrid", "data-kp-formgrid-align": "center" }, actionRow("Dinner is out", [doneBtn], doneSays))),
  );
  const doneSection = section(
    "ck-done",
    "Dinner is ready",
    "Log it so the wheel knows when you last cooked this dish.",
    doneCard,
  );
  doneSection.hidden = true;

  const beginSection = section(
    "ck-begin",
    "Begin: gather everything first",
    "Begin does not start step 1; it opens a short list of what to take out, and ticked items sink so only what is left stays on top.",
    h("div", { class: "ck-begin" }, beginCard, miseOpen),
  );

  root.replaceChildren(header, beginSection, cook, discSection, calmSection, doneSection);

  // Wire the package's components.
  undo.push(attachCardStates(root));
  undo.push(attachChecklists(root));
  undo.push(attachFocusSteps(root));
  undo.push(attachTimers(root));
  undo.push(attachAttention(root));
  undo.push(attachCalm(root));
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
      ? "Nothing to take out."
      : all
        ? "Everything is out. Start whenever you like."
        : `${left} of ${items.length} still to take out. Start cooking opens once all are ticked.`;
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

  /** @param {Item} r @param {Item[]} list @returns {import("/kp/js/focus-steps.js").FocusStep[]} */
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
    const done = getTimers(timers).filter((t) => t.state === "done");
    setAttention(
      band,
      done.map((t) => {
        const next = nextAfter(t);
        const action = h(
          "button",
          { type: "button", class: "kp-button kp-button--sm", ...(next ? { "data-ck-from": shown.findIndex((x) => x.id === t.id) } : { "data-ck-stop": t.id }) },
          next ? `Go to step ${next.number}` : `Stop ${t.name}`,
        );
        return {
          key: t.id,
          severity: /** @type {const} */ ("warning"),
          title: `${t.name} is done`,
          text: next ? `Next is step ${next.number}: ${next.text}` : "Nothing is left after this one. It rings until you stop it.",
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
        title: "No timer running",
        text: "A disc appears here for every timer you start from a step.",
        action: h("button", { type: "button", class: "kp-button", onclick: () => steps.focus() }, "Go to the steps"),
      });
  };

  /** @param {{ id: string, name: string, seconds: number, remaining: number, state: string }} t */
  function addDisc(t) {
    if (discOf.has(t.id) || t.state === "done") return;
    const el = h("div", {
      class: "kp-timer-disc",
      "data-kp-timer-disc": `${Math.max(1, t.remaining)}s`,
      "data-kp-timer-disc-name": t.name,
      "data-kp-timer-disc-scale": DIAL_MINUTES,
    });
    discs.append(el);
    const detach = attachTimerDiscs(el);
    discOf.set(t.id, { el, detach });
    if (t.state === "running") timerDiscOf(el)?.start();
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

  // ------------------------------------------------------------------ the place, and the end
  steps.addEventListener("kp-focus-steps-change", (event) => {
    memo.index = /** @type {CustomEvent} */ (event).detail.index;
    keep();
  });
  steps.addEventListener("kp-focus-steps-track", (event) => {
    memo.index = /** @type {CustomEvent} */ (event).detail.index;
    keep();
  });
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
      await create("log", { recipe_id: recipe.id, date: today(), feeling: null, note: "" });
      if (dead) return;
      doneCard.replaceChildren(
        statePlate(document, {
          kind: "empty",
          title: "Logged. Enjoy your dinner.",
          text: "It is in your log from today.",
          actionLabel: "Open the wheel",
          onAction: () => navigate("/"),
        }),
      );
    } catch (e) {
      doneFail.replaceChildren(
        h("strong", null, "Tonight's dinner could not be logged"),
        h("p", null, e instanceof Error ? e.message : String(e)),
      );
      doneFail.hidden = false;
      doneBtn.textContent = "Try again";
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
  };
  /** @param {string} message */
  const showError = (message) => {
    setCardState(beginCard, "error", { title: "The recipe could not be loaded", text: message });
    setChecklistState(mise, "error", message);
    setFocusStepsState(steps, "error", message);
    setTimersState(timers, "error");
    setCardState(discCard, "error", { title: "The timers could not be shown", text: message });
  };

  /** @param {Item} r */
  function fill(r) {
    recipe = r;
    shown = stepsOf(r);
    document.title = `Cook ${r.name} · Recepten`;
    title.textContent = `Cook: ${r.name}`;
    lead.textContent = mini
      ? "The mini version for a day with little energy: only the steps that matter."
      : "One step at a time, with every timer in view.";
    const base = `/cook?id=${encodeURIComponent(r.id)}`;
    actions.replaceChildren(
      link(`/recipe?id=${encodeURIComponent(r.id)}`, "Back to the recipe"),
      mini ? link(base, "Cook the full version") : link(`${base}&mini=1`, "Cook the mini version"),
    );

    beginTitle.textContent = r.name;
    const fact = (/** @type {string} */ k, /** @type {string} */ v) => h("div", { class: "kp-kv__row" }, h("dt", null, k), h("dd", null, v));
    facts.replaceChildren(
      fact("Serves", `${r.portions} ${r.portions === 1 ? "portion" : "portions"}`),
      fact("Time", `${r.minutes} minutes, ${r.hands_on} of them hands-on`),
      ...(r.gear ? [fact("Dirties", r.gear)] : []),
      ...(mini ? [fact("Mini version", r.mini_note || "Only the steps that matter.")] : []),
    );
    setCardState(beginCard, "ready");

    // The mise en place: ingredients by group, the tools after the first group.
    /** @type {Item[]} */
    const items = [];
    const groups = [...new Set(r.ingredients.map((/** @type {Item} */ i) => i.group || "Ingredients"))];
    const order = r.tools.length ? [groups[0], "Tools", ...groups.slice(1)] : groups;
    for (const g of order) {
      if (g === "Tools" && r.tools.length) for (const t of r.tools) items.push({ id: `tool-${t.id}`, label: t.name, detail: "", group: "Tools" });
      else for (const i of r.ingredients) if ((i.group || "Ingredients") === g) items.push({ id: i.id, label: i.name, detail: amountOf(i), group: g });
    }
    setChecklistState(mise, "ready");
    setChecklistItems(mise, items);
    paintStart();

    if (!shown.length) {
      plateScreen("This recipe has no steps yet", "There is nothing to walk through. The recipe page has what is written down.", "Open the recipe", `/recipe?id=${encodeURIComponent(r.id)}`);
      return;
    }
    setFocusStepsState(steps, "ready");
    const start = Number.isInteger(memo.index) && /** @type {number} */ (memo.index) < shown.length ? /** @type {number} */ (memo.index) : 0;
    setFocusSteps(steps, focusSteps(r, shown), { start });
    steps.setAttribute("aria-label", r.name);

    setTimersState(timers, "ready");
    if (Array.isArray(memo.timers) && memo.timers.length && !getTimers(timers).length) {
      restoreTimers(timers, memo.timers);
      for (const t of getTimers(timers)) addDisc(t);
    }
    paintDiscCard();
    refreshBand();
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
        plateScreen("This recipe is not here", "It may have been removed. The wheel picks another.", "Open the wheel", "/");
        return;
      }
      fill(r);
    } catch (e) {
      if (dead || mine !== seq) return;
      showError(e instanceof Error ? e.message : LOAD_FAILED);
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
