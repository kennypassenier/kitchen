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
import { attachQuantities, getQuantity } from "/static/kp/js/quantity.js";
import { attachSwitches } from "/static/kp/js/forms.js";
import { attachAutosize } from "/static/kp/js/autosize.js";
import { attachFlashButtons, runFlashButton } from "/static/kp/js/flash.js";
import { closeDialog } from "/static/kp/js/motion.js";
import { toast } from "/static/kp/js/overlays.js";
import { h } from "../dom.js";
import { create, replace, ApiError } from "../api.js";

/** Meals and preparation, as the data names them. */
const MEALS = [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"]];
const PREP = [["none", "None"], ["light", "Light"], ["full", "Full"]];
/** Main ingredients the wheel knows; any other already in the kitchen is added to the list. */
const MAIN = ["chicken", "beef", "pork", "fish", "egg", "cheese", "tomato", "potato", "vegetables", "pasta", "rice"];
const UNITS = ["g", "ml", "pc", "tbsp", "tsp", "pinch", "clove", "slice", "handful"];
const GROUPS = ["Ingredients", "From the cupboard"];

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
function area(value, rows = 3) {
  const el = h("textarea", { class: "kp-field__input kp-field__input--multiline", id: uid("rl-t"), rows, "data-kp-autosize": true });
  el.textContent = value;
  return el;
}

/** A stepper: the package's quantity. @param {number} value @param {{ min?: number, max?: number, unit?: string, one?: string, label: string }} o */
function stepper(value, { min = 0, max = 1000, unit = "", one = "", label }) {
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
  const head = h("div", { class: "rl-row rl-row--head" }, ...columns.map((c) => h("span", { class: "rl-row__label" }, c.label)), h("span", { class: "kp-sr-only" }, "Remove"));
  const body = h("div", { class: "rl-rows__body" });
  /** @type {{ line: HTMLElement, cells: { get: () => any }[] }[]} */
  let lines = [];
  const addButton = h("button", { type: "button", class: "kp-button kp-button--sm" }, add);
  const empty = h("p", { class: "rl-rows__empty" }, `No ${noun}s yet.`);

  const sync = () => {
    head.hidden = lines.length === 0;
    empty.hidden = lines.length > 0;
    lines.forEach(({ line }, i) => line.querySelector(".rl-row__remove")?.setAttribute("aria-label", `Remove ${noun} ${i + 1}`));
  };
  /** @param {any} item */
  const push = (item) => {
    const cells = columns.map((c) => c.make(item));
    const remove = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--ghost rl-row__remove" }, "Remove");
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
  return { el: grid, get: () => lines.map((l) => l.cells.map((c) => c.get())) };
}

/** @param {string} label @param {string} value @param {string} placeholder */
export const textCell = (label, value, placeholder = "") => {
  const el = input(value, "text", { "aria-label": label, placeholder });
  return { el, get: () => /** @type {HTMLInputElement} */ (el).value.trim() };
};

/**
 * Open the editor for a recipe, or for a new one.
 * @param {HTMLDialogElement} dialog
 * @param {{ recipe: Record<string, any> | null, mainOptions: string[] }} spec
 */
export function openEditor(dialog, { recipe, mainOptions }) {
  const r = recipe ?? { name: "", short: "", summary: "", meals: ["dinner"], ing: [], minutes: 30, hands_on: 15, portions: 2, prep: "light", safe: false, gear: "", last_note: "", mini_note: "", tracks: [], ingredients: [], tools: [], steps: [] };
  const editing = Boolean(recipe);
  const heading = h("h2", { class: "kp-dialog__title", id: "rl-editor-t" }, editing ? `Edit ${r.name}` : "Add a recipe");

  // ---- the dish -----------------------------------------------------------------------------------------------
  const name = input(r.name, "text", { required: "", autocomplete: "off" });
  const short = input(r.short ?? "", "text", { autocomplete: "off" });
  const summary = area(r.summary ?? "", 3);
  const meals = segmented(MEALS, r.meals ?? [], "multi", "Meals");
  const mainSet = [...new Set([...MAIN, ...mainOptions, ...(r.ing ?? [])])].sort();
  const mainBox = h(
    "div",
    { class: "kp-combobox", "data-kp-combobox": true, "data-kp-tags": true, "data-kp-creatable": true },
    h("ul", { class: "kp-tag-list", "data-kp-tag-list": true }, ...(r.ing ?? []).map((/** @type {string} */ t) => h("li", { class: "kp-tag", "data-value": t }, t, h("button", { type: "button", class: "kp-tag__remove", "data-kp-tag-remove": true, "aria-label": `Remove ${t}` }, "×")))),
    h("input", { class: "kp-combobox__input", id: "rl-main", type: "text", role: "combobox", autocomplete: "off", "aria-expanded": "false", "aria-controls": "rl-main-list", "aria-label": "Main ingredients" }),
    h("ul", { class: "kp-combobox__list", id: "rl-main-list", role: "listbox", hidden: true }, ...mainSet.map((t) => h("li", { class: "kp-combobox__option", role: "option", "data-kp-option": true, "data-value": t }, cap(t)))),
    h("p", { class: "kp-combobox__status", "data-kp-combobox-status": true, role: "status", "aria-live": "polite" }),
  );
  const dish = h(
    "div",
    { class: "kp-formgrid" },
    row("Name", name, "The full name, as the recipe page shows it."),
    row("Short name", short, "The label on the wheel's slice."),
    row("Summary", summary, "A few sentences under the title."),
    row("Meals", meals, "Where the wheel may pick it."),
    row("Main ingredients", mainBox, "What the wheel filters on."),
  );

  // ---- time, portions, how much preparing ---------------------------------------------------------------------
  const minutes = stepper(r.minutes ?? 0, { max: 1440, unit: "min", label: "Total minutes" });
  const hands = stepper(r.hands_on ?? 0, { max: 1440, unit: "min", label: "Hands-on minutes" });
  const portions = stepper(r.portions ?? 2, { min: 1, max: 24, unit: "portions", one: "portion", label: "Portions" });
  const prep = segmented(PREP, [r.prep ?? "light"], "single", "Preparing");
  const safe = toggle("A safe favourite for bad days", Boolean(r.safe));
  const gear = input(r.gear ?? "", "text", { placeholder: "1 pot, the oven" });
  const facts = h(
    "div",
    { class: "kp-formgrid" },
    row("Total time", minutes, "Start to plate."),
    row("Hands-on time", hands, "Minutes of real work."),
    row("Portions", portions, "The amounts below make this many."),
    row("Preparing", prep, "None is a bad-day dish."),
    row("Safe favourite", safe, "The bad-days page offers it."),
    row("Gear", gear, "What it dirties."),
  );

  // ---- notes ---------------------------------------------------------------------------------------------------
  const lastNote = area(r.last_note ?? "", 2);
  const miniNote = area(r.mini_note ?? "", 2);
  const notes = h("div", { class: "kp-formgrid" }, row("Last time", lastNote, "Shown on the recipe page."), row("Mini version", miniNote, "What the bad-day version leaves out."));

  // ---- tracks, ingredients, tools ------------------------------------------------------------------------------
  const tracks = rows({
    columns: [{ label: "Track name", width: "minmax(0, 1fr)", make: (t) => { const c = textCell("Track name", t.name ?? "", "Pasta"); return { el: c.el, get: () => ({ id: t.id ?? (t.id = newId()), name: c.get() }) }; } }],
    items: r.tracks ?? [], add: "Add a track", noun: "track", blank: () => ({ name: "" }),
  });
  const ingredients = rows({
    columns: [
      { label: "Ingredient", width: "minmax(0, 1fr)", make: (i) => { const c = textCell("Ingredient name", i.name ?? "", "spaghetti"); return { el: c.el, get: () => ({ id: i.id ?? (i.id = newId()), name: c.get() }) }; } },
      { label: "Amount", width: "6rem", make: (i) => { const el = input(i.amount ?? "", "number", { "aria-label": "Amount", step: "any", min: "0", inputmode: "decimal" }); return { el, get: () => (/** @type {HTMLInputElement} */ (el).value === "" ? null : Number(/** @type {HTMLInputElement} */ (el).value)) }; } },
      { label: "Unit", width: "8rem", make: (i) => { const el = select([...new Set([...UNITS, i.unit].filter(Boolean))].map((u) => [u, u]), i.unit ?? "g", "Unit"); return { el, get: () => el.value }; } },
      { label: "List", width: "14rem", make: (i) => { const el = select([...new Set([...GROUPS, ...(r.ingredients ?? []).map((/** @type {any} */ x) => x.group), i.group].filter(Boolean))].map((g) => [g, g]), i.group ?? GROUPS[0], "Which list it is on"); return { el, get: () => el.value }; } },
    ],
    items: r.ingredients ?? [], add: "Add an ingredient", noun: "ingredient", blank: () => ({ name: "", amount: null, unit: "g", group: GROUPS[0] }),
  });
  const tools = rows({
    columns: [{ label: "Tool", width: "minmax(0, 1fr)", make: (t) => { const c = textCell("Tool name", t.name ?? "", "big pot"); return { el: c.el, get: () => ({ id: t.id ?? (t.id = newId()), name: c.get() }) }; } }],
    items: r.tools ?? [], add: "Add a tool", noun: "tool", blank: () => ({ name: "" }),
  });
  /** A repeatable list under its own small heading and sentence. @param {string} title @param {string} text @param {HTMLElement} el */
  const listBlock = (title, text, el) => h("div", { class: "rl-list" }, h("h4", { class: "kp-fw-semibold" }, title), h("p", { class: "rl-formsec__text" }, text), el);
  const lists = h(
    "div",
    { class: "rl-lists" },
    listBlock("Tracks", "Parallel parts of a dish; leave empty for one track.", tracks.el),
    listBlock("Ingredients", "Amounts scale with the portions.", ingredients.el),
    listBlock("Tools", "Gathered before cooking.", tools.el),
  );

  // ---- steps ---------------------------------------------------------------------------------------------------
  const trackOptions = () => /** @type {[string, string][]} */ ([["", "Where the tracks meet"], ...tracks.get().map(([t]) => /** @type {[string, string]} */ ([t.id, t.name || "Unnamed track"]))]);
  /** @type {{ el: HTMLElement, get: () => any, track: HTMLSelectElement }[]} */
  let stepList = [];
  const stepsBox = h("div", { class: "rl-steps" });
  const stepsEmpty = h("p", { class: "rl-rows__empty" }, "No steps yet.");

  /** @param {Record<string, any>} s */
  function stepEditor(s) {
    const text = area(s.text ?? "", 2);
    const say = input(s.say ?? "", "text", { placeholder: "put the pasta water on" });
    const track = select(trackOptions(), s.track ?? "", "Track");
    const mins = stepper(s.mins ?? 0, { max: 1440, unit: "min", label: "Minutes" });
    const active = toggle("Stretched by a slow-day pace", s.active !== false);
    const mini = toggle("Kept in the mini version", s.mini !== false);
    const hasTimer = toggle("Starts a timer", Boolean(s.timer));
    const timerName = input(s.timer?.name ?? "", "text", { "aria-label": "Timer name", placeholder: "Water" });
    const timerSecs = input(s.timer?.seconds ?? "", "number", { "aria-label": "Timer seconds", min: "1", step: "1", placeholder: "600" });
    const note = input(s.note ?? "", "text", { placeholder: "A line under the step" });
    const warn = toggle("Show the note as a warning", s.note_tone === "warning");
    const uses = rows({
      columns: [
        { label: "Amount", width: "7rem", make: (u) => { const c = textCell("Amount as written", u.amount ?? "", "400 g"); return c; } },
        { label: "What", width: "minmax(0, 1fr)", make: (u) => textCell("What it is", u.name ?? "", "water") },
      ],
      items: s.uses ?? [], add: "Add something this step needs", noun: "item", blank: () => ({ amount: "", name: "" }),
    });
    const timerRow = h("div", { class: "rl-pair" }, timerName, timerSecs);
    const fields = h(
      "div",
      { class: "kp-formgrid" },
      row("Instruction", text, "One action."),
      row("Say it as", say, "Lower case, for the timing sentences."),
      row("Track", track, "Which part of the dish it belongs to."),
      row("Minutes", mins, "How long the step takes."),
      row("Hands-on", active, "A walk-away step is never stretched."),
      row("Timer", hasTimer, "Name and seconds below."),
      row("Timer name and seconds", timerRow, ""),
      row("Note", note, ""),
      row("Warning", warn, ""),
      row("Mini", mini, ""),
    );
    const form = h("div", { class: "rl-step__body" }, fields, h("div", { class: "rl-list" }, h("h4", { class: "kp-fw-semibold" }, "What this step needs"), uses.el));
    const head = h("h3", { class: "kp-fw-semibold" });
    const up = h("button", { type: "button", class: "kp-button kp-button--sm" }, "Move up");
    const down = h("button", { type: "button", class: "kp-button kp-button--sm" }, "Move down");
    const del = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--ghost" }, "Remove step");
    const el = h("fieldset", { class: "rl-step" }, h("div", { class: "rl-step__head" }, head, h("div", { class: "rl-step__buttons" }, up, down, del)), form);
    const entry = {
      el,
      track,
      head,
      up,
      down,
      get: () => {
        const secs = Number(/** @type {HTMLInputElement} */ (timerSecs).value);
        const tn = /** @type {HTMLInputElement} */ (timerName).value.trim();
        return {
          id: s.id ?? (s.id = newId()),
          track: track.value || null,
          text: /** @type {HTMLTextAreaElement} */ (text).value.trim(),
          say: /** @type {HTMLInputElement} */ (say).value.trim(),
          mins: getQuantity(mins),
          active: on(active),
          timer: on(hasTimer) && secs > 0 ? { seconds: secs, name: tn || "Timer" } : null,
          uses: uses.get().map(([amount, what]) => ({ amount, name: what })).filter((u) => u.amount || u.name),
          note: /** @type {HTMLInputElement} */ (note).value.trim(),
          note_tone: on(warn) ? "warning" : "",
          mini: on(mini),
        };
      },
    };
    return entry;
  }
  const renumber = () => {
    stepsEmpty.hidden = stepList.length > 0;
    stepList.forEach((e, i) => {
      /** @type {any} */ (e).head.textContent = `Step ${i + 1}`;
      /** @type {any} */ (e).up.disabled = i === 0;
      /** @type {any} */ (e).down.disabled = i === stepList.length - 1;
    });
    stepsBox.replaceChildren(...stepList.map((e) => e.el));
  };
  /** @param {Record<string, any>} s */
  const addStep = (s) => {
    const e = stepEditor(s);
    stepList.push(e);
    /** @type {any} */ (e).up.addEventListener("click", () => move(e, -1));
    /** @type {any} */ (e).down.addEventListener("click", () => move(e, 1));
    e.el.querySelector(".rl-step__buttons .kp-button--ghost")?.addEventListener("click", () => {
      stepList = stepList.filter((x) => x !== e);
      renumber();
      addStepButton.focus();
    });
    return e;
  };
  /** @param {any} e @param {number} by */
  const move = (e, by) => {
    const i = stepList.indexOf(e);
    const j = i + by;
    if (j < 0 || j >= stepList.length) return;
    [stepList[i], stepList[j]] = [stepList[j], stepList[i]];
    renumber();
    (by < 0 ? e.up : e.down).focus();
  };
  const addStepButton = h("button", { type: "button", class: "kp-button kp-button--sm" }, "Add a step");
  for (const s of r.steps ?? []) addStep(s);
  addStepButton.addEventListener("click", () => {
    const e = addStep({});
    renumber();
    attachControls(e.el);
    e.el.querySelector("textarea")?.focus();
  });
  renumber();
  tracks.el.addEventListener("rl-rows-change", () => {
    const opts = trackOptions();
    for (const e of stepList) {
      const sel = e.track;
      const keep = sel.value;
      sel.replaceChildren(...opts.map(([v, t]) => h("option", { value: v }, t)));
      sel.value = opts.some(([v]) => v === keep) ? keep : "";
    }
  });
  const stepsSection = h("div", { class: "rl-steps-wrap" }, stepsBox, stepsEmpty, h("div", { class: "rl-rows__add" }, addStepButton));

  // ---- the drawer ---------------------------------------------------------------------------------------------
  const sec = (title, text, ...body) => h("section", { class: "rl-formsec" }, h("h3", { class: "kp-fw-semibold" }, title), h("p", { class: "rl-formsec__text" }, text), ...body);
  const save = h("button", { type: "submit", class: "kp-button kp-button--primary", "data-kp-flash-button": true, "data-kp-flash-words": "Saved", form: "rl-editor-form" }, editing ? "Save the recipe" : "Add the recipe");
  const cancel = h("button", { type: "button", class: "kp-button" }, "Cancel");
  const form = h(
    "form",
    { class: "kp-drawer__body rl-form", id: "rl-editor-form", novalidate: true },
    sec("The dish", "What it is called and where the wheel may pick it.", dish),
    sec("Time and portions", "How long it takes, how much it makes and how much preparing it needs.", facts),
    sec("Notes", "What you want to remember about it.", notes),
    sec("Tracks, ingredients and tools", "The lists the recipe page and cook mode read.", lists),
    sec("Steps", "In cooking order; each step can start a timer.", stepsSection),
  );
  const line = h("p", { class: "rl-editor__line", role: "status" });
  dialog.replaceChildren(
    h(
      "header",
      { class: "kp-drawer__head" },
      heading,
      h("button", { type: "button", class: "kp-icon-button kp-dialog__close", "aria-label": "Close without saving", "data-close": true }, "✕"),
      h("p", { class: "kp-drawer__desc" }, editing ? "Change any field; nothing is saved until you press Save." : "Fill in what you know; every field can be changed later."),
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

  const close = () => void closeDialog(dialog);
  cancel.addEventListener("click", close);
  dialog.querySelector("[data-close]")?.addEventListener("click", close);
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  }, { once: true });

  const collect = () => {
    const nameValue = /** @type {HTMLInputElement} */ (name).value.trim();
    const shortValue = /** @type {HTMLInputElement} */ (short).value.trim();
    return {
      ...(recipe ?? {}),
      name: nameValue,
      short: shortValue || nameValue.split(/\s+/)[0] || "",
      summary: /** @type {HTMLTextAreaElement} */ (summary).value.trim(),
      meals: getSegmentedValues(meals),
      ing: combobox(mainBox)?.values() ?? [],
      minutes: getQuantity(minutes),
      hands_on: getQuantity(hands),
      portions: getQuantity(portions),
      prep: getSegmentedValues(prep)[0] ?? "light",
      safe: on(safe),
      gear: /** @type {HTMLInputElement} */ (gear).value.trim(),
      last_note: /** @type {HTMLTextAreaElement} */ (lastNote).value.trim(),
      mini_note: /** @type {HTMLTextAreaElement} */ (miniNote).value.trim(),
      tracks: tracks.get().map(([t]) => t).filter((t) => t.name),
      ingredients: ingredients.get().map(([n, amount, unit, group]) => ({ ...n, amount, unit, group })).filter((i) => i.name),
      tools: tools.get().map(([t]) => t).filter((t) => t.name),
      steps: stepList.map((e) => e.get()).filter((s) => s.text),
    };
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void runFlashButton(save, async () => {
      const body = collect();
      if (!body.name) {
        /** @type {HTMLInputElement} */ (name).focus();
        return { error: "A recipe needs a name.", remedy: "Type one in the first field.", word: "Not saved" };
      }
      try {
        if (recipe) await replace("recipes", body);
        else await create("recipes", body);
      } catch (e) {
        return { error: e instanceof ApiError ? e.message : String(e), word: "Not saved" };
      }
      toast(editing ? `Saved ${body.name}` : `Added ${body.name}`);
      close();
      return "Saved";
    });
  });

  dialog.showModal();
}
