// The recipe editor: a drawer with every field of a recipe on `.kp-formgrid`.
//
// Choices are chips, segmented controls and switches wherever the set is
// known (meals, prep, tracks, units); numbers are the package's stepper;
// the repeatable lists (tracks, ingredients, tools, steps, what a step uses)
// are rows on shared columns, each with its own Add and Remove buttons.
// The form reads itself back into a recipe on Save. The small form helpers
// are exported for the dish editor (js/dishes/editor.js), which uses the same
// drawer and grid.

import { attachSegmented, getSegmentedValues } from "/static/kp/js/segmented.js";
import { attachSelects } from "/static/kp/js/combobox.js";
import { attachComboboxes, combobox, drawnSelect } from "/static/kp/js/combobox.js";
import { attachSequencers, setSequencerItems, setSequencerState, SEQUENCER_CHANGE_EVENT } from "/static/kp/js/sequencer.js";
import { attachQuantities, getQuantity, setQuantity } from "/static/kp/js/quantity.js";
import { attachSwitches } from "/static/kp/js/forms.js";
import { attachAutosize } from "/static/kp/js/autosize.js";
import { attachFlashButtons, runFlashButton } from "/static/kp/js/flash.js";
import { closeDialog } from "/static/kp/js/motion.js";
import { toast } from "/static/kp/js/overlays.js";
import { h } from "../dom.js";
import { create, replace, kitchenNow, readDraft, saveDraft, deleteDraft, ApiError } from "../api.js";
import { dishPicker } from "../dishes/picker.js";
import { ingredientPicker, ingredientsPicker } from "../ingredients/picker.js";
import { photoField, photoTracker, photosOf } from "./photos.js";
import { coverCard } from "./cover.js";
import { wordsFor } from "./words.js";
import { effective } from "./schedule.js";
import { toItems, fromItems } from "./sequence.js";
import { settle } from "./meet.js";
import { timeOverride, liveRows as liveOf, timesOf, stepFromFields, trackChoices, partnerChoices, labelOut as labelOf, dishText as dishNameOf, unresolvedOf, recipeBody } from "./editor/logic.js";
import { t, lang } from "../i18n/index.js";
import { cap, stamp } from "../format.js";
import { row, input, area, stepper, toggle, on, segmented, select, rows, textCell } from "../ui/form-parts.js";

/** Meals and preparation, as the data names them. */
const mealItems = () => [["breakfast", t("wheel.mealBreakfast")], ["lunch", t("wheel.mealLunch")], ["dinner", t("wheel.mealDinner")]];
const prepItems = () => [["none", t("edit.prepNone")], ["light", t("edit.prepLight")], ["full", t("edit.prepFull")]];
/** Main ingredients the wheel knows; any other already in the kitchen is added to the list. */
const MAIN = ["chicken", "beef", "pork", "fish", "egg", "cheese", "tomato", "potato", "vegetables", "pasta", "rice"];
const UNITS = ["g", "ml", "pc", "tbsp", "tsp", "pinch", "clove", "slice", "handful"];
/** The two lists a recipe line may be on, named in the language of the screen (an older recipe's own list names stay as written). */
const groups = () => [t("edit.groupMain"), t("edit.groupCupboard")];
/** A unit written out in the language of the screen. @param {string} unit */
const unitName = (unit) => wordsFor(lang()).units[/** @type {"g"} */ (unit)]?.[0] ?? unit;

