// Add, view, edit and delete for every list the kitchen keeps (Kenny, 24/10/2026 05:07, 05:08: "everything that is
// entered or read out has full CRUD", and every item has its own page). One place knows, per list, its name, its
// detail page, its editor and how it is deleted, so the screens that show an item (/bad-days, /dishes, /log, the
// wheel's resting list, the detail page) all offer the same four actions in the same words.
//
// The editors are the dishes' drawer (js/dishes/editor.js) on `.kp-formgrid`; a delete that loses something a person
// typed asks for the typed name (the package's confirmation), a log line or a resting mark is taken back with Undo.
// docs/agent/CRUD.md lists what each screen offers.

import { attachDatePickers, datePicker } from "/static/kp/js/datepicker.js";
import { getQuantity } from "/static/kp/js/quantity.js";
import { getSegmentedValues } from "/static/kp/js/segmented.js";
import { openConfirmation } from "/static/kp/js/components.js";
import { toast } from "/static/kp/js/overlays.js";
import { undoToast } from "/static/kp/js/undo-toast.js";
import { h } from "./dom.js";
import { create, replace, remove, kitchenNow, ingredientName, ApiError } from "./api.js";
import { row, input, area, stepper, select, openEditor } from "./recipe/editor.js";
import { openDrawer, sec, openDishEditor, openNameEditor, label as nameLabel, ordered } from "./dishes/editor.js";

/** @typedef {Record<string, any>} Item */
/** @typedef {"recipes" | "dishes" | "dish_categories" | "ingredients" | "ingredient_categories" | "freezer" | "shelf" | "log" | "resting"} List */

/** The day it is in Brussels, as YYYY-MM-DD. */
export const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Brussels" });
/** dd/mm/yyyy of an ISO date or datetime. @param {string} iso */
export const dmy = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
/** The YYYY-MM-DD in Brussels of an ISO datetime. @param {string} iso */
export const brusselsDay = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Brussels" });

/** What a shelf item asks of a person. */
export const ENERGY = /** @type {Record<string, string>} */ ({ open: "Just open it", easy: "One easy step", any: "Anything here" });
/** A log line's feeling, as the recipe page names it. */
export const FEELING = /** @type {Record<string, string>} */ ({ easy: "Easy", fine: "Fine", heavy: "Heavy" });

/** @param {unknown} e */
const why = (e) => (e instanceof ApiError ? e.message : String(e));
/** @param {string} id */
const recipe = (id) => kitchenNow()?.recipes.find((r) => r.id === id) ?? null;
/** @param {string} id */
const shelfItem = (id) => kitchenNow()?.shelf.find((s) => s.id === id) ?? null;

/**
 * Per list: the singular noun, the page the list lives on, and the item's own name.
 * @type {Record<List, { noun: string, home: [string, string], name: (item: Item) => string }>}
 */
export const LISTS = {
  recipes: { noun: "recipe", home: ["/recipes", "Recipes"], name: (r) => String(r.name || "A recipe") },
  dishes: { noun: "dish", home: ["/dishes", "Dishes"], name: nameLabel },
  dish_categories: { noun: "category", home: ["/dishes", "Dishes"], name: nameLabel },
  ingredients: { noun: "ingredient", home: ["/ingredients", "Ingredients"], name: (i) => ingredientName(i.id) },
  ingredient_categories: { noun: "ingredient category", home: ["/ingredients", "Ingredients"], name: nameLabel },
  freezer: { noun: "freezer item", home: ["/bad-days#freezer", "Bad days"], name: (f) => String(f.dish || "A dish") },
  shelf: { noun: "shelf food", home: ["/bad-days#zero-prep", "Bad days"], name: (s) => String(s.title || "A food") },
  log: { noun: "log line", home: ["/log", "What I ate"], name: (e) => `${logWhat(e)}, ${dmy(e.date)}` },
  resting: { noun: "resting dish", home: ["/", "What do we eat?"], name: (r) => `${recipe(r.recipe_id)?.name ?? "A dish"} resting` },
};

