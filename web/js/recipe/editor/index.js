// The recipe editor: the form of the editor page (pages/recipe-edit/) with every field of a recipe on `.kp-formgrid`.
//
// Choices are chips, segmented controls and switches wherever the set is known (meals, prep, tracks, units); numbers are the
// package's stepper; the repeatable lists (tracks, ingredients, tools, steps, what a step uses) are rows on shared columns,
// each with its own Add and Remove buttons. The form reads itself back into a recipe on Save. The small form helpers are
// exported for the dish editor (js/dishes/editor.js), which uses the same drawer and grid.
//
// Split on 30/10/2026 (docs/agent/MODULARITY.md): this file joins the parts; each part is a function that builds its fields
// and hands them back (details, times, lists, steps, timeline), with the pure logic in logic.js. Since 01/11/2026 the editor
// is a page, not a drawer: `createEditor` builds the form, the page puts it in the document and calls `start()`.

import { attachSequencers } from "/static/kp/dist/js/sequencer.js";
import { h } from "../../dom.js";
import { t } from "../../i18n/index.js";
import { photoTracker, photosOf } from "../photos.js";
import { coverCard } from "../cover.js";
import { detailFields, noteFields } from "./details.js";
import { timeFields } from "./times.js";
import { listFields } from "./lists.js";
import { stepFields } from "./steps.js";
import { timelineFields } from "./timeline.js";
import { attachControls } from "./controls.js";
import { wireForm } from "./wiring.js";
import { createDraft, watchDraft, offerEarlierDraft } from "./draft.js";
import { createCollector, createSaver } from "./save.js";
import { isChanged } from "./leave.js";
import { SECTIONS, changedSections } from "./sections.js";
import { newKey } from "../draft-keys.js";

export { newId } from "./ids.js";

/** The events after which the page asks what changed (the same set the draft listens to, minus the raw clicks). */
export const FORM_EVENTS = ["input", "change", "kp-quantity-change", "rl-rows-change", "kp-combobox-change", "rl-photos-change"];

/** The recipe as the form starts: the saved one, or a blank one with the preset, with a restored draft over it. @param {Record<string, any> | null} recipe @param {Record<string, any>} preset @param {Record<string, any> | null} restore */
function startOf(recipe, preset, restore) {
  const base = recipe ?? { short: "", summary: "", meals: ["dinner"], ing: [], minutes: 0, hands_on: 0, portions: 2, prep: "light", safe: false, gear: "", last_note: "", mini_note: "", tracks: [], ingredients: [], tools: [], steps: [], ...preset };
  return restore ? { ...base, ...restore } : base;
}

/** Every part of the form, built from the recipe. @param {Record<string, any> | null} recipe @param {Record<string, any>} r @param {{ preset: Record<string, any>, restore: Record<string, any> | null, mainOptions: string[], key: string }} o */
function buildParts(recipe, r, { preset, restore, mainOptions, key }) {
  // The draft's key (recipe/draft-keys.js): the one given (an import's or a copy's own, or a restored draft's), else the
  // recipe's id, else `new:<dish id>` for a blank new one.
  const draftKey = key || (recipe ? String(recipe.id) : newKey(preset.dish_id));
  // Photos (Kenny, 24/10/2026 05:23): what this session uploads and what the recipe had, so Save and Discard leave no stray file.
  const tracker = photoTracker(photosOf(recipe));
  // A restored draft's photos were sent by an earlier session: this one answers for them now.
  if (restore) for (const id of photosOf(restore)) if (!photosOf(recipe).includes(id)) tracker.uploaded(id);
  const details = detailFields({ r, preset, restore, mainOptions, tracker });
  const lists = listFields(r);
  const steps = stepFields({ r, tracks: lists.tracks, tracker });
  const times = timeFields(r, { steps: steps.liveSteps, trackList: () => lists.tracks.get().map(([tk]) => tk) });
  const notes = noteFields(r);
  const timeline = timelineFields({ tracks: lists.tracks, steps });
  const collector = createCollector({ recipe, preset, r, details, notes, times, lists, steps });
  const draft = createDraft({ draftKey, collect: collector.collect });
  return { draftKey, tracker, details, lists, steps, times, notes, timeline, collector, draft };
}

/** A titled section of the form; the unsaved bar lists it as one row. @param {typeof SECTIONS[number]} def @param {...HTMLElement} body */
const sec = (def, ...body) => h("section", { class: "rl-formsec", id: def.id, "data-kp-row": true, "data-kp-name": t(def.title) }, h("h3", { class: "kp-fw-semibold" }, t(def.title)), h("p", { class: "rl-formsec__text" }, t(def.text)), ...body);