export const newId = () => (globalThis.crypto?.randomUUID?.() ?? `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

/**
 * Open the editor for a recipe, or for a new one. `restore` is a draft's form state (Kenny, 29/10/2026): the editor then
 * opens with it instead of the saved recipe.
 * @param {HTMLDialogElement} dialog
 * @param {{ recipe: Record<string, any> | null, mainOptions: string[], preset?: Record<string, any>, restore?: Record<string, any> | null, copyOf?: string, imported?: boolean, cover?: string | null }} spec `copyOf` names the recipe the form is a copy of (recipe/duplicate.js); `imported` makes it the preview of an import (recipe/import.js) and `cover` is the picture address the page offered (recipe/cover.js)
 */
export function openEditor(dialog, { recipe, mainOptions, preset = {}, restore = null, copyOf = "", imported = false, cover = null }) {
  const base = recipe ?? { short: "", summary: "", meals: ["dinner"], ing: [], minutes: 0, hands_on: 0, portions: 2, prep: "light", safe: false, gear: "", last_note: "", mini_note: "", tracks: [], ingredients: [], tools: [], steps: [], ...preset };
  const r = restore ? { ...base, ...restore } : base;
  const editing = Boolean(recipe);
  // The draft's key: the recipe's id, or `new:<dish id>` for a new one.
  const draftKey = recipe ? String(recipe.id) : `new:${preset.dish_id ?? ""}`;
  // Photos (Kenny, 24/10/2026 05:23): what this session uploads and what the recipe had, so Save and Cancel leave no stray file.
  const tracker = photoTracker(photosOf(recipe));
  // A restored draft's photos were sent by an earlier session: this one answers for them now.
  if (restore) for (const id of photosOf(restore)) if (!photosOf(recipe).includes(id)) tracker.uploaded(id);
  const recipePhoto = photoField({ ids: r.photo ? [r.photo] : [], max: 1, label: t("edit.recipePhoto"), tracker });
  const heading = h("h2", { class: "kp-dialog__title", id: "rl-editor-t" }, editing ? t("rec.editTitle", r.name) : copyOf ? t("edit.copyTitle", copyOf) : imported ? t("imp.previewTitle") : t("list.recipes.add"));

  // ---- the dish -----------------------------------------------------------------------------------------------
  // The dish the recipe belongs to (Kenny, 29/10/2026): a recipe is always in a dish, an existing one or a new one that is
  // made when the recipe is saved. Choosing another dish for an existing recipe moves it.
  const dishField = dishPicker(restore ? restore.dish_id ?? null : r.dish_id ?? preset.dish_id ?? null, { label: t("edit.dish"), id: "rl-dish", fresh: restore?.new_dish ?? null });
  const ownLabel = String(r.label?.[lang()] || r.label?.[lang() === "nl" ? "en" : "nl"] || "").trim();
  const label = input(ownLabel, "text", { autocomplete: "off", placeholder: t("edit.labelPh") });
  const short = input(r.short ?? "", "text", { autocomplete: "off" });
  const summary = area(r.summary ?? "", 3);
  // Where the recipe came from (Kenny, 29/10/2026): set by an import, editable, empty clears it.
  const source = input(typeof r.source === "string" ? r.source : "", "url", { autocomplete: "off", inputmode: "url", placeholder: t("edit.sourcePh"), spellcheck: "false" });
  const meals = segmented(mealItems(), r.meals ?? [], "multi", t("edit.meals"));
  const mainSet = [...new Set([...MAIN, ...mainOptions, ...(r.ing ?? [])])].sort();
  const mainBox = h(
    "div",
    { class: "kp-combobox", "data-kp-combobox": true, "data-kp-tags": true, "data-kp-creatable": true },
    h("ul", { class: "kp-tag-list", "data-kp-tag-list": true }, ...(r.ing ?? []).map((/** @type {string} */ tag) => h("li", { class: "kp-tag", "data-value": tag }, tag, h("button", { type: "button", class: "kp-tag__remove", "data-kp-tag-remove": true, "aria-label": t("edit.removeTag", tag) }, "×")))),
    h("input", { class: "kp-combobox__input", id: "rl-main", type: "text", role: "combobox", autocomplete: "off", "aria-expanded": "false", "aria-controls": "rl-main-list", "aria-label": t("edit.mainIng") }),
    h("ul", { class: "kp-combobox__list", id: "rl-main-list", role: "listbox", hidden: true }, ...mainSet.map((tag) => h("li", { class: "kp-combobox__option", role: "option", "data-kp-option": true, "data-value": tag }, cap(tag)))),
    h("p", { class: "kp-combobox__status", "data-kp-combobox-status": true, role: "status", "aria-live": "polite" }),
  );
  const dish = h(
    "div",
    { class: "kp-formgrid" },
    row(t("edit.dish"), dishField.el, t("edit.dishHint"), "rl-dish-l"),
    row(t("edit.label"), label, t("edit.labelHint")),
    row(t("edit.short"), short, t("edit.shortHint")),
    row(t("edit.summary"), summary, t("edit.summaryHint")),
    row(t("edit.source"), source, t("edit.sourceHint")),
    row(t("edit.meals"), meals, t("edit.mealsHint")),
    row(t("edit.mainIng"), mainBox, t("edit.mainHint")),
    row(t("edit.photo"), recipePhoto.el, t("edit.photoHint")),
  );

  // ---- time, portions, how much preparing ---------------------------------------------------------------------
  // The two times are computed from the steps (Kenny, 29/10/2026; recipe/schedule.js) and shown live: the figure is the
  // stepper itself, unreachable until the Override switch lets a typed value win.
  const was = effective(r);
  const minutes = stepper(was.minutes, { max: 1440, unit: "min", label: t("edit.totalMinutes") });
  const hands = stepper(was.hands_on, { max: 1440, unit: "min", label: t("edit.handsMinutes") });
  const minutesOver = toggle(t("edit.overrideSwitch"), timeOverride(r.minutes_override, was.total, Number(r.minutes) || 0));
  const handsOver = toggle(t("edit.overrideSwitch"), timeOverride(r.hands_on_override, was.handsOn, Number(r.hands_on) || 0));
  const minutesHint = h("p", { class: "kp-formgrid__value", role: "status" });
  const handsHint = h("p", { class: "kp-formgrid__value", role: "status" });
  /** A time row: the stepper, the Override switch under it, and a live sentence in the value track. @param {string} label @param {HTMLElement} q @param {HTMLElement} over @param {HTMLElement} hint */
  const timeRow = (label, q, over, hint) => {
    const el = row(label, h("div", { class: "rl-time" }, q, over), "");
    el.append(hint);
    return el;
  };
  const portions = stepper(r.portions ?? 2, { min: 1, max: 24, unit: t("bad.unitMany"), one: t("bad.unitOne"), label: t("bad.colPortions") });
  const prep = segmented(prepItems(), [r.prep ?? "light"], "single", t("edit.preparing"));
  const safe = toggle(t("edit.safeSwitch"), Boolean(r.safe));
  const gear = input(r.gear ?? "", "text", { placeholder: t("edit.gearPh") });
  const facts = h(
    "div",
    { class: "kp-formgrid" },
    timeRow(t("edit.totalTime"), minutes, minutesOver, minutesHint),
    timeRow(t("edit.handsTime"), hands, handsOver, handsHint),
    row(t("bad.colPortions"), portions, t("edit.portionsHint")),
    row(t("edit.preparing"), prep, t("edit.prepHint")),
    row(t("edit.safeFav"), safe, t("edit.safeHint")),
    row(t("edit.gear"), gear, t("edit.gearHint")),
  );

  // ---- notes ---------------------------------------------------------------------------------------------------
  const lastNote = area(r.last_note ?? "", 2);
  const miniNote = area(r.mini_note ?? "", 2);
  const notes = h("div", { class: "kp-formgrid" }, row(t("edit.lastTime"), lastNote, t("edit.lastHint")), row(t("bad.miniVersion"), miniNote, t("edit.miniHint")));

  // ---- tracks, ingredients, tools ------------------------------------------------------------------------------
  const tracks = rows({
    columns: [{ label: t("edit.trackName"), width: "minmax(0, 1fr)", make: (tk) => { const c = textCell(t("edit.trackName"), tk.name ?? "", t("edit.trackPh")); return { el: c.el, get: () => ({ id: tk.id ?? (tk.id = newId()), name: c.get() }) }; } }],
    items: r.tracks ?? [], add: t("edit.addTrack"), noun: "track", blank: () => ({ name: "" }),
  });
  const ingredients = rows({
    columns: [
      {
        label: t("edit.ingredient"),
        width: "minmax(0, 1fr)",
        make: (i) => {
          const c = ingredientPicker(i.ingredient ?? null, { label: t("edit.ingredient") });
          // A remark about the line ("chopped", "schil en sap"; an import fills it from the brackets), shown on the recipe page.
          const noteField = input(i.note ?? "", "text", { "aria-label": t("edit.lineNote"), placeholder: t("edit.lineNotePh"), autocomplete: "off" });
          const cell = h("div", { class: "ri-cell" }, c.el, noteField);
          // An imported line the catalogue did not know (Kenny, 29/10/2026 14:27): what the page said, and two explicit
          // actions: add it as a new ingredient (the picker's own step, both names required) or discard the line. Save is
          // blocked while such a line stands (the alert above the list lists them). It goes once the line has an ingredient.
          if (i.proposal) {
            const addNew = h("button", { type: "button", class: "kp-button kp-button--sm" }, t("imp.addNew"));
            const discard = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--ghost" }, t("imp.discard"));
            const note = h("div", { class: "ri-proposal" }, h("p", { class: "ri-proposal__text" }, t("imp.fromPage", i.proposal.text)), h("div", { class: "kp-row-actions" }, addNew, discard));
            addNew.addEventListener("click", () => c.startNew(String(i.proposal.name ?? "")));
            discard.addEventListener("click", () => /** @type {HTMLElement | null} */ (cell.closest(".rl-row")?.querySelector(".rl-row__remove"))?.click());
            const settle = () => void (note.hidden = Boolean(c.get()));
            for (const type of ["input", "change", "kp-combobox-change"]) cell.addEventListener(type, () => setTimeout(settle, 0));
            cell.append(note);
          }
          return { el: cell, get: () => { const ingredient = c.get(); const text = /** @type {HTMLInputElement} */ (noteField).value.trim(); return { ...i, id: i.id ?? (i.id = newId()), ingredient, note: text || undefined, proposal: ingredient ? undefined : i.proposal }; } };
        },
      },
      { label: t("edit.amount"), width: "6rem", make: (i) => { const el = input(i.amount ?? "", "number", { "aria-label": t("edit.amount"), step: "any", min: "0", inputmode: "decimal" }); return { el, get: () => (/** @type {HTMLInputElement} */ (el).value === "" ? null : Number(/** @type {HTMLInputElement} */ (el).value)) }; } },
      { label: t("edit.unit"), width: "8rem", make: (i) => { const el = select([...new Set([...UNITS, i.unit].filter(Boolean))].map((u) => [u, unitName(u)]), i.unit ?? "g", t("edit.unit")); return { el, get: () => el.value }; } },
      { label: t("edit.list"), width: "14rem", make: (i) => { const el = select([...new Set([...groups(), ...(r.ingredients ?? []).map((/** @type {any} */ x) => x.group), i.group].filter(Boolean))].map((g) => [g, g]), i.group ?? groups()[0], t("edit.whichList")); return { el, get: () => el.value }; } },
    ],
    items: r.ingredients ?? [], add: t("list.ingredients.add"), noun: "ingredient", blank: () => ({ ingredient: null, amount: null, unit: "g", group: groups()[0] }),
  });  // Several ingredients at once (Kenny, 24/10/2026 10:14): pick them in one go, then each becomes its own line with its
  // own amount; a new one can be added right in the picker, as in the lines.
  const many = ingredientsPicker([], { label: t("edit.manyLabel") });
  const manyAdd = h("button", { type: "button", class: "kp-button kp-button--sm" }, t("edit.manyAdd"));
  manyAdd.addEventListener("click", () => {
    const ids = many.get();
    for (const id of ids) ingredients.add({ ingredient: id, amount: null, unit: "g", group: groups()[0] });
    if (ids.length) many.clear();
  });

  const tools = rows({
    columns: [{ label: t("edit.tool"), width: "minmax(0, 1fr)", make: (tk) => { const c = textCell(t("edit.toolName"), tk.name ?? "", t("edit.toolPh")); return { el: c.el, get: () => ({ id: tk.id ?? (tk.id = newId()), name: c.get() }) }; } }],
    items: r.tools ?? [], add: t("edit.addTool"), noun: "tool", blank: () => ({ name: "" }),
  });
  /** A repeatable list under its own small heading and sentence. @param {string} title @param {string} text @param {...HTMLElement} els */
  const listBlock = (title, text, ...els) => h("div", { class: "rl-list" }, h("h4", { class: "kp-fw-semibold" }, title), h("p", { class: "rl-formsec__text" }, text), ...els);
  // Imported lines still without an ingredient (Kenny, 29/10/2026): listed in a warning above the lines, and Save is blocked
  // until each one is added as a new ingredient, given an ingredient, or discarded.
  const unresolvedBox = h("div", { class: "kp-alert kp-alert--warning ri-unresolved", role: "status", hidden: true });
  const unresolvedLines = () => unresolvedOf(ingredients.get().map(([n]) => n));
  const paintUnresolved = () => {
    const lines = unresolvedLines();
    unresolvedBox.hidden = lines.length === 0;
    if (lines.length) unresolvedBox.replaceChildren(h("div", { class: "kp-alert__body" }, h("strong", null, t("imp.unresolvedTitle", lines.length)), " ", t("imp.unresolvedText"), h("ul", { class: "ri-unresolved__list" }, ...lines.slice(0, 6).map((l) => h("li", null, l)), lines.length > 6 ? h("li", null, t("imp.more", lines.length - 6)) : null)));
  };
  const lists = h(
    "div",
    { class: "rl-lists" },
    listBlock(t("edit.tracks"), t("edit.tracksHint"), tracks.el),
    listBlock(t("edit.ingredients"), t("edit.ingredientsHint"), unresolvedBox, h("div", { class: "rl-many" }, many.el, manyAdd), ingredients.el),
    listBlock(t("edit.tools"), t("edit.toolsHint"), tools.el),
  );

  // ---- steps ---------------------------------------------------------------------------------------------------
  // Quick-add (Kenny, 29/10/2026): one field at the top, Enter adds the step and the field is ready for the next. A step
  // is one line (number, its text, chips for what it says, Up / Down and Remove) and "More" folds out the rest.
  const trackOptions = () => trackChoices(tracks.get().map(([tk]) => tk), { meet: t("edit.tracksMeet"), unnamed: t("edit.unnamedTrack") });
  /** @type {{ el: HTMLElement, get: () => any, track: HTMLSelectElement, partner: HTMLSelectElement, text: HTMLElement, head: HTMLElement, up: HTMLElement, down: HTMLElement, id: string, paint: () => void, options: () => void }[]} */
  let stepList = [];
  const stepsBox = h("ol", { class: "rl-steps" });
  const stepsEmpty = h("p", { class: "rl-rows__empty" }, t("edit.noSteps"));
  const quick = /** @type {HTMLInputElement} */ (h("input", { class: "kp-field__input", type: "text", id: "rl-quick", autocomplete: "off", enterkeyhint: "next", placeholder: t("edit.quickPh"), "aria-label": t("edit.quickLabel") }));

  /** @param {Record<string, any>} s */
  function stepEditor(s) {
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
        const others = stepList.findIndex((e) => e.id === partner.value);
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
        const opts = partnerChoices(/** @type {any} */ (stepList), entry.id, { none: t("edit.withNone"), unnamed: t("edit.unnamedStep") });
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
    const e = stepEditor(s);
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
  /** The step rows that have text: the one set the times, the timeline and the meeting-lane pass all read (empty rows count nowhere). */
  const liveRows = () => liveOf(stepList);
  /** The two times from the steps as they stand, and what is stored: a typed override wins. */
  const timesNow = () => {
    const typed = (/** @type {HTMLElement} */ sw, /** @type {HTMLElement} */ q) => (on(sw) ? getQuantity(q) : null);
    return timesOf(r, liveRows().map((e) => e.get()), tracks.get().map(([tk]) => tk), { minutes: typed(minutesOver, minutes), hands: typed(handsOver, hands) });
  };
  const refreshTimes = () => {
    const now = timesNow();
    for (const [sw, q, computed] of /** @type {[HTMLElement, HTMLElement, number][]} */ ([[minutesOver, minutes, now.minutes], [handsOver, hands, now.hands_on]])) {
      if (on(sw)) q.removeAttribute("data-kp-quantity-disabled");
      else q.setAttribute("data-kp-quantity-disabled", "");
      setQuantity(q, on(sw) ? getQuantity(q) : computed);
    }
    minutesHint.textContent = on(minutesOver) ? t("edit.totalTyped", now.total) : t("edit.totalComputed", now.total);
    handsHint.textContent = on(handsOver) ? t("edit.handsTyped", now.handsOn) : t("edit.handsComputed", now.handsOn);
  };

  // ---- the timeline -------------------------------------------------------------------------------------------
  // The steps as clips on lanes, one lane per track (Kenny, 30/10/2026: a draggable timeline, "like a video editor"): drag to
  // move, drag between lanes to run things in parallel, drag an edge to change how long a step takes. It is the kit's
  // sequencer (kp-themes 11.3.0); recipe/sequence.js maps the step fields to its items and back, and the list above stays the
  // other view: a change in either one is written to the same four fields (track, mins, start, with) and shown in the other.
  const seqHost = h("section", { class: "kp-gantt kp-sequencer rl-timeline", "data-kp-sequencer": true, "data-kp-sequencer-unit": "minute", "data-kp-sequencer-snap": "1", "aria-label": t("edit.timelineLabel") });
  const namedTracks = () => tracks.get().map(([tk]) => tk).filter((tk) => tk.name);
  let syncing = false;
  let paintQueued = false;
  let seqState = "";
  const paintTimeline = () => {
    if (syncing) return;
    const number = new Map(stepList.map((e, i) => [e.id, i + 1]));
    const { items, lanes } = toItems(settle(liveRows().map((e) => e.get()), namedTracks()), namedTracks(), {
      meet: t("edit.tracksMeet"),
      all: t("edit.timelineAll"),
      unnamed: t("edit.unnamedTrack"),
      label: (st, n) => `${number.get(st.id) ?? n}. ${st.text}`,
    });
    setSequencerItems(seqHost, items, lanes);
    const state = items.length ? "ready" : "empty";
    if (state !== seqState) {
      seqState = state;
      setSequencerState(seqHost, state, t("edit.timelineEmpty"), { text: t("edit.timelineEmptyText") });
    }
  };
  /** Several events in a row (a typed number, a removed step) paint the timeline once. */
  const queuePaint = (/** @type {Event} */ ev) => {
    if (paintQueued || seqHost.contains(/** @type {Node} */ (ev.target))) return;
    paintQueued = true;
    queueMicrotask(() => {
      paintQueued = false;
      paintTimeline();
    });
  };
  // An edit dropped on the timeline: write it to the step fields, put the list in the order of the starts, and let the
  // normal form events carry it on (the two times, the draft). The timeline is then painted again from the fields.
  seqHost.addEventListener(SEQUENCER_CHANGE_EVENT, (ev) => {
    syncing = true;
    try {
      // The meeting lane then follows the steps before it (recipe/meet.js, Kenny, 30/10/2026).
      const after = settle(fromItems(stepList.map((e) => e.get()), namedTracks(), /** @type {CustomEvent} */ (ev).detail.items), namedTracks());
      const byId = new Map(stepList.map((e) => [e.id, e]));
      for (const st of after) /** @type {any} */ (byId.get(st.id))?.set(st);
      stepList = after.map((st) => /** @type {any} */ (byId.get(st.id)));
      renumber();
    } finally {
      syncing = false;
    }
    paintTimeline();
  });
  const stepsSection = h("div", { class: "rl-steps-wrap" }, h("div", { class: "kp-formgrid" }, row(t("edit.quickLabel"), quick, t("edit.quickHint"))), stepsBox, stepsEmpty);

  // ---- the drawer ---------------------------------------------------------------------------------------------
  const sec = (title, text, ...body) => h("section", { class: "rl-formsec" }, h("h3", { class: "kp-fw-semibold" }, title), h("p", { class: "rl-formsec__text" }, text), ...body);
  const save = h("button", { type: "submit", class: "kp-button kp-button--primary", "data-kp-flash-button": true, "data-kp-flash-words": t("set.saved"), form: "rl-editor-form" }, editing ? t("edit.saveRecipe") : t("list.recipes.addSave"));
  const cancel = h("button", { type: "button", class: "kp-button" }, t("common.cancel"));
  const form = h(
    "form",
    { class: "kp-drawer__body rl-form", id: "rl-editor-form", novalidate: true },
    sec(t("edit.secDish"), t("edit.secDishText"), dish),
    sec(t("edit.secTime"), t("edit.secTimeText"), facts),
    sec(t("edit.secNotes"), t("edit.secNotesText"), notes),
    sec(t("edit.secLists"), t("edit.secListsText"), lists),
    sec(t("edit.secTimeline"), t("edit.secTimelineText"), seqHost),
    sec(t("edit.secSteps"), t("edit.secStepsText"), stepsSection),
  );
  const line = h("p", { class: "rl-editor__line", role: "status" });
  // The cover offer of an import: nothing is loaded from the page's site until Yes (recipe/cover.js).
  if (cover) {
    form.prepend(
      coverCard({
        url: cover,
        picked: (id) => {
          tracker.uploaded(id);
          recipePhoto.set([id]);
        },
      }),
    );
  }
  // The draft offer (Kenny, 29/10/2026): a draft saved by an earlier session is offered above the form.
  const offer = h("div", { class: "kp-alert kp-alert--info rl-draft", role: "status", hidden: true });
  form.prepend(offer);
  dialog.replaceChildren(
    h(
      "header",
      { class: "kp-drawer__head" },
      heading,
      h("button", { type: "button", class: "kp-icon-button kp-dialog__close", "aria-label": t("edit.close"), "data-close": true }, "✕"),
      h("p", { class: "kp-drawer__desc" }, editing ? t("rec.editText") : copyOf ? t("edit.copyText") : imported ? t("imp.previewText") : t("rec.addText")),
    ),
    form,
    h("footer", { class: "kp-drawer__foot" }, line, cancel, save),
  );

  /** @param {ParentNode} root */
  function attachControls(root) {
    attachSelects(root);
    attachQuantities(root);
    attachSwitches(root);
    attachSegmented(root);
    attachAutosize(root);
    attachComboboxes(root, { creatable: true });
    attachFlashButtons(root);
  }
  attachControls(dialog);
  // The timeline: one sequencer per opening, detached when the drawer closes or is opened again on a restored draft.
  /** @type {any} */ (dialog).__rlSeq?.();
  const detachSeq = attachSequencers(form);
  /** @type {any} */ (dialog).__rlSeq = detachSeq;
  dialog.addEventListener("close", detachSeq, { once: true });
  /** The meeting lane follows the steps before it (recipe/meet.js): a moved start is written into its field before anything is read. */
  const settleFields = (/** @type {Event} */ ev) => {
    if (syncing || seqHost.contains(/** @type {Node} */ (ev.target)) || (ev.type === "input" && stepList.some((e) => e.start === ev.target))) return;
    const rows = liveRows();
    const now = rows.map((e) => e.get());
    const after = settle(now, namedTracks());
    after.forEach((st, i) => {
      if (st !== now[i]) /** @type {any} */ (rows[i]).set(st);
    });
  };
  for (const type of ["input", "change", "kp-quantity-change", "rl-rows-change"]) form.addEventListener(type, settleFields);
  settleFields(new Event("change"));
  for (const type of ["input", "change", "kp-quantity-change", "rl-rows-change"]) form.addEventListener(type, queuePaint);
  paintTimeline();
  for (const type of ["input", "change", "kp-quantity-change", "rl-rows-change"]) form.addEventListener(type, refreshTimes);
  refreshTimes();
  for (const type of ["input", "change", "kp-combobox-change", "rl-rows-change"]) form.addEventListener(type, () => setTimeout(paintUnresolved, 0));
  paintUnresolved();

  // ---- the draft: saved in the database about a second after the last change ---------------------------------------
  // Deleted on Save and on Cancel / Discard; what stays is what a closed tab or a dropped connection left.
  const DRAFT_MS = 1000;
  /** @type {number} */
  let draftTimer = 0;
  let draftChain = Promise.resolve();
  let draftGone = false;
  let opening = "";
  const writeDraft = async () => {
    if (draftGone) return;
    const now = collect(true);
    if (JSON.stringify(now) === opening) return;
    await saveDraft(draftKey, now).catch(() => {}); // a draft that cannot be saved must never get in the way of editing
  };
  const queueDraft = () => {
    clearTimeout(draftTimer);
    draftTimer = window.setTimeout(() => (draftChain = draftChain.then(writeDraft)), DRAFT_MS);
  };
  const dropDraft = async () => {
    draftGone = true;
    clearTimeout(draftTimer);
    await draftChain;
    await deleteDraft(draftKey).catch(() => {});
  };
  for (const type of ["input", "change", "click", "kp-quantity-change", "rl-rows-change", "kp-combobox-change", "rl-photos-change"]) form.addEventListener(type, queueDraft);

  const close = () => void closeDialog(dialog);
  // Leaving without saving: the photos this session sent are not wanted any more, nor is the draft.
  const leave = () => {
    void tracker.discard();
    void dropDraft();
    close();
  };
  cancel.addEventListener("click", leave);
  dialog.querySelector("[data-close]")?.addEventListener("click", leave);
  // One Escape handler per opening: an editor re-opened on a restored draft replaces the one before it.
  const again = /** @type {any} */ (dialog);
  again.__rlAbort?.abort();
  again.__rlAbort = new AbortController();
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    leave();
  }, { once: true, signal: again.__rlAbort.signal });

  /** The form as a recipe body. `forDraft` keeps imported ingredient lines the catalogue does not know yet (a Save is blocked while any is left). @param {boolean} [forDraft] */
  const collect = (forDraft = false) => {
    const choice = dishField.get();
    return recipeBody(recipe ?? preset, {
      choice,
      label: labelOf(r, /** @type {HTMLInputElement} */ (label).value, ownLabel, lang()),
      shortTyped: /** @type {HTMLInputElement} */ (short).value,
      dishName: dishText(choice ?? { id: null, name: null }),
      summary: /** @type {HTMLTextAreaElement} */ (summary).value,
      source: /** @type {HTMLInputElement} */ (source).value,
      meals: getSegmentedValues(meals),
      ing: combobox(mainBox)?.values() ?? [],
      times: timesNow(),
      portions: getQuantity(portions),
      prep: getSegmentedValues(prep)[0] ?? "light",
      safe: on(safe),
      gear: /** @type {HTMLInputElement} */ (gear).value,
      lastNote: /** @type {HTMLTextAreaElement} */ (lastNote).value,
      miniNote: /** @type {HTMLTextAreaElement} */ (miniNote).value,
      trackRows: tracks.get().map(([tk]) => tk),
      ingredientRows: /** @type {any} */ (ingredients.get()),
      toolRows: tools.get().map(([tk]) => tk),
      steps: stepList.map((e) => e.get()),
      photo: recipePhoto.get()[0] ?? null,
    }, forDraft);
  };
  /** The dish named in the first field, as the name to show. @param {{ id: string | null, name: { nl: string, en: string } | null }} choice */
  const dishText = (choice) => dishNameOf(choice, kitchenNow()?.dishes ?? [], lang());

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void runFlashButton(save, async () => {
      const body = collect();
      if (!body.dish_id && !body.new_dish) {
        dishField.input.focus();
        return { error: t("edit.needsDish"), remedy: t("edit.needsDishFix"), word: t("rec.notSaved") };
      }
      const shownName = dishText({ id: body.dish_id, name: body.new_dish });
      // Imported lines still waiting for an ingredient are never dropped silently: Save waits until each is resolved.
      const open = unresolvedLines().length;
      if (open) {
        paintUnresolved();
        unresolvedBox.scrollIntoView({ block: "center" });
        return { error: t("imp.blocked", open), remedy: t("imp.blockedFix"), word: t("rec.notSaved") };
      }
      const typedSource = /** @type {HTMLInputElement} */ (source).value.trim();
      if (typedSource && !/^https?:\/\/\S+$/i.test(typedSource)) {
        source.focus();
        return { error: t("edit.sourceBad"), remedy: t("edit.sourceBadFix"), word: t("rec.notSaved") };
      }
      try {
        if (recipe) await replace("recipes", body);
        else await create("recipes", body);
      } catch (e) {
        return { error: e instanceof ApiError ? e.message : String(e), word: t("rec.notSaved") };
      }
      await tracker.settle(photosOf(body));
      await dropDraft();
      toast(editing ? t("rec.savedName", shownName) : t("rec.addedName", shownName));
      close();
      return t("set.saved");
    });
  });

  opening = JSON.stringify(collect(true));
  if (!dialog.open) dialog.showModal();

  // An earlier session's draft is offered, not applied: Restore opens the editor again on it, Discard deletes it.
  if (!restore) {
    void readDraft(draftKey)
      .then((draft) => {
        if (!draft || draftGone || !dialog.isConnected || JSON.stringify(draft.data) === opening) return;
        const restoreButton = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--primary" }, t("edit.draftRestore"));
        const discardButton = h("button", { type: "button", class: "kp-button kp-button--sm" }, t("edit.draftDiscard"));
        offer.replaceChildren(h("div", { class: "kp-alert__body" }, h("strong", null, t("edit.draftAsk", stamp(draft.saved))), " ", t("edit.draftText")), h("div", { class: "kp-row-actions" }, restoreButton, discardButton));
        offer.hidden = false;
        restoreButton.addEventListener("click", () => {
          draftGone = true;
          clearTimeout(draftTimer);
          void tracker.discard();
          openEditor(dialog, { recipe, mainOptions, preset, copyOf, restore: draft.data });
        });
        discardButton.addEventListener("click", () => {
          offer.hidden = true;
          void deleteDraft(draftKey).catch(() => {});
        });
      })
      .catch(() => {});
  }
}