/** Where an item's own page is. @param {List} list @param {string} id */
export function detailHref(list, id) {
  const e = encodeURIComponent(id);
  return list === "recipes" ? `/recipe?id=${e}` : `/${DETAIL_BASE[list]}/${e}`;
}
/** The path word of each list's detail page; js/main.js routes `/<word>/<id>` to pages/item.js. */
export const DETAIL_BASE = /** @type {Record<Exclude<List, "recipes">, string>} */ ({
  dishes: "dishes",
  dish_categories: "categories",
  ingredients: "ingredients",
  ingredient_categories: "ingredient-categories",
  freezer: "freezer",
  shelf: "shelf",
  log: "log",
  resting: "resting",
});

/** What a log line is about: the recipe or the shelf food, by name. @param {Item} e */
export function logWhat(e) {
  if (e.shelf_id) return shelfItem(e.shelf_id)?.title ?? "A shelf food that was deleted";
  return recipe(e.recipe_id)?.name ?? "A recipe that was deleted";
}

/** "Fries and mayonnaise", or the side's own label: one entry of the small wheel, in English. @param {Item} side */
export function sideName(side) {
  const label = String(side.label?.en || side.label?.nl || "").trim();
  if (label) return label;
  const parts = /** @type {string[]} */ (side.ingredients ?? []).map((id, i) => {
    const n = ingredientName(id);
    return i ? n.charAt(0).toLowerCase() + n.slice(1) : n;
  });
  return parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

/** Does a dish have the ingredient, fixed or in one of its sides? @param {Item} d @param {string} id */
export const dishHas = (d, id) => (d.ingredients ?? []).includes(id) || (d.sides ?? []).some((/** @type {Item} */ s) => (s.ingredients ?? []).includes(id));

/** A link to an item's own page. @param {List} list @param {Item} item @param {string} [text] */
export const itemLink = (list, item, text) => h("a", { href: detailHref(list, item.id) }, text ?? LISTS[list].name(item));

// ---- the drawer ----------------------------------------------------------------------------------------------------

/** The one drawer every screen shares, made on first use. */
export function drawer() {
  let d = /** @type {HTMLDialogElement | null} */ (document.getElementById("kitchen-drawer"));
  if (!d) {
    d = /** @type {HTMLDialogElement} */ (h("dialog", { class: "kp-drawer kp-dialog rl-editor", id: "kitchen-drawer", "aria-labelledby": "rl-editor-t" }));
    document.body.append(d);
  }
  return d;
}

/** The package's date picker in a form row; `max` keeps it at or before a day. @param {string} iso @param {{ max?: string, label: string }} o */
function dateField(iso, { max, label }) {
  const id = `rc-date-${Math.random().toString(36).slice(2, 8)}`;
  const el = h(
    "div",
    { class: "kp-datepicker kp-formgrid__fill", "data-kp-datepicker": true, lang: "en-GB", ...(max ? { "data-kp-max": max } : {}) },
    h("input", { class: "kp-field__input", id, type: "text", inputmode: "numeric", "data-kp-date-input": true, "aria-label": label, value: iso ? dmy(iso) : "" }),
    h("button", { type: "button", class: "kp-button", "data-kp-date-open": true, "aria-label": "Open the calendar", title: "Open the calendar" }, h("span", { "aria-hidden": "true" }, "▦")),
    h("div", { class: "kp-datepicker__panel", "data-kp-date-panel": true, hidden: true }),
  );
  return {
    el,
    /** After the drawer attached the picker: show `iso`. */
    start: () => {
      attachDatePickers(el.parentElement ?? el);
      if (iso) datePicker(el)?.set(iso);
    },
    /** @returns {string | null} YYYY-MM-DD */
    get: () => {
      const d = datePicker(el)?.get();
      return d ? d.toLocaleDateString("en-CA") : null;
    },
  };
}

/** A segmented choice of one. @param {Record<string, string>} options @param {string} value @param {string} label */
function choiceOf(options, value, label) {
  return h(
    "div",
    { class: "kp-segmented kp-segmented--chips", "data-kp-segmented": "single", role: "radiogroup", "aria-label": label },
    ...Object.entries(options).map(([v, t]) =>
      h("button", { type: "button", class: "kp-segmented__item", role: "radio", "data-value": v, "aria-checked": String(v === value) }, h("span", { class: "kp-segmented__label" }, t)),
    ),
  );
}

/** The recipes as select options, by name. */
const recipeOptions = () =>
  [...(kitchenNow()?.recipes ?? [])].sort((a, b) => String(a.name).localeCompare(String(b.name))).map((r) => /** @type {[string, string]} */ ([r.id, String(r.name)]));

/**
 * One form in the drawer: rows on one `.kp-formgrid`, saved as a create or a replace.
 * @param {{ list: List, item: Item | null, title: string, text: string, rows: HTMLElement[], body: () => Item | { error: string, remedy?: string }, after?: () => void, saved: (body: Item) => string }} spec
 */
function openForm({ list, item, title, text, rows, body, after, saved }) {
  const form = /** @type {HTMLFormElement} */ (
    h("form", { class: "kp-drawer__body rl-form", id: "rc-form", novalidate: true }, sec(title, text, h("div", { class: "kp-formgrid kitchen-formgrid" }, ...rows)))
  );
  const noun = LISTS[list].noun;
  openDrawer(drawer(), {
    title: item ? `Edit ${LISTS[list].name(item)}` : `Add a ${noun}`,
    text: item ? "Change any field; nothing is saved until you press Save." : "Fill in what you know; every field can be changed later.",
    form,
    saveLabel: item ? "Save" : `Add the ${noun}`,
    onSave: async () => {
      const b = body();
      if ("error" in b && typeof b.error === "string") return { error: b.error, remedy: b.remedy, word: "Not saved" };
      try {
        const out = item ? await replace(list, { ...item, ...b }) : await create(list, b);
        toast(saved(out));
      } catch (e) {
        return { error: why(e), word: "Not saved" };
      }
      return "Saved";
    },
  });
  after?.();
}

/**
 * Open the editor for an item of `list`, or for a new one (`preset` fills a new one).
 * @param {List} list @param {Item | null} item @param {Item} [preset]
 */
export function openRecordEditor(list, item, preset = {}) {
  const k = kitchenNow();
  if (list === "dishes") {
    openDishEditor(drawer(), { dish: item, categories: ordered(k?.dish_categories ?? []), recipes: k?.recipes ?? [] });
    return;
  }
  if (list === "dish_categories" || list === "ingredient_categories") {
    const dish = list === "dish_categories";
    openNameEditor(drawer(), { list, item, items: k?.[list] ?? [], noun: LISTS[list].noun, example: dish ? { nl: "Speciaal", en: "Special" } : { nl: "Vlees", en: "Meat" } });
    return;
  }
  if (list === "ingredients") {
    const v = { ...preset, ...(item ?? {}) };
    const nl = input(String(v.name?.nl ?? ""), "text", { autocomplete: "off", lang: "nl", placeholder: "Frieten" });
    const en = input(String(v.name?.en ?? ""), "text", { autocomplete: "off", placeholder: "Fries" });
    const cats = ordered(k?.ingredient_categories ?? []);
    const cat = select(cats.map((c) => /** @type {[string, string]} */ ([c.id, nameLabel(c)])), v.category ?? cats.find((c) => c.name?.en === "Other")?.id ?? cats[0]?.id ?? "", "Category");
    openForm({
      list,
      item,
      title: "The ingredient",
      text: "One ingredient for the whole kitchen: dishes take it as a side, recipes as a line. It shows in each language it has a name in.",
      rows: [
        row("Dutch name", nl, "What the parents' wheel says."),
        row("English name", en, "What Kitchen says."),
        row("Category", cat, "Meat, potatoes, vegetables, …"),
      ],
      body: () => {
        const name = { nl: /** @type {HTMLInputElement} */ (nl).value.trim(), en: /** @type {HTMLInputElement} */ (en).value.trim() };
        if (!name.nl && !name.en) return { error: "An ingredient needs a name.", remedy: "Type its Dutch name, its English name or both." };
        return { name, category: cat.value || null };
      },
      saved: (b) => `${item ? "Saved" : "Added"} ${b.name.en || b.name.nl}`,
    });
    return;
  }
  const v = { ...preset, ...(item ?? {}) };
  if (list === "freezer") {
    const dish = input(String(v.dish ?? ""), "text", { autocomplete: "off", placeholder: "Bolognese sauce" });
    const from = select([["", "No recipe"], ...recipeOptions()], v.recipe_id ?? "", "Recipe");
    const portions = stepper(Number(v.portions ?? 2), { min: 0, max: 99, unit: "portions", one: "portion", label: "Portions" });
    portions.classList.add("kp-formgrid__fill");
    const frozen = dateField(v.frozen_on ? brusselsDay(v.frozen_on) : today(), { max: today(), label: "Frozen on" });
    openForm({
      list,
      item,
      title: "In the freezer",
      text: "A dish you froze, how many portions are left and the day it went in.",
      rows: [
        row("Dish", dish, "What it is, as you would say it."),
        row("Recipe", from, "The recipe it was made from, if there is one."),
        row("Portions", portions, "How many are left; at zero it leaves the bad-days list."),
        row("Frozen on", frozen.el, "The day it went in."),
      ],
      after: frozen.start,
      body: () => {
        const name = /** @type {HTMLInputElement} */ (dish).value.trim();
        const day = frozen.get();
        if (!name) return { error: "Say what you froze.", remedy: "Type the dish's name." };
        if (!day || day > today()) return { error: "The day it went in is missing or still to come.", remedy: "Pick a day up to today." };
        // A day other than today is kept at noon, so it never slips to the day before in another time zone.
        const at = day === today() && item === null ? new Date().toISOString() : new Date(`${day}T12:00:00`).toISOString();
        return { dish: name, recipe_id: from.value || null, portions: getQuantity(portions), frozen_on: at };
      },
      saved: (b) => `${item ? "Saved" : "Added"} ${b.dish}`,
    });
    return;
  }
  if (list === "shelf") {
    const title = input(String(v.title ?? ""), "text", { autocomplete: "off", placeholder: "Yoghurt with granola" });
    const text = area(String(v.text ?? ""), 2);
    const minutes = stepper(Number(v.minutes ?? 2), { min: 0, max: 60, unit: "min", label: "Minutes" });
    minutes.classList.add("kp-formgrid__fill");
    const gear = input(String(v.gear ?? ""), "text", { autocomplete: "off", placeholder: "a bowl and a spoon" });
    const energy = choiceOf(ENERGY, String(v.energy ?? "open"), "How much it asks");
    openForm({
      list,
      item,
      title: "On the zero-prep shelf",
      text: "Food that is eaten without cooking, for the days nothing else works.",
      rows: [
        row("Name", title, "As it shows on the shelf."),
        row("What to do", text, "One or two sentences."),
        row("Minutes", minutes, "From the cupboard to the plate."),
        row("What it uses", gear, "A plate, a bowl, a knife, …"),
        row("How much it asks", energy, "Which of the shelf's three choices shows it."),
      ],
      body: () => {
        const name = /** @type {HTMLInputElement} */ (title).value.trim();
        if (!name) return { error: "A shelf food needs a name.", remedy: "Type what it is." };
        return {
          title: name,
          text: /** @type {HTMLTextAreaElement} */ (text).value.trim(),
          minutes: getQuantity(minutes),
          gear: /** @type {HTMLInputElement} */ (gear).value.trim(),
          energy: getSegmentedValues(energy)[0] ?? "open",
        };
      },
      saved: (b) => `${item ? "Saved" : "Added"} ${b.title}`,
    });
    return;
  }
  if (list === "resting") {
    const what = select(recipeOptions(), v.recipe_id ?? "", "Recipe");
    const until = dateField(String(v.until ?? today()), { label: "Resting until" });
    openForm({
      list,
      item,
      title: "Resting",
      text: "A dish set aside stays off the wheel until the day after this date.",
      rows: [row("Recipe", what, "The dish that rests."), row("Until", until.el, "The last day it stays off the wheel.")],
      after: until.start,
      body: () => {
        const day = until.get();
        if (!what.value) return { error: "Pick the dish that rests.", remedy: "Add a recipe first if the list is empty." };
        if (!day) return { error: "The last day is missing.", remedy: "Pick a day." };
        return { recipe_id: what.value, until: day };
      },
      saved: (b) => `${recipe(b.recipe_id)?.name ?? "The dish"} rests until ${dmy(b.until)}`,
    });
    return;
  }
  if (list === "log") {
    const shelf = [...(k?.shelf ?? [])].sort((a, b) => String(a.title).localeCompare(String(b.title)));
    const what = select(
      [...recipeOptions().map(([id, n]) => /** @type {[string, string]} */ ([`r:${id}`, `Recipe: ${n}`])), ...shelf.map((s) => /** @type {[string, string]} */ ([`s:${s.id}`, `Shelf: ${s.title}`]))],
      v.shelf_id ? `s:${v.shelf_id}` : v.recipe_id ? `r:${v.recipe_id}` : "",
      "What was eaten",
    );
    const day = dateField(String(v.date ?? today()), { max: today(), label: "Day" });
    const felt = choiceOf({ none: "No answer", ...FEELING }, String(v.feeling ?? "none"), "How did it feel?");
    const note = input(String(v.note ?? ""), "text", { autocomplete: "off", placeholder: "Too salty; half the stock next time" });
    openForm({
      list,
      item,
      title: "What was eaten",
      text: "A recipe that was cooked or a shelf food that was eaten, on one day.",
      rows: [
        row("What", what, "A recipe or a food from the zero-prep shelf."),
        row("Day", day.el, "The day it was eaten."),
        row("How did it feel?", felt, "Only if you want to say."),
        row("Note", note, "Anything to remember next time."),
      ],
      after: day.start,
      body: () => {
        const [kind, id] = [what.value.slice(0, 1), what.value.slice(2)];
        const d = day.get();
        if (!id) return { error: "Pick what was eaten.", remedy: "Add a recipe or a shelf food first if the list is empty." };
        if (!d || d > today()) return { error: "The day is missing or still to come.", remedy: "Pick a day up to today." };
        const feeling = getSegmentedValues(felt)[0] ?? "none";
        return {
          recipe_id: kind === "r" ? id : null,
          shelf_id: kind === "s" ? id : null,
          date: d,
          feeling: feeling === "none" ? null : feeling,
          note: /** @type {HTMLInputElement} */ (note).value.trim(),
        };
      },
      saved: (b) => `${item ? "Saved" : "Logged"} ${logWhat(b)} on ${dmy(b.date)}`,
    });
  }
}

// ---- safe dishes: a recipe's `safe` flag ----------------------------------------------------------------------------

/** Open the recipe editor for a recipe, or a new one that starts with `preset` (a new safe dish: `{ safe: true }`). @param {Item | null} r @param {Item} [preset] */
export function openRecipeEditor(r, preset = {}) {
  const k = kitchenNow();
  openEditor(drawer(), { recipe: r, preset, mainOptions: [...new Set((k?.recipes ?? []).flatMap((x) => x.ing ?? []))] });
}

/** Mark one of the recipes as a safe dish, or write a new one. */
export function openSafePicker() {
  const free = (kitchenNow()?.recipes ?? []).filter((r) => r.safe !== true).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const pick = select(free.map((r) => /** @type {[string, string]} */ ([r.id, String(r.name)])), free[0]?.id ?? "", "Recipe");
  const fresh = h("button", { type: "button", class: "kp-button" }, "Write a new recipe instead");
  fresh.addEventListener("click", () => openRecipeEditor(null, { safe: true }));
  const form = /** @type {HTMLFormElement} */ (
    h(
      "form",
      { class: "kp-drawer__body rl-form", id: "rc-form", novalidate: true },
      sec(
        "A safe dish",
        "A safe dish is one of your recipes that works on any day; it waits on the bad-days screen in a fixed place.",
        h(
          "div",
          { class: "kp-formgrid kitchen-formgrid" },
          free.length ? row("Recipe", pick, "Only recipes that are not safe yet are listed.") : row("Recipe", h("p", { class: "kp-kv__none" }, "Every recipe is a safe dish already."), ""),
          h("div", { class: "kp-formgrid__row kp-formgrid__row--buttons" }, h("div", { class: "kp-formgrid__control" }, fresh)),
        ),
      ),
    )
  );
  openDrawer(drawer(), {
    title: "Add a safe dish",
    text: "Pick one of your recipes, or write a new one that starts as safe.",
    form,
    saveLabel: "Make it safe",
    onSave: async () => {
      const r = free.find((x) => x.id === pick.value);
      if (!r) return { error: "There is no recipe to pick.", remedy: "Write a new recipe instead.", word: "Not saved" };
      try {
        await replace("recipes", { ...r, safe: true });
      } catch (e) {
        return { error: why(e), word: "Not saved" };
      }
      toast(`${r.name} is a safe dish`);
      return "Saved";
    },
  });
}

/** Take a recipe off the safe dishes; the recipe stays, and Undo puts it back. @param {Item} r */
export function unmarkSafe(r) {
  void replace("recipes", { ...r, safe: false }).then(
    () =>
      undoToast(`${r.name} is not a safe dish any more. The recipe stays.`, {
        mode: "revert",
        ms: 10_000,
        clock: "ring",
        undo: async () => {
          const now = kitchenNow()?.recipes.find((x) => x.id === r.id);
          if (now) await replace("recipes", { ...now, safe: true }).catch((e) => toast(`Could not put it back. ${why(e)}`, { live: "assertive", sticky: true }));
        },
      }),
    (e) => toast(`Not changed: ${why(e)}`, { live: "assertive", sticky: true }),
  );
}

// ---- the zero-prep shelf: I ate this ------------------------------------------------------------------------------

/** Log a shelf food as eaten today (Kenny, 24/10/2026 05:07), with Undo. Resolves to the sentence that says so. @param {Item} s */
export async function ateShelf(s) {
  const line = await create("log", { recipe_id: null, shelf_id: s.id, date: today(), feeling: null, note: "" });
  undoToast(`Logged ${s.title} for today.`, {
    mode: "revert",
    ms: 10_000,
    clock: "ring",
    undo: async () => {
      try {
        await remove("log", line.id);
      } catch (e) {
        toast(`Could not take it back. ${why(e)}`, { live: "assertive", sticky: true });
      }
    },
  });
  return `Logged: ${s.title}, today ${dmy(today())}. A plate and you are done.`;
}

// ---- delete --------------------------------------------------------------------------------------------------------

/** What deleting an item loses, in one line per thing. @param {List} list @param {Item} item */
function loses(list, item) {
  const k = kitchenNow();
  switch (list) {
    case "dishes":
      return ["The dish and its sides. A recipe it points at stays."];
    case "dish_categories":
      return ["The category; no dish uses it."];
    case "ingredient_categories":
      return ["The ingredient category; no ingredient is in it."];
    case "ingredients":
      return ["The ingredient; no dish or recipe uses it."];
    case "freezer":
      return [`${item.dish}: ${item.portions} ${item.portions === 1 ? "portion" : "portions"} in the list. The food in the freezer is not touched.`];
    case "shelf": {
      const eaten = (k?.log ?? []).filter((e) => e.shelf_id === item.id).length;
      return [`The shelf food${eaten ? `; its ${eaten} log ${eaten === 1 ? "line stays and says" : "lines stay and say"} "A shelf food that was deleted"` : ""}.`];
    }
    default:
      return [`The ${LISTS[list].noun}.`];
  }
}

/** What still points at an item, by name: a category's dishes, an ingredient's dishes and recipes, an ingredient category's ingredients. @param {List} list @param {Item} item */
export function usersOf(list, item) {
  const k = kitchenNow();
  if (list === "dish_categories") return (k?.dishes ?? []).filter((d) => d.category === item.id).map(nameLabel);
  if (list === "ingredient_categories") return (k?.ingredients ?? []).filter((i) => i.category === item.id).map((i) => ingredientName(i.id));
  if (list === "ingredients")
    return [
      ...(k?.dishes ?? []).filter((d) => dishHas(d, item.id)).map((d) => `${nameLabel(d)} (dish)`),
      ...(k?.recipes ?? []).filter((r) => (r.ingredients ?? []).some((/** @type {Item} */ l) => l.ingredient === item.id)).map((r) => `${r.name} (recipe)`),
    ];
  return [];
}

/** Is `item` still in use so it cannot go? Returns the sentence that says so, naming every user. @param {List} list @param {Item} item */
function inUse(list, item) {
  const users = usersOf(list, item);
  if (!users.length) return null;
  const what = list === "ingredient_categories" ? (users.length === 1 ? "ingredient" : "ingredients") : list === "ingredients" ? (users.length === 1 ? "dish or recipe" : "dishes and recipes") : users.length === 1 ? "dish" : "dishes";
  return `${LISTS[list].name(item)} is used by ${users.length} ${what}: ${users.join(", ")}. Take it out of ${users.length === 1 ? "that one" : "them"} first.`;
}

/**
 * Delete an item: a log line or a resting mark at once with Undo, anything a person typed more of after the typed
 * name. `after` runs once it is gone (a detail page goes back to its list).
 * @param {HTMLElement} anchor @param {List} list @param {Item} item @param {{ after?: () => void }} [o]
 */
export function deleteRecord(anchor, list, item, { after } = {}) {
  const name = LISTS[list].name(item);
  const blocked = inUse(list, item);
  if (blocked) {
    toast(blocked, { live: "assertive" });
    return;
  }
  if (list === "log" || list === "resting") {
    void remove(list, item.id).then(
      () => {
        after?.();
        const { id, created, updated, ...rest } = item;
        undoToast(`Deleted ${name}.`, {
          mode: "revert",
          ms: 10_000,
          clock: "ring",
          undo: async () => {
            try {
              await create(list, rest);
            } catch (e) {
              toast(`Could not put it back. ${why(e)}`, { live: "assertive", sticky: true });
            }
          },
        });
      },
      (e) => toast(`Not deleted: ${why(e)}`, { live: "assertive", sticky: true }),
    );
    return;
  }
  openConfirmation(anchor, {
    phrase: `Delete ${name}?`,
    typeName: name,
    acceptLabel: `Delete ${LISTS[list].noun}`,
    loses: loses(list, item),
    onAccept: () =>
      void remove(list, item.id)
        .then(async () => {
          // A deleted category leaves no gap: the others close up to 1, 2, 3, ….
          if (list === "dish_categories" || list === "ingredient_categories") {
            const rest = ordered(kitchenNow()?.[list] ?? []);
            for (const [i, x] of rest.entries()) if (x.order !== i + 1) await replace(list, { ...x, order: i + 1 });
          }
        })
        .then(
          () => {
            toast(`Deleted ${name}`);
            after?.();
          },
          (e) => toast(`Not deleted: ${why(e)}`, { live: "assertive", sticky: true }),
        ),
  });
}

/** Edit and Delete for one row of a list. @param {List} list @param {Item} item */
export function rowActions(list, item) {
  const name = LISTS[list].name(item);
  const edit = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": `Edit ${name}` }, "Edit");
  const del = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--destructive", "aria-label": `Delete ${name}` }, "Delete");
  edit.addEventListener("click", () => openRecordEditor(list, item));
  del.addEventListener("click", () => deleteRecord(del, list, item));
  const blocked = inUse(list, item);
  if (blocked) del.setAttribute("title", blocked);
  return h("div", { class: "kp-row-actions" }, edit, del);
}

// ---- one card with a data table, as /dishes and /log show their lists ----------------------------------------------

/**
 * One card with a data table: header, a sentence, the table and its own states.
 * @param {{ id: string, title: string, lede: string, noun: string, plural: string, columns: [string, string?][], add: string, emptyTitle: string, emptyText: string }} spec
 */
export function tableCard({ id, title, lede, noun, plural, columns, add, emptyTitle, emptyText }) {
  const addButton = h("button", { type: "button", class: "kp-button kp-button--primary" }, add);
  const empty = h(
    "div",
    { class: "kp-empty", "data-kp-art": "none", "data-kp-datatable-empty": true, hidden: true },
    h("p", { class: "kp-empty__title", "data-kp-datatable-empty-none": true }, emptyTitle),
    h("p", { class: "kp-empty__body", "data-kp-datatable-empty-none": true }, emptyText),
    h("button", { type: "button", class: "kp-button kp-button--primary", "data-kp-datatable-empty-none": true, "data-dl-add": true }, add),
    h("p", { class: "kp-empty__title", "data-kp-datatable-empty-nomatch": true }, `No ${noun} matches`),
    h("p", { class: "kp-empty__body", "data-kp-datatable-empty-nomatch": true }, "Nothing has that in its names."),
    h("button", { type: "button", class: "kp-button", "data-kp-datatable-empty-nomatch": true, "data-kp-datatable-clear": true }, "Clear the search"),
  );
  const body = h("tbody");
  const search = h("input", { class: "kp-field__input kp-datatable__search", type: "search", "data-kp-datatable-search": true, "aria-label": `Search the ${plural}`, placeholder: `Search the ${plural}` });
  const table = h(
    "div",
    { class: "kp-datatable", "data-kp-datatable": true, "data-kp-cards": true, "data-kp-state": "loading", "data-kp-page-size": "25" },
    h("div", { class: "kp-datatable__bar" }, search),
    h(
      "div",
      { class: "kp-table-wrap" },
      h(
        "table",
        { class: "kp-table" },
        h("caption", { class: "kp-sr-only" }, title),
        h("thead", null, h("tr", null, ...columns.map(([text, sort]) => h("th", sort ? { scope: "col", "data-kp-sort": sort } : { scope: "col" }, text)))),
        body,
      ),
    ),
    empty,
    h("div", { class: "kp-alert kp-alert--destructive", "data-kp-datatable-failed": true, role: "alert", hidden: true }, h("p", { "data-kp-datatable-failed-reason": true }, `The ${plural} could not be read.`), h("button", { type: "button", class: "kp-button", "data-kp-datatable-retry": true }, "Try again")),
    h("div", { class: "kp-datatable__bar" }, h("p", { class: "kp-datatable__status", "data-kp-datatable-status": true, role: "status", "aria-live": "polite" }), h("div", { class: "kp-datatable__pager", "data-kp-datatable-pager": true })),
  );
  const card = h(
    "section",
    { class: "kp-card dl-card", "aria-labelledby": `${id}-t` },
    h("div", { class: "kp-card__header" }, h("h2", { class: "kp-card__title", id: `${id}-t` }, title), h("div", { class: "kp-card__actions" }, addButton)),
    h("p", { class: "kp-lede" }, lede),
    table,
  );
  return { card, table, body, addButtons: [addButton, /** @type {HTMLElement} */ (empty.querySelector("[data-dl-add]"))] };
}