/**
 * Build the editor's form for a recipe, or a new one. `restore` is a draft's form state (Kenny, 29/10/2026). Nothing is wired
 * until the page has put `form` in the document and called `start()`.
 * @param {{ recipe: Record<string, any> | null, mainOptions: string[], preset?: Record<string, any>, restore?: Record<string, any> | null, copyOf?: string, imported?: boolean, cover?: string | null, draftKey?: string, compare?: Record<string, any> | null, restoreWith?: (data: Record<string, any>, key: string) => void }} spec `copyOf` names the recipe the form is a copy of (recipe/duplicate.js); `imported` makes it the preview of an import (recipe/import.js) and `cover` is the picture address the page offered (recipe/cover.js); `draftKey` is the key its draft is kept under when it is not the default (recipe/draft-keys.js); `restoreWith` is called with an earlier draft's data and key when its Restore is pressed; `compare` is what a restored draft is compared with (the form the editor it replaces opened with, fix-change-count-1)
 */
export function createEditor({ recipe, mainOptions, preset = {}, restore = null, copyOf = "", imported = false, cover = null, draftKey = "", compare = null, restoreWith = () => {} }) {
  const r = startOf(recipe, preset, restore);
  const p = buildParts(recipe, r, { preset, restore, mainOptions, key: draftKey });
  const { details, times, notes, lists, timeline, steps, tracker, collector, draft } = p;
  const body = /** @type {Record<string, HTMLElement>} */ ({ dish: details.el, time: times.el, notes: notes.el, lists: lists.el, timeline: timeline.host, steps: steps.el });
  // The draft offer (Kenny, 29/10/2026): a draft saved by an earlier session is offered above the form.
  const offer = h("div", { class: "kp-alert kp-alert--info rl-draft", role: "status", hidden: true });
  const form = /** @type {HTMLFormElement} */ (h("form", { class: "rl-form", id: "rl-editor-form", novalidate: true }, offer, ...SECTIONS.map((def) => sec(def, body[def.key]))));
  // The cover offer of an import: nothing is loaded from the page's site until Yes (recipe/cover.js).
  if (cover) offer.after(coverCard({ url: cover, picked: (id) => { tracker.uploaded(id); details.recipePhoto.set([id]); } }));
  // What the sections are compared with, set at start(): the saved form, how it opened, or a restore's `compare`.
  /** @type {Record<string, any> | null} */
  let baseline = null;
  // Not saved yet and new work from the start: a copy, an import, or a restored draft of a new recipe.
  const unsaved = !recipe && Boolean(restore || imported || copyOf);
  /** @type {() => void} */
  let detachSeq = () => {};
  const saver = createSaver({ recipe, collector, details, lists, tracker, draft });
  return {
    form,
    parts: p,
    /** Wire the form once it is in the document. */
    start() {
      attachControls(form);
      detachSeq = attachSequencers(form);
      wireForm({ form, steps, timeline, times, lists });
      watchDraft(form, draft);
      draft.setOpening(JSON.stringify(collector.collect(true)));
      // A restored draft of a saved recipe is compared with the saved recipe; anything else with how it opened. A copy, an
      // import or a restored new draft is unsaved work all the same (`unsaved`), but claims only what differs.
      baseline = compare ?? collector.collect(true);
      if (restore) return;
      offerEarlierDraft({ draftKey: p.draftKey, dishId: preset.dish_id ?? null, draft, offer, host: form, restoreWith: (data, key) => { void tracker.discard(); restoreWith(data, key); } });
    },
    save: saver,
    /** The sections whose fields differ from how the form opened. */
    changed: () => changedSections(baseline, collector.collect(true), { isNew: !recipe, unsaved }),
    /** The form this editor compares with: a restore that replaces it compares with the same. */
    get baseline() {
      return baseline;
    },
    /** Whether the form differs from how it opened (a copy or an import always does until it is saved). */
    dirty: () => unsaved || isChanged(baseline ? JSON.stringify(baseline) : "", JSON.stringify(collector.collect(true))),
    /** Stop everything this editor wired. `keep`: write the draft once more first, so nothing typed is lost. @param {{ keep?: boolean }} [o] */
    dispose({ keep = false } = {}) {
      timeline.stop();
      detachSeq();
      if (keep) void draft.flush(true).catch((e) => console.error("keeping the draft", e)).finally(draft.abandon);
      else draft.abandon();
    },
  };
}
