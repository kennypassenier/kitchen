// One step row of the editor: the instruction, chips for what the fold holds, and the fold with every other field.
// `list` gives the rows of all steps (a row reads its neighbours for the partner list and the chips).

import { drawnSelect } from "/static/kp/js/combobox.js";
import { getQuantity, setQuantity } from "/static/kp/js/quantity.js";
import { toast } from "/static/kp/js/overlays.js";
import { h } from "../../dom.js";
import { t } from "../../i18n/index.js";
import { row, input, area, stepper, toggle, on, select, rows, textCell } from "../../ui/form-parts.js";
import { photoField } from "../photos.js";
import { stepFromFields, partnerChoices } from "./logic.js";
import { newId } from "./ids.js";

/**
 * @typedef {{ el: HTMLElement, get: () => any, set: (p: any) => void, track: HTMLSelectElement, partner: HTMLSelectElement, text: HTMLElement, head: HTMLElement, up: HTMLElement, down: HTMLElement, camera: HTMLElement, start: HTMLElement, id: string, paint: () => void, options: () => void }} StepRow
 */

/** The inputs of one step, filled from the step. @param {Record<string, any>} s @param {{ tracker: any, trackOptions: () => [string, string][] }} o */
function makeFields(s, { tracker, trackOptions }) {
  const text = area(s.text ?? "", 1);
  text.classList.add("rl-step__text");
  text.setAttribute("aria-label", t("edit.instruction"));
  const photos = photoField({ ids: s.photos ?? [], max: 8, label: t("edit.stepPhoto"), tracker, compact: true });
  photos.el.classList.add("rl-step__photos");
  return {
    text,
    say: input(s.say ?? "", "text", { placeholder: t("edit.sayPh") }),
    track: select(trackOptions(), s.track ?? "", t("edit.track")),
    mins: stepper(s.mins ?? 0, { max: 1440, unit: "min", label: t("recs.colMinutes") }),
    active: toggle(t("edit.activeSwitch"), s.active !== false),
    mini: toggle(t("edit.miniSwitch"), s.mini !== false),
    hasTimer: toggle(t("edit.timerSwitch"), Boolean(s.timer)),
    timerName: input(s.timer?.name ?? "", "text", { "aria-label": t("edit.timerName"), placeholder: t("edit.timerNamePh") }),
    timerSecs: input(s.timer?.seconds ?? "", "number", { "aria-label": t("edit.timerSeconds"), min: "1", step: "1", placeholder: "600" }),
    note: input(s.note ?? "", "text", { placeholder: t("edit.notePh") }),
    warn: toggle(t("edit.warnSwitch"), s.note_tone === "warning"),
    // Where it falls in time (recipe/schedule.js): both optional; the draggable timeline writes them too.
    start: input(typeof s.start === "number" ? String(s.start) : "", "number", { min: "0", step: "1", inputmode: "numeric", placeholder: t("edit.startPh") }),
    partner: select([["", t("edit.withNone")]], s.with ?? "", t("edit.with")),
    uses: rows({
      columns: [
        { label: t("edit.amount"), width: "7rem", make: (u) => textCell(t("edit.amountWritten"), u.amount ?? "", t("edit.amountPh")) },
        { label: t("edit.what"), width: "minmax(0, 1fr)", make: (u) => textCell(t("edit.whatItIs"), u.name ?? "", t("edit.whatPh")) },
      ],
      items: s.uses ?? [], add: t("edit.addUse"), noun: "item", blank: () => ({ amount: "", name: "" }),
    }),
    photos,
  };
}

/** The fold: every field but the instruction, and what the step needs. @param {ReturnType<typeof makeFields>} f */
function foldOf(f) {
  const timerRow = h("div", { class: "rl-pair" }, f.timerName, f.timerSecs);
  const fields = h(
    "div",
    { class: "kp-formgrid" },
    row(t("edit.sayAs"), f.say, t("edit.sayHint")),
    row(t("edit.track"), f.track, t("edit.trackHint")),
    row(t("recs.colMinutes"), f.mins, t("edit.minsHint")),
    row(t("edit.handsOn"), f.active, t("edit.handsOnHint")),
    row(t("edit.timer"), f.hasTimer, t("edit.timerHint")),
    row(t("edit.timerPair"), timerRow, ""),
    row(t("edit.note"), f.note, ""),
    row(t("edit.warning"), f.warn, ""),
    row(t("edit.mini"), f.mini, ""),
    row(t("edit.startAt"), f.start, t("edit.startHint")),
    row(t("edit.with"), f.partner, t("edit.withHint")),
  );
  return h("details", { class: "rl-step__more" }, h("summary", null, t("edit.more")), h("div", { class: "rl-step__body" }, fields, h("div", { class: "rl-list" }, h("h4", { class: "kp-fw-semibold" }, t("edit.stepNeeds")), f.uses.el)));
}

