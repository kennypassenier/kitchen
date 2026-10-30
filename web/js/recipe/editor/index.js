// The recipe editor: a drawer with every field of a recipe on `.kp-formgrid`.
//
// Choices are chips, segmented controls and switches wherever the set is
// known (meals, prep, tracks, units); numbers are the package's stepper;
// the repeatable lists (tracks, ingredients, tools, steps, what a step uses)
// are rows on shared columns, each with its own Add and Remove buttons.
// The form reads itself back into a recipe on Save. The small form helpers
// are exported for the dish editor (js/dishes/editor.js), which uses the same
// drawer and grid.
//
// Split on 30/10/2026 (docs/agent/MODULARITY.md): this file opens the drawer and joins the parts; each part is a function
// that builds its fields and hands them back (details, times, lists, steps, timeline), with the pure logic in logic.js.

import { attachSequencers } from "/static/kp/js/sequencer.js";
import { closeDialog } from "/static/kp/js/motion.js";
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
import { createCollector, wireSubmit } from "./save.js";

export { newId } from "./ids.js";

/** A titled section of the form. @param {string} title @param {string} text @param {...HTMLElement} body */
const sec = (title, text, ...body) => h("section", { class: "rl-formsec" }, h("h3", { class: "kp-fw-semibold" }, title), h("p", { class: "rl-formsec__text" }, text), ...body);

/** The recipe as the form starts: the saved one, or a blank one with the preset, with a restored draft over it. @param {Record<string, any> | null} recipe @param {Record<string, any>} preset @param {Record<string, any> | null} restore */
function startOf(recipe, preset, restore) {
  const base = recipe ?? { short: "", summary: "", meals: ["dinner"], ing: [], minutes: 0, hands_on: 0, portions: 2, prep: "light", safe: false, gear: "", last_note: "", mini_note: "", tracks: [], ingredients: [], tools: [], steps: [], ...preset };
  return restore ? { ...base, ...restore } : base;
}

/** Every part of the form, built from the recipe. @param {Record<string, any> | null} recipe @param {Record<string, any>} r @param {{ preset: Record<string, any>, restore: Record<string, any> | null, mainOptions: string[] }} o */
function buildParts(recipe, r, { preset, restore, mainOptions }) {
  // The draft's key: the recipe's id, or `new:<dish id>` for a new one.
  const draftKey = recipe ? String(recipe.id) : `new:${preset.dish_id ?? ""}`;
  // Photos (Kenny, 24/10/2026 05:23): what this session uploads and what the recipe had, so Save and Cancel leave no stray file.
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

/** The drawer's head, the form with its six sections, and the foot. @param {HTMLDialogElement} dialog @param {ReturnType<typeof buildParts>} p @param {Record<string, any>} r @param {{ editing: boolean, copyOf: string, imported: boolean, cover: string | null }} o */
function fillDrawer(dialog, p, r, { editing, copyOf, imported, cover }) {
  const { details, times, notes, lists, timeline, steps, tracker } = p;
  const heading = h("h2", { class: "kp-dialog__title", id: "rl-editor-t" }, editing ? t("rec.editTitle", r.name) : copyOf ? t("edit.copyTitle", copyOf) : imported ? t("imp.previewTitle") : t("list.recipes.add"));
  const save = h("button", { type: "submit", class: "kp-button kp-button--primary", "data-kp-flash-button": true, "data-kp-flash-words": t("set.saved"), form: "rl-editor-form" }, editing ? t("edit.saveRecipe") : t("list.recipes.addSave"));
  const cancel = h("button", { type: "button", class: "kp-button" }, t("common.cancel"));
  const form = /** @type {HTMLFormElement} */ (
    h(
      "form",
      { class: "kp-drawer__body rl-form", id: "rl-editor-form", novalidate: true },
      sec(t("edit.secDish"), t("edit.secDishText"), details.el),
      sec(t("edit.secTime"), t("edit.secTimeText"), times.el),
      sec(t("edit.secNotes"), t("edit.secNotesText"), notes.el),
      sec(t("edit.secLists"), t("edit.secListsText"), lists.el),
      sec(t("edit.secTimeline"), t("edit.secTimelineText"), timeline.host),
      sec(t("edit.secSteps"), t("edit.secStepsText"), steps.el),
    )
  );
  const line = h("p", { class: "rl-editor__line", role: "status" });
  // The cover offer of an import: nothing is loaded from the page's site until Yes (recipe/cover.js).
  if (cover) form.prepend(coverCard({ url: cover, picked: (id) => { tracker.uploaded(id); details.recipePhoto.set([id]); } }));
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
  return { form, save, cancel, offer };
}

/** Cancel, the close button and Escape leave without saving: the photos this session sent are not wanted any more, nor is the draft. @param {HTMLDialogElement} dialog @param {ReturnType<typeof buildParts>} p @param {HTMLElement} cancel */
function wireLeaving(dialog, { tracker, draft }, cancel) {
  const close = () => void closeDialog(dialog);
  const leave = () => {
    void tracker.discard();
    void draft.drop();
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
  return close;
}

/**
 * Open the editor for a recipe, or for a new one. `restore` is a draft's form state (Kenny, 29/10/2026): the editor then
 * opens with it instead of the saved recipe.
 * @param {HTMLDialogElement} dialog
 * @param {{ recipe: Record<string, any> | null, mainOptions: string[], preset?: Record<string, any>, restore?: Record<string, any> | null, copyOf?: string, imported?: boolean, cover?: string | null }} spec `copyOf` names the recipe the form is a copy of (recipe/duplicate.js); `imported` makes it the preview of an import (recipe/import.js) and `cover` is the picture address the page offered (recipe/cover.js)
 */
export function openEditor(dialog, { recipe, mainOptions, preset = {}, restore = null, copyOf = "", imported = false, cover = null }) {
  const r = startOf(recipe, preset, restore);
  const editing = Boolean(recipe);
  const p = buildParts(recipe, r, { preset, restore, mainOptions });
  const { form, save, cancel, offer } = fillDrawer(dialog, p, r, { editing, copyOf, imported, cover });
  attachControls(dialog);
  // The timeline: one sequencer per opening, detached when the drawer closes or is opened again on a restored draft.
  /** @type {any} */ (dialog).__rlSeq?.();
  const detachSeq = attachSequencers(form);
  /** @type {any} */ (dialog).__rlSeq = detachSeq;
  dialog.addEventListener("close", detachSeq, { once: true });
  wireForm({ form, steps: p.steps, timeline: p.timeline, times: p.times, lists: p.lists });
  watchDraft(form, p.draft);
  const close = wireLeaving(dialog, p, cancel);
  wireSubmit({ form, save, recipe, editing, collector: p.collector, details: p.details, lists: p.lists, tracker: p.tracker, draft: p.draft, close });
  p.draft.setOpening(JSON.stringify(p.collector.collect(true)));
  if (!dialog.open) dialog.showModal();
  if (!restore) {
    offerEarlierDraft({
      draftKey: p.draftKey,
      draft: p.draft,
      offer,
      dialog,
      restoreWith: (data) => {
        void p.tracker.discard();
        openEditor(dialog, { recipe, mainOptions, preset, copyOf, restore: data });
      },
    });
  }
}
