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

/** @param {Record<string, any>} s */
export function stepEditor(s, { tracker, trackOptions, list }) {
  s.id ||= newId();
  const text = area(s.text ?? "", 1);
  text.classList.add("rl-step__text");
  text.setAttribute("aria-label", t("edit.instruction"));
  const say = input(s.say ?? "", "text", { placeholder: t("edit.sayPh") });
  const track = select(trackOptions(), s.track ?? "", t("edit.track"));
  const mins = stepper(s.mins ?? 0, { max: 1440, unit: "min", label: t("recs.colMinutes") });
  const active = toggle(t("edit.activeSwitch"), s.active !== false);
  const mini = toggle(t("edit.miniSwitch"), s.mini !== false);
  const hasTimer = toggle(t("edit.timerSwitch"), Boolean(s.timer));
  const timerName = input(s.timer?.name ?? "", "text", { "aria-label": t("edit.timerName"), placeholder: t("edit.timerNamePh") });
  const timerSecs = input(s.timer?.seconds ?? "", "number", { "aria-label": t("edit.timerSeconds"), min: "1", step: "1", placeholder: "600" });
  const note = input(s.note ?? "", "text", { placeholder: t("edit.notePh") });
  const warn = toggle(t("edit.warnSwitch"), s.note_tone === "warning");
  // Where it falls in time (recipe/schedule.js): both optional; the draggable timeline writes them too.
  const start = input(typeof s.start === "number" ? String(s.start) : "", "number", { min: "0", step: "1", inputmode: "numeric", placeholder: t("edit.startPh") });
  const partner = select([["", t("edit.withNone")]], s.with ?? "", t("edit.with"));
  const uses = rows({
    columns: [
      { label: t("edit.amount"), width: "7rem", make: (u) => { const c = textCell(t("edit.amountWritten"), u.amount ?? "", t("edit.amountPh")); return c; } },
      { label: t("edit.what"), width: "minmax(0, 1fr)", make: (u) => textCell(t("edit.whatItIs"), u.name ?? "", t("edit.whatPh")) },
    ],
    items: s.uses ?? [], add: t("edit.addUse"), noun: "item", blank: () => ({ amount: "", name: "" }),
  });
  const timerRow = h("div", { class: "rl-pair" }, timerName, timerSecs);
  const photos = photoField({ ids: s.photos ?? [], max: 8, label: t("edit.stepPhoto"), tracker, compact: true });
  photos.el.classList.add("rl-step__photos");
  const fields = h(
    "div",
    { class: "kp-formgrid" },
    row(t("edit.sayAs"), say, t("edit.sayHint")),
    row(t("edit.track"), track, t("edit.trackHint")),
    row(t("recs.colMinutes"), mins, t("edit.minsHint")),
    row(t("edit.handsOn"), active, t("edit.handsOnHint")),
    row(t("edit.timer"), hasTimer, t("edit.timerHint")),
    row(t("edit.timerPair"), timerRow, ""),
    row(t("edit.note"), note, ""),
    row(t("edit.warning"), warn, ""),
    row(t("edit.mini"), mini, ""),
    row(t("edit.startAt"), start, t("edit.startHint")),
    row(t("edit.with"), partner, t("edit.withHint")),
  );
  const more = h("details", { class: "rl-step__more" }, h("summary", null, t("edit.more")), h("div", { class: "rl-step__body" }, fields, h("div", { class: "rl-list" }, h("h4", { class: "kp-fw-semibold" }, t("edit.stepNeeds")), uses.el)));
  const head = h("span", { class: "rl-step__n" });
  const chips = h("div", { class: "rl-step__chips" });
  const up = h("button", { type: "button", class: "kp-button kp-button--sm" }, t("edit.moveUp"));
  const down = h("button", { type: "button", class: "kp-button kp-button--sm" }, t("edit.moveDown"));
  const del = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--ghost" }, t("edit.removeStep"));
  // The camera button on the first line (Kenny, 29/10/2026) opens the picker; the photos sit in a strip under the line.
  const camera = h("button", { type: "button", class: "kp-button kp-button--sm" }, t("edit.camera"));
  camera.addEventListener("click", () => {
    if (photos.full()) toast(t("edit.photosFull"), { live: "polite" });
    else photos.pick();
  });
  const el = h("li", { class: "rl-step", role: "group" }, head, text, h("div", { class: "rl-step__buttons" }, camera, up, down, del), chips, photos.el, more);
  const secs = () => Number(/** @type {HTMLInputElement} */ (timerSecs).value);
  const entry = {
    el,
    id: String(s.id),
    track,
    partner,
    mins,
    start,
    text,
    head,
    up,
    down,
    del,
    camera,
    /**
     * The fields the timeline owns, written from it (Kenny, 30/10/2026): the sequencer is the other view of these four.
     * @param {{ track: string | null, mins: number, start: number | null, with: string | null }} p
     */
    set: (p) => {
      track.value = p.track ?? "";
      setQuantity(mins, p.mins);
      /** @type {HTMLInputElement} */ (start).value = p.start === null || p.start === undefined ? "" : String(p.start);
      partner.value = p.with ?? "";
      for (const sel of [track, partner]) drawnSelect(sel)?.refresh();
    },
    /** The chips under the text say what the fold holds. */
    paint: () => {
      const m = getQuantity(mins);
      const trackName = track.value ? (track.selectedOptions[0]?.textContent ?? "") : "";
      const others = list().findIndex((e) => e.id === partner.value);
      /** @type {[string, string][]} */
      const list = [];
      if (m > 0) list.push(["", t("wheel.min", m)]);
      if (trackName) list.push(["", trackName]);
      if (on(hasTimer) && secs() > 0) list.push(["", t("edit.chipTimer")]);
      const nPhotos = photos.get().length;
      if (nPhotos) list.push(["", t("edit.chipPhotos", nPhotos)]);
      if (on(warn)) list.push(["kp-badge--warning", t("edit.chipWarning")]);
      if (partner.value && others >= 0) list.push(["kp-badge--info", t("edit.chipWith", others + 1)]);
      if (start.value !== "") list.push(["kp-badge--info", t("edit.chipStart", Number(/** @type {HTMLInputElement} */ (start).value))]);
      chips.hidden = list.length === 0;
      chips.replaceChildren(...list.map(([cls, label]) => h("span", { class: `kp-badge ${cls}`.trim() }, label)));
    },
    /** The partner list: every other step, by its number and the start of its text. */
    options: () => {
      const keep = partner.value || s.with || "";
      const opts = partnerChoices(/** @type {any} */ (list()), entry.id, { none: t("edit.withNone"), unnamed: t("edit.unnamedStep") });
      partner.replaceChildren(...opts.map(([v, label]) => h("option", { value: v }, label)));
      partner.value = opts.some(([v]) => v === keep) ? keep : "";
    },
    get: () =>
      stepFromFields({
        id: entry.id,
        track: track.value,
        text: /** @type {HTMLTextAreaElement} */ (text).value,
        say: /** @type {HTMLInputElement} */ (say).value,
        mins: getQuantity(mins),
        active: on(active),
        hasTimer: on(hasTimer),
        timerName: /** @type {HTMLInputElement} */ (timerName).value,
        timerSeconds: /** @type {HTMLInputElement} */ (timerSecs).value,
        timerDefault: t("edit.timerDefault"),
        uses: /** @type {[string, string][]} */ (uses.get()),
        note: /** @type {HTMLInputElement} */ (note).value,
        warn: on(warn),
        mini: on(mini),
        photos: photos.get(),
        start: /** @type {HTMLInputElement} */ (start).value,
        partner: partner.value,
      }),
  };
  return entry;
}
