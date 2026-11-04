// The steps of a recipe: quick-add (Kenny, 29/10/2026), the list of step rows, their order and numbers.

import { h } from "../../dom.js";
import { t } from "../../i18n/index.js";
import { row } from "../../ui/form-parts.js";
import { MAX_TEXT_CHARS } from "../../limits.js";
import { trackChoices, liveRows } from "./logic.js";
import { stepEditor } from "./step-row.js";
import { attachControls } from "./controls.js";
import { keyFor, listKeys, sheetKeys } from "../../shell/keys.js";
import { matchesKeySpec } from "/static/kp/dist/js/key-spec.js";

/** @typedef {{ tracker: any, tracks: ReturnType<typeof import("../../ui/form-parts.js").rows>, list: import("./step-row.js").StepRow[], stepsBox: HTMLElement, stepsEmpty: HTMLElement, quick: HTMLInputElement, up: import("/static/kp/dist/js/key-spec.js").KeySpec, down: import("/static/kp/dist/js/key-spec.js").KeySpec }} StepsState */

/** @param {StepsState} s */
const trackOptions = (s) => trackChoices(s.tracks.get().map(([tk]) => tk), { meet: t("edit.tracksMeet"), unnamed: t("edit.unnamedTrack") });

/** Numbers, labels and the Up / Down limits follow the order. @param {StepsState} s */
function renumber(s) {
  s.stepsEmpty.hidden = s.list.length > 0;
  s.list.forEach((e, i) => {
    e.head.textContent = String(i + 1);
    e.el.setAttribute("aria-label", t("edit.stepN", i + 1));
    e.camera.setAttribute("aria-label", t("edit.cameraStep", i + 1));
    e.up.disabled = i === 0;
    e.down.disabled = i === s.list.length - 1;
    e.options();
    e.paint();
  });
  s.stepsBox.replaceChildren(...s.list.map((e) => e.el));
  s.stepsBox.dispatchEvent(new CustomEvent("rl-rows-change", { bubbles: true }));
}

/** @param {StepsState} s @param {any} e @param {number} by @param {HTMLElement} focus what keeps the focus after the move */
function move(s, e, by, focus) {
  const i = s.list.indexOf(e);
  const j = i + by;
  if (j < 0 || j >= s.list.length) return;
  [s.list[i], s.list[j]] = [s.list[j], s.list[i]];
  renumber(s);
  // A disabled button (the first step's Up) cannot keep it: the other one does.
  (/** @type {HTMLButtonElement} */ (focus).disabled ? (by < 0 ? e.down : e.up) : focus).focus();
}

/**
 * The keyboard's way to reorder (Kenny, 29/10/2026): Alt+Up and Alt+Down in a step's text, the focus staying in it. The
 * keys are kp key specs (`data-kt-step-up-key` / `data-kt-step-down-key` on the list, shell/keys.js), matched by kp's
 * `matchesKeySpec` in the text's own handler and listed on the `?` sheet as keys of a text field, with Enter in the
 * quick field.
 * @param {StepsState} s
 */
function listStepKeys(s) {
  const group = t("keys.groupEditor");
  const field = /** @type {const} */ ("field");
  /** @type {import("/static/kp/dist/js/shortcuts.js").Shortcut[]} */
  const entries = [
    { keys: sheetKeys(s.up) ?? "", what: t("keys.stepUp"), group, where: field },
    { keys: sheetKeys(s.down) ?? "", what: t("keys.stepDown"), group, where: field },
  ].filter((e) => e.keys);
  listKeys(s.stepsBox, entries);
  listKeys(s.quick, [{ keys: "Enter", what: t("keys.quickAdd"), group, where: field }]);
}

/** Alt+Up / Alt+Down in a step's text moves the step. @param {StepsState} s @param {import("./step-row.js").StepRow} e */
function wireStepKeys(s, e) {
  e.text.addEventListener("keydown", (ev) => {
    const k = /** @type {KeyboardEvent} */ (ev);
    const by = matchesKeySpec(k, s.up) ? -1 : matchesKeySpec(k, s.down) ? 1 : 0;
    if (!by) return;
    k.preventDefault();
    move(s, e, by, e.text);
  });
}

/** @param {StepsState} s @param {Record<string, any>} step */
function addStep(s, step) {
  const e = stepEditor(step, { tracker: s.tracker, trackOptions: () => trackOptions(s), list: () => s.list });
  s.list.push(e);
  e.up.addEventListener("click", () => move(s, e, -1, e.up));
  e.down.addEventListener("click", () => move(s, e, 1, e.down));
  wireStepKeys(s, e);
  /** @type {any} */ (e).del.addEventListener("click", () => {
    s.list = s.list.filter((x) => x !== e);
    renumber(s);
    s.quick.focus();
  });
  for (const type of ["input", "change", "kp-quantity-change", "rl-photos-change"]) e.el.addEventListener(type, () => e.paint());
  return e;
}

/** Enter in the quick field: the step is added and the field is ready for the next one. @param {StepsState} s */
function quickAdd(s) {
  const typed = s.quick.value.trim();
  if (!typed) return;
  const last = s.list[s.list.length - 1];
  const e = addStep(s, { text: typed, track: last?.track.value || null });
  s.quick.value = "";
  renumber(s);
  attachControls(e.el);
  e.el.scrollIntoView({ block: "nearest" });
  s.quick.focus();
}

/** The track choices of every step follow the track list. @param {StepsState} s */
function syncTrackChoices(s) {
  const opts = trackOptions(s);
  for (const e of s.list) {
    const sel = e.track;
    const keep = sel.value;
    sel.replaceChildren(...opts.map(([v, text]) => h("option", { value: v }, text)));
    sel.value = opts.some(([v]) => v === keep) ? keep : "";
    e.paint();
  }
}

/**
 * @param {{ r: Record<string, any>, tracks: ReturnType<typeof import("../../ui/form-parts.js").rows>, tracker: any }} o
 */
export function stepFields({ r, tracks, tracker }) {
  const quick = /** @type {HTMLInputElement} */ (h("input", { class: "kp-field__input", type: "text", id: "rl-quick", autocomplete: "off", enterkeyhint: "next", maxlength: String(MAX_TEXT_CHARS), placeholder: t("edit.quickPh"), "aria-label": t("edit.quickLabel") }));
  /** @type {StepsState} */
  const stepsBox = h("ol", { class: "rl-steps" });
  const s = { tracker, tracks, list: [], stepsBox, stepsEmpty: h("p", { class: "rl-rows__empty" }, t("edit.noSteps")), quick, up: keyFor(stepsBox, "step-up"), down: keyFor(stepsBox, "step-down") };
  for (const step of r.steps ?? []) addStep(s, step);
  quick.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" || ev.isComposing) return;
    ev.preventDefault(); // Enter here never submits the form
    quickAdd(s);
  });
  renumber(s);
  listStepKeys(s);
  tracks.el.addEventListener("rl-rows-change", () => syncTrackChoices(s));
  const el = h("div", { class: "rl-steps-wrap" }, h("div", { class: "kp-formgrid" }, row(t("edit.quickLabel"), quick, t("edit.quickHint"))), s.stepsBox, s.stepsEmpty);
  return {
    el,
    get list() {
      return s.list;
    },
    set list(v) {
      s.list = v;
    },
    renumber: () => renumber(s),
    /** The step rows that have text: the one set the times, the timeline and the meeting-lane pass all read. */
    live: () => liveRows(s.list),
    /** The live rows as steps. */
    liveSteps: () => liveRows(s.list).map((e) => e.get()),
  };
}