/** The number, the chips and the buttons of the first line. @param {ReturnType<typeof makeFields>} f */
function lineParts(f) {
  const head = h("span", { class: "rl-step__n" });
  const chips = h("div", { class: "rl-step__chips" });
  const up = h("button", { type: "button", class: "kp-button kp-button--sm" }, t("edit.moveUp"));
  const down = h("button", { type: "button", class: "kp-button kp-button--sm" }, t("edit.moveDown"));
  const del = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--ghost" }, t("edit.removeStep"));
  // The camera button on the first line (Kenny, 29/10/2026) opens the picker; the photos sit in a strip under the line.
  const camera = h("button", { type: "button", class: "kp-button kp-button--sm" }, t("edit.camera"));
  camera.addEventListener("click", () => {
    if (f.photos.full()) toast(t("edit.photosFull"), { live: "polite" });
    else f.photos.pick();
  });
  return { head, chips, up, down, del, camera };
}

/** The chips under the text say what the fold holds. @param {ReturnType<typeof makeFields>} f @param {HTMLElement} chips @param {number} partnerAt the partner's place in the list, or -1 */
function paintChips(f, chips, partnerAt) {
  const m = getQuantity(f.mins);
  const trackName = f.track.value ? (f.track.selectedOptions[0]?.textContent ?? "") : "";
  /** @type {[string, string][]} */
  const shown = [];
  if (m > 0) shown.push(["", t("wheel.min", m)]);
  if (trackName) shown.push(["", trackName]);
  if (on(f.hasTimer) && Number(/** @type {HTMLInputElement} */ (f.timerSecs).value) > 0) shown.push(["", t("edit.chipTimer")]);
  const nPhotos = f.photos.get().length;
  if (nPhotos) shown.push(["", t("edit.chipPhotos", nPhotos)]);
  if (on(f.warn)) shown.push(["kp-badge--warning", t("edit.chipWarning")]);
  if (f.partner.value && partnerAt >= 0) shown.push(["kp-badge--info", t("edit.chipWith", partnerAt + 1)]);
  if (f.start.value !== "") shown.push(["kp-badge--info", t("edit.chipStart", Number(/** @type {HTMLInputElement} */ (f.start).value))]);
  chips.hidden = shown.length === 0;
  chips.replaceChildren(...shown.map(([cls, label]) => h("span", { class: `kp-badge ${cls}`.trim() }, label)));
}

/** The fields read back into a step. @param {string} id @param {ReturnType<typeof makeFields>} f */
function readStep(id, f) {
  return stepFromFields({
    id,
    track: f.track.value,
    text: /** @type {HTMLTextAreaElement} */ (f.text).value,
    say: /** @type {HTMLInputElement} */ (f.say).value,
    mins: getQuantity(f.mins),
    active: on(f.active),
    hasTimer: on(f.hasTimer),
    timerName: /** @type {HTMLInputElement} */ (f.timerName).value,
    timerSeconds: /** @type {HTMLInputElement} */ (f.timerSecs).value,
    timerDefault: t("edit.timerDefault"),
    uses: /** @type {[string, string][]} */ (f.uses.get()),
    note: /** @type {HTMLInputElement} */ (f.note).value,
    warn: on(f.warn),
    mini: on(f.mini),
    photos: f.photos.get(),
    start: /** @type {HTMLInputElement} */ (f.start).value,
    partner: f.partner.value,
  });
}

/** @param {Record<string, any>} s */
export function stepEditor(s, { tracker, trackOptions, list }) {
  s.id ||= newId();
  const f = makeFields(s, { tracker, trackOptions });
  const line = lineParts(f);
  const el = h("li", { class: "rl-step", role: "group" }, line.head, f.text, h("div", { class: "rl-step__buttons" }, line.camera, line.up, line.down, line.del), line.chips, f.photos.el, foldOf(f));
  const entry = {
    el,
    id: String(s.id),
    track: f.track,
    partner: f.partner,
    mins: f.mins,
    start: f.start,
    text: f.text,
    head: line.head,
    up: line.up,
    down: line.down,
    del: line.del,
    camera: line.camera,
    /**
     * The fields the timeline owns, written from it (Kenny, 30/10/2026): the sequencer is the other view of these four.
     * @param {{ track: string | null, mins: number, start: number | null, with: string | null }} p
     */
    set: (p) => {
      f.track.value = p.track ?? "";
      setQuantity(f.mins, p.mins);
      /** @type {HTMLInputElement} */ (f.start).value = p.start === null || p.start === undefined ? "" : String(p.start);
      f.partner.value = p.with ?? "";
      for (const sel of [f.track, f.partner]) drawnSelect(sel)?.refresh();
    },
    paint: () => paintChips(f, line.chips, list().findIndex((e) => e.id === f.partner.value)),
    /** The partner list: every other step, by its number and the start of its text. */
    options: () => {
      const keep = f.partner.value || s.with || "";
      const opts = partnerChoices(/** @type {any} */ (list()), entry.id, { none: t("edit.withNone"), unnamed: t("edit.unnamedStep") });
      f.partner.replaceChildren(...opts.map(([v, label]) => h("option", { value: v }, label)));
      f.partner.value = opts.some(([v]) => v === keep) ? keep : "";
    },
    get: () => readStep(entry.id, f),
  };
  return entry;
}
