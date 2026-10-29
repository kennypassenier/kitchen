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
import { attachComboboxes, combobox } from "/static/kp/js/combobox.js";
import { attachQuantities, getQuantity, setQuantity } from "/static/kp/js/quantity.js";
import { attachSwitches } from "/static/kp/js/forms.js";
import { attachAutosize } from "/static/kp/js/autosize.js";
import { attachFlashButtons, runFlashButton } from "/static/kp/js/flash.js";
import { closeDialog } from "/static/kp/js/motion.js";
import { toast } from "/static/kp/js/overlays.js";
import { h } from "../dom.js";
import { create, replace, kitchenNow, ApiError } from "../api.js";
import { dishPicker } from "../dishes/picker.js";
import { ingredientPicker, ingredientsPicker } from "../ingredients/picker.js";
import { photoField, photoTracker, photosOf } from "./photos.js";
import { wordsFor } from "./words.js";
import { effective } from "./schedule.js";
import { t, lang } from "../i18n/index.js";

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

let serial = 0;
/** @param {string} p */
const uid = (p) => `${p}-${++serial}`;
export const newId = () => (globalThis.crypto?.randomUUID?.() ?? `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
/** @param {string} s */
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * One row of the form grid: label, control, a hint in the value track.
 * @param {string} label @param {HTMLElement} control @param {string} [hint] @param {string} [labelId]
 */
export function row(label, control, hint = "", labelId = uid("rl-l")) {
  const first = control.querySelector("input, textarea, select, button") ?? control;
  const labelEl = control.matches("[role=radiogroup], [role=group]") || !(first instanceof HTMLElement && first.id)
    ? h("span", { class: "kp-formgrid__label", id: labelId }, label)
    : h("label", { class: "kp-formgrid__label", for: first.id, id: labelId }, label);
  if (control.matches("[role=radiogroup], [role=group]")) control.setAttribute("aria-labelledby", labelId);
  return h("div", { class: "kp-formgrid__row" }, labelEl, h("div", { class: "kp-formgrid__control" }, control), hint ? h("p", { class: "kp-formgrid__value" }, hint) : null);
}

/** @param {string} value @param {string} [type] @param {Record<string, string>} [attrs] */
export function input(value, type = "text", attrs = {}) {
  return h("input", { class: "kp-field__input", type, id: uid("rl-i"), value, ...attrs });
}

/** @param {string} value @param {number} rows */
export function area(value, rows = 3) {
  const el = h("textarea", { class: "kp-field__input kp-field__input--multiline", id: uid("rl-t"), rows, "data-kp-autosize": true });
  el.textContent = value;
  return el;
}

/** A stepper: the package's quantity. @param {number} value @param {{ min?: number, max?: number, unit?: string, one?: string, label: string }} o */
export function stepper(value, { min = 0, max = 1000, unit = "", one = "", label }) {
  return h(
    "div",
    { class: "kp-quantity", "data-kp-quantity": true, "data-kp-quantity-min": String(min), "data-kp-quantity-max": String(max), "data-kp-quantity-unit": unit, "data-kp-quantity-unit-one": one || unit, "data-kp-quantity-label": label },
    h("input", { class: "kp-quantity__input", value: String(value) }),
  );
}

/** @param {string} label @param {boolean} on */
export function toggle(label, on) {
  const box = h("input", { class: "kp-switch__input", type: "checkbox", role: "switch", id: uid("rl-s") });
  box.checked = on;
  return h("label", { class: "kp-switch" }, box, h("span", { class: "kp-switch__state", "aria-hidden": "true" }), h("span", null, label));
}

/** @param {HTMLElement} sw */
export const on = (sw) => /** @type {HTMLInputElement} */ (sw.querySelector("input")).checked;

/** A segmented control. @param {[string, string][]} items @param {string[]} values @param {"single" | "multi"} mode @param {string} label */
function segmented(items, values, mode, label) {
  return h(
    "div",
    { class: "kp-segmented kp-segmented--chips", "data-kp-segmented": mode, role: mode === "single" ? "radiogroup" : "group", "aria-label": label },
    ...items.map(([value, text]) => {
      const pressed = values.includes(value);
      return h(
        "button",
        mode === "single"
          ? { type: "button", class: "kp-segmented__item", "data-value": value, role: "radio", "aria-checked": String(pressed) }
          : { type: "button", class: "kp-segmented__item", "data-value": value, "aria-pressed": String(pressed) },
        h("span", { class: "kp-segmented__label" }, text),
      );
    }),
  );
}

/** A native select the package draws. @param {[string, string][]} options @param {string} value @param {string} label */
export function select(options, value, label) {
  const el = h("select", { class: "kp-field__input", id: uid("rl-sel"), "aria-label": label }, ...options.map(([v, t]) => h("option", { value: v }, t)));
  /** @type {HTMLSelectElement} */ (el).value = value;
  return /** @type {HTMLSelectElement} */ (el);
}

/**
 * A repeatable list on shared columns: a header line, one row per item, and an Add button that says what it adds.
 * @param {{ columns: { label: string, width: string, make: (value: any) => { el: HTMLElement, get: () => any } }[], items: any[], add: string, noun: string, blank: () => any }} spec
 */
export function rows({ columns, items, add, noun, blank }) {
  const grid = h("div", { class: "rl-rows", style: `--rl-cols: ${columns.map((c) => c.width).join(" ")} max-content` });
  const head = h("div", { class: "rl-row rl-row--head" }, ...columns.map((c) => h("span", { class: "rl-row__label" }, c.label)), h("span", { class: "kp-sr-only" }, t("photo.remove")));
  const body = h("div", { class: "rl-rows__body" });
  /** @type {{ line: HTMLElement, cells: { get: () => any }[] }[]} */
  let lines = [];
  const addButton = h("button", { type: "button", class: "kp-button kp-button--sm" }, add);
  const empty = h("p", { class: "rl-rows__empty" }, t(`edit.none.${noun}`));

  const sync = () => {
    head.hidden = lines.length === 0;
    empty.hidden = lines.length > 0;
    lines.forEach(({ line }, i) => line.querySelector(".rl-row__remove")?.setAttribute("aria-label", t(`edit.removeNoun.${noun}`, i + 1)));
  };
  /** @param {any} item */
  const push = (item) => {
    const cells = columns.map((c) => c.make(item));
    const remove = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--ghost rl-row__remove" }, t("photo.remove"));
    const line = h("div", { class: "rl-row" }, ...cells.map((c) => c.el), remove);
    const entry = { line, cells };
    remove.addEventListener("click", () => {
      lines = lines.filter((l) => l !== entry);
      line.remove();
      sync();
      grid.dispatchEvent(new CustomEvent("rl-rows-change", { bubbles: true }));
      addButton.focus();
    });
    lines.push(entry);
    body.append(line);
    sync();
    grid.dispatchEvent(new CustomEvent("rl-rows-change", { bubbles: true }));
    return line;
  };
  for (const item of items) push(item);
  addButton.addEventListener("click", () => {
    const line = push(blank());
    attachSelects(line);
    attachQuantities(line);
    attachSwitches(line);
    line.querySelector("input, textarea, select")?.focus();
  });
  grid.append(head, body, empty, h("div", { class: "rl-rows__add" }, addButton));
  sync();
  return {
    el: grid,
    get: () => lines.map((l) => l.cells.map((c) => c.get())),
    /** Add a line from outside (several ingredients picked at once). @param {any} item */
    add: (item) => {
      const line = push(item);
      attachSelects(line);
      attachQuantities(line);
      attachSwitches(line);
      return line;
    },
  };
}

/** @param {string} label @param {string} value @param {string} placeholder */
export const textCell = (label, value, placeholder = "") => {
  const el = input(value, "text", { "aria-label": label, placeholder });
  return { el, get: () => /** @type {HTMLInputElement} */ (el).value.trim() };
};

/**
 * Open the editor for a recipe, or for a new one.
 * @param {HTMLDialogElement} dialog
 * @param {{ recipe: Record<string, any> | null, mainOptions: string[], preset?: Record<string, any> }} spec
 */
export function openEditor(dialog, { recipe, mainOptions, preset = {} }) {
  const r = recipe ?? { short: "", summary: "", meals: ["dinner"], ing: [], minutes: 30, hands_on: 15, portions: 2, prep: "light", safe: false, gear: "", last_note: "", mini_note: "", tracks: [], ingredients: [], tools: [], steps: [], ...preset };
  const editing = Boolean(recipe);
  // Photos (Kenny, 24/10/2026 05:23): what this session uploads and what the recipe had, so Save and Cancel leave no stray file.
  const tracker = photoTracker(photosOf(r));
  const recipePhoto = photoField({ ids: r.photo ? [r.photo] : [], max: 1, label: t("edit.recipePhoto"), tracker });
  const heading = h("h2", { class: "kp-dialog__title", id: "rl-editor-t" }, editing ? t("rec.editTitle", r.name) : t("list.recipes.add"));

  // ---- the dish -----------------------------------------------------------------------------------------------
  // The dish the recipe belongs to (Kenny, 29/10/2026): a recipe is always in a dish, an existing one or a new one that is
  // made when the recipe is saved. Choosing another dish for an existing recipe moves it.
  const dishField = dishPicker(r.dish_id ?? preset.dish_id ?? null, { label: t("edit.dish"), id: "rl-dish" });
  const ownLabel = String(r.label?.[lang()] || r.label?.[lang() === "nl" ? "en" : "nl"] || "").trim();
  const label = input(ownLabel, "text", { autocomplete: "off", placeholder: t("edit.labelPh") });
  const short = input(r.short ?? "", "text", { autocomplete: "off" });
  const summary = area(r.summary ?? "", 3);
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
    row(t("edit.meals"), meals, t("edit.mealsHint")),
    row(t("edit.mainIng"), mainBox, t("edit.mainHint")),
    row(t("edit.photo"), recipePhoto.el, t("edit.photoHint")),
  );

  // ---- time, portions, how much preparing ---------------------------------------------------------------------
  // The two times are computed from the steps (Kenny, 29/10/2026; recipe/schedule.js) and shown live: the figure is the
  // stepper itself, unreachable until the Override switch lets a typed value win.
  const was = effective(r);
  const timeOverride = (/** @type {number | null | undefined} */ typed, /** @type {number} */ computed, /** @type {number} */ stored) => typeof typed === "number" || (computed === 0 && stored > 0);
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
      { label: t("edit.ingredient"), width: "minmax(0, 1fr)", make: (i) => { const c = ingredientPicker(i.ingredient ?? null, { label: t("edit.ingredient") }); return { el: c.el, get: () => ({ ...i, id: i.id ?? (i.id = newId()), ingredient: c.get() }) }; } },
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
  const lists = h(
    "div",
    { class: "rl-lists" },
    listBlock(t("edit.tracks"), t("edit.tracksHint"), tracks.el),
    listBlock(t("edit.ingredients"), t("edit.ingredientsHint"), h("div", { class: "rl-many" }, many.el, manyAdd), ingredients.el),
    listBlock(t("edit.tools"), t("edit.toolsHint"), tools.el),
  );

  // ---- steps ---------------------------------------------------------------------------------------------------
  // Quick-add (Kenny, 29/10/2026): one field at the top, Enter adds the step and the field is ready for the next. A step
  // is one line (number, its text, chips for what it says, Up / Down and Remove) and "More" folds out the rest.
  const trackOptions = () => /** @type {[string, string][]} */ ([["", t("edit.tracksMeet")], ...tracks.get().map(([tk]) => /** @type {[string, string]} */ ([tk.id, tk.name || t("edit.unnamedTrack")]))]);
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
    // Where it falls in time (recipe/schedule.js): both optional, the draggable timeline will set them too.
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
    const photos = photoField({ ids: s.photos ?? [], max: 8, label: t("edit.stepPhoto"), tracker });
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
      row(t("edit.photos"), photos.el, t("edit.photosHint")),
    );
    const more = h("details", { class: "rl-step__more" }, h("summary", null, t("edit.more")), h("div", { class: "rl-step__body" }, fields, h("div", { class: "rl-list" }, h("h4", { class: "kp-fw-semibold" }, t("edit.stepNeeds")), uses.el)));
    const head = h("span", { class: "rl-step__n" });
    const chips = h("div", { class: "rl-step__chips" });
    const up = h("button", { type: "button", class: "kp-button kp-button--sm" }, t("edit.moveUp"));
    const down = h("button", { type: "button", class: "kp-button kp-button--sm" }, t("edit.moveDown"));
    const del = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--ghost" }, t("edit.removeStep"));
    const el = h("li", { class: "rl-step", role: "group" }, head, text, h("div", { class: "rl-step__buttons" }, up, down, del), chips, more);
    const secs = () => Number(/** @type {HTMLInputElement} */ (timerSecs).value);
    const entry = {
      el,
      id: String(s.id),
      track,
      partner,
      text,
      head,
      up,
      down,
      del,
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
        const opts = [["", t("edit.withNone")], ...stepList.filter((e) => e.id !== entry.id).map((e) => /** @type {[string, string]} */ ([e.id, `${stepList.indexOf(e) + 1}. ${/** @type {HTMLTextAreaElement} */ (e.text).value.trim().slice(0, 40) || t("edit.unnamedStep")}`]))];
        partner.replaceChildren(...opts.map(([v, label]) => h("option", { value: v }, label)));
        partner.value = opts.some(([v]) => v === keep) ? keep : "";
      },
      get: () => {
        const tn = /** @type {HTMLInputElement} */ (timerName).value.trim();
        const typedStart = /** @type {HTMLInputElement} */ (start).value;
        return {
          id: entry.id,
          track: track.value || null,
          text: /** @type {HTMLTextAreaElement} */ (text).value.trim(),
          say: /** @type {HTMLInputElement} */ (say).value.trim(),
          mins: getQuantity(mins),
          active: on(active),
          timer: on(hasTimer) && secs() > 0 ? { seconds: secs(), name: tn || t("edit.timerDefault") } : null,
          uses: uses.get().map(([amount, what]) => ({ amount, name: what })).filter((u) => u.amount || u.name),
          note: /** @type {HTMLInputElement} */ (note).value.trim(),
          note_tone: on(warn) ? "warning" : "",
          mini: on(mini),
          photos: photos.get(),
          // Where the step falls in time (Kenny, 29/10/2026): recipe/schedule.js.
          start: typedStart === "" ? null : Math.max(0, Number(typedStart)),
          with: partner.value || null,
        };
      },
    };
    return entry;
  }
  const renumber = () => {
    stepsEmpty.hidden = stepList.length > 0;
    stepList.forEach((e, i) => {
      e.head.textContent = String(i + 1);
      e.el.setAttribute("aria-label", t("edit.stepN", i + 1));
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
  /** The two times from the steps as they stand, and what is stored: a typed override wins. */
  const timesNow = () => {
    const steps = stepList.map((e) => e.get()).filter((x) => x.text);
    const typed = (/** @type {HTMLElement} */ sw, /** @type {HTMLElement} */ q) => (on(sw) ? getQuantity(q) : null);
    return effective(r, { steps, tracks: tracks.get().map(([tk]) => tk).filter((tk) => tk.name), minutes_override: typed(minutesOver, minutes), hands_on_override: typed(handsOver, hands) });
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
    sec(t("edit.secSteps"), t("edit.secStepsText"), stepsSection),
  );
  const line = h("p", { class: "rl-editor__line", role: "status" });
  dialog.replaceChildren(
    h(
      "header",
      { class: "kp-drawer__head" },
      heading,
      h("button", { type: "button", class: "kp-icon-button kp-dialog__close", "aria-label": t("edit.close"), "data-close": true }, "✕"),
      h("p", { class: "kp-drawer__desc" }, editing ? t("rec.editText") : t("rec.addText")),
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
  for (const type of ["input", "change", "kp-quantity-change", "rl-rows-change"]) form.addEventListener(type, refreshTimes);
  refreshTimes();

  const close = () => void closeDialog(dialog);
  // Leaving without saving: the photos this session sent are not wanted any more.
  const leave = () => {
    void tracker.discard();
    close();
  };
  cancel.addEventListener("click", leave);
  dialog.querySelector("[data-close]")?.addEventListener("click", leave);
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    leave();
  }, { once: true });

  /** A step that runs alongside a step that is gone (or itself) runs on its own. @param {Record<string, any>[]} list */
  const tidyWith = (list) => list.map((s) => (s.with && s.with !== s.id && list.some((x) => x.id === s.with) ? s : { ...s, with: null }));
  /** The recipe's label from the field: both halves or none (the server refuses one half). */
  const labelOut = () => {
    const typed = /** @type {HTMLInputElement} */ (label).value.trim();
    const old = { nl: String(r.label?.nl ?? ""), en: String(r.label?.en ?? "") };
    if (typed === ownLabel) return old;
    if (!typed) return { nl: "", en: "" };
    const other = lang() === "nl" ? "en" : "nl";
    return { ...old, [lang()]: typed, [other]: old[other].trim() || typed };
  };
  /** The dish named in the first field, as the name to show: an existing dish's, or the new one's. @param {{ id: string | null, name: { nl: string, en: string } | null }} choice */
  const dishText = (choice) => {
    const d = choice.id ? kitchenNow()?.dishes.find((x) => x.id === choice.id) : null;
    return String(d?.name?.[lang()] || d?.name?.[lang() === "nl" ? "en" : "nl"] || choice.name?.[lang()] || "").trim();
  };
  const collect = () => {
    const choice = dishField.get();
    const shortValue = /** @type {HTMLInputElement} */ (short).value.trim();
    return {
      // A new recipe carries its preset along; `dish_id` puts it into that dish (Kenny, 24/10/2026 09:27), `new_dish`
      // makes a dish with it, and choosing another dish for an existing recipe moves it (api.js).
      ...(recipe ?? preset),
      dish_id: choice?.id ?? null,
      new_dish: choice?.name ?? null,
      label: labelOut(),
      short: shortValue || dishText(choice ?? { id: null, name: null }).split(/\s+/)[0] || "",
      summary: /** @type {HTMLTextAreaElement} */ (summary).value.trim(),
      meals: getSegmentedValues(meals),
      ing: combobox(mainBox)?.values() ?? [],
      ...(() => {
        // The two times as they are stored (Kenny, 29/10/2026): the computed figure, or the typed one when Override is on;
        // `minutes` and `hands_on` always hold the effective value so every reader keeps working.
        const now = timesNow();
        return { minutes: now.minutes, hands_on: now.hands_on, minutes_override: now.minutes_override, hands_on_override: now.hands_on_override };
      })(),
      portions: getQuantity(portions),
      prep: getSegmentedValues(prep)[0] ?? "light",
      safe: on(safe),
      gear: /** @type {HTMLInputElement} */ (gear).value.trim(),
      last_note: /** @type {HTMLTextAreaElement} */ (lastNote).value.trim(),
      mini_note: /** @type {HTMLTextAreaElement} */ (miniNote).value.trim(),
      tracks: tracks.get().map(([tk]) => tk).filter((tk) => tk.name),
      ingredients: ingredients.get().map(([n, amount, unit, group]) => ({ ...n, amount, unit, group })).filter((i) => i.ingredient),
      tools: tools.get().map(([tk]) => tk).filter((tk) => tk.name),
      steps: tidyWith(stepList.map((e) => e.get()).filter((s) => s.text)),
      photo: recipePhoto.get()[0] ?? null,
    };
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void runFlashButton(save, async () => {
      const body = collect();
      if (!body.dish_id && !body.new_dish) {
        dishField.input.focus();
        return { error: t("edit.needsDish"), remedy: t("edit.needsDishFix"), word: t("rec.notSaved") };
      }
      const shownName = dishText({ id: body.dish_id, name: body.new_dish });
      try {
        if (recipe) await replace("recipes", body);
        else await create("recipes", body);
      } catch (e) {
        return { error: e instanceof ApiError ? e.message : String(e), word: t("rec.notSaved") };
      }
      await tracker.settle(photosOf(body));
      toast(editing ? t("rec.savedName", shownName) : t("rec.addedName", shownName));
      close();
      return t("set.saved");
    });
  });

  dialog.showModal();
}
