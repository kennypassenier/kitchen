// The steps of a recipe: quick-add (Kenny, 29/10/2026), the list of step rows, their order and numbers.

import { h } from "../../dom.js";
import { t } from "../../i18n/index.js";
import { row } from "../../ui/form-parts.js";
import { trackChoices, liveRows } from "./logic.js";
import { stepEditor } from "./step-row.js";
import { attachControls } from "./controls.js";

/**
 * @param {{ r: Record<string, any>, tracks: ReturnType<typeof import("../../ui/form-parts.js").rows>, tracker: any }} o
 */
export function stepFields({ r, tracks, tracker }) {
  const trackOptions = () => trackChoices(tracks.get().map(([tk]) => tk), { meet: t("edit.tracksMeet"), unnamed: t("edit.unnamedTrack") });
  /** @type {import("./step-row.js").StepRow[]} */
  let stepList = [];
  const stepsBox = h("ol", { class: "rl-steps" });
  const stepsEmpty = h("p", { class: "rl-rows__empty" }, t("edit.noSteps"));
  const quick = /** @type {HTMLInputElement} */ (h("input", { class: "kp-field__input", type: "text", id: "rl-quick", autocomplete: "off", enterkeyhint: "next", placeholder: t("edit.quickPh"), "aria-label": t("edit.quickLabel") }));
  const renumber = () => {
    stepsEmpty.hidden = stepList.length > 0;
    stepList.forEach((e, i) => {
      e.head.textContent = String(i + 1);
      e.el.setAttribute("aria-label", t("edit.stepN", i + 1));
      e.camera.setAttribute("aria-label", t("edit.cameraStep", i + 1));
      e.up.disabled = i === 0;
      e.down.disabled = i === stepList.length - 1;
      e.options();
      e.paint();
    });
    stepsBox.replaceChildren(...stepList.map((e) => e.el));
    stepsBox.dispatchEvent(new CustomEvent("rl-rows-change", { bubbles: true }));
  };
  /** @param {Record<string, any>} s */
  const addStep = (s) => {
    const e = stepEditor(s, { tracker, trackOptions, list: () => stepList });
    stepList.push(e);
    e.up.addEventListener("click", () => move(e, -1, e.up));
    e.down.addEventListener("click", () => move(e, 1, e.down));
    /** @type {any} */ (e).del.addEventListener("click", () => {
      stepList = stepList.filter((x) => x !== e);
      renumber();
      quick.focus();
    });
    // The keyboard's way to reorder (Kenny, 29/10/2026): Alt+Up and Alt+Down in the step's text; the focus stays in it.
    e.text.addEventListener("keydown", (ev) => {
      const k = /** @type {KeyboardEvent} */ (ev);
      if (!k.altKey || (k.key !== "ArrowUp" && k.key !== "ArrowDown")) return;
      k.preventDefault();
      move(e, k.key === "ArrowUp" ? -1 : 1, e.text);
    });
    e.el.addEventListener("input", () => e.paint());
    e.el.addEventListener("change", () => e.paint());
    e.el.addEventListener("kp-quantity-change", () => e.paint());
    e.el.addEventListener("rl-photos-change", () => e.paint());
    return e;
  };
  /** @param {any} e @param {number} by @param {HTMLElement} focus what keeps the focus after the move */
  const move = (e, by, focus) => {
    const i = stepList.indexOf(e);
    const j = i + by;
    if (j < 0 || j >= stepList.length) return;
    [stepList[i], stepList[j]] = [stepList[j], stepList[i]];
    renumber();
    // A disabled button (the first step's Up) cannot keep it: the other one does.
    (/** @type {HTMLButtonElement} */ (focus).disabled ? (by < 0 ? e.down : e.up) : focus).focus();
  };
  for (const s of r.steps ?? []) addStep(s);
  /** Enter in the quick field: the step is added and the field is ready for the next one. */
  const quickAdd = () => {
    const typed = quick.value.trim();
    if (!typed) return;
    const last = stepList[stepList.length - 1];
    const e = addStep({ text: typed, track: last?.track.value || null });
    quick.value = "";
    renumber();
    attachControls(e.el);
    e.el.scrollIntoView({ block: "nearest" });
    quick.focus();
  };
  quick.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" || ev.isComposing) return;
    ev.preventDefault(); // Enter here never submits the form
    quickAdd();
  });
  renumber();
  tracks.el.addEventListener("rl-rows-change", () => {
    const opts = trackOptions();
    for (const e of stepList) {
      const sel = e.track;
      const keep = sel.value;
      sel.replaceChildren(...opts.map(([v, text]) => h("option", { value: v }, text)));
      sel.value = opts.some(([v]) => v === keep) ? keep : "";
      e.paint();
    }
  });
  const stepsSection = h("div", { class: "rl-steps-wrap" }, h("div", { class: "kp-formgrid" }, row(t("edit.quickLabel"), quick, t("edit.quickHint"))), stepsBox, stepsEmpty);
  return {
    el: stepsSection,
    get list() {
      return stepList;
    },
    set list(v) {
      stepList = v;
    },
    renumber,
    /** The step rows that have text: the one set the times, the timeline and the meeting-lane pass all read. */
    live: () => liveRows(stepList),
    /** The live rows as steps. */
    liveSteps: () => liveRows(stepList).map((e) => e.get()),
  };
}
