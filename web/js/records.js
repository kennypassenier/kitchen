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
import { t, lang, nameOf } from "./i18n/index.js";
import { row, input, area, stepper, select, openEditor } from "./recipe/editor.js";
import { openDrawer, sec, openDishEditor, openNameEditor, ordered } from "./dishes/editor.js";

/** @typedef {Record<string, any>} Item */
/** @typedef {"recipes" | "dishes" | "dish_categories" | "ingredients" | "ingredient_categories" | "freezer" | "shelf" | "log" | "resting"} List */

/** The day it is in Brussels, as YYYY-MM-DD. */
export const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Brussels" });
/** dd/mm/yyyy of an ISO date or datetime. @param {string} iso */
export const dmy = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
/** The YYYY-MM-DD in Brussels of an ISO datetime. @param {string} iso */
export const brusselsDay = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Brussels" });

/** What a shelf item asks of a person. */
export const energies = () => /** @type {Record<string, string>} */ ({ open: t("rec.energyOpen"), easy: t("rec.energyEasy"), any: t("rec.energyAny") });
/** A log line's feeling, as the recipe page names it. */
export const feelings = () => /** @type {Record<string, string>} */ ({ easy: t("rec.feelEasy"), fine: t("rec.feelFine"), heavy: t("rec.feelHeavy") });

/** @param {unknown} e */
const why = (e) => (e instanceof ApiError ? e.message : String(e));
/** @param {string} id */
const recipe = (id) => kitchenNow()?.recipes.find((r) => r.id === id) ?? null;
/** @param {string} id */
const shelfItem = (id) => kitchenNow()?.shelf.find((s) => s.id === id) ?? null;

/**
 * Per list: the page the list lives on (its path and the bar's page id) and the item's own name. The nouns and the
 * sentences that name a list are words (`list.<list>.*` in js/i18n).
 * @type {Record<List, { home: [string, string], name: (item: Item) => string }>}
 */
const PLACES = {
  recipes: { home: ["/recipes", "recipes"], name: (r) => String(r.name || t("rec.aRecipe")) },
  dishes: { home: ["/dishes", "dishes"], name: (d) => nameOf(d).text },
  dish_categories: { home: ["/dishes", "dishes"], name: (c) => nameOf(c).text },
  ingredients: { home: ["/ingredients", "ingredients"], name: (i) => ingredientName(i.id, lang()) },
  ingredient_categories: { home: ["/ingredients", "ingredients"], name: (c) => nameOf(c).text },
  freezer: { home: ["/bad-days#freezer", "baddays"], name: (f) => String(f.dish || t("rec.aDish")) },
  shelf: { home: ["/bad-days#zero-prep", "baddays"], name: (s) => String(s.title || t("rec.aFood")) },
  log: { home: ["/log", "log"], name: (e) => `${logWhat(e)}, ${dmy(e.date)}` },
  resting: { home: ["/", "wheel"], name: (r) => t("rec.resting", recipe(r.recipe_id)?.name ?? t("rec.aDish")) },
};

/**
 * Per list: its noun in the current language, the page it lives on ([path, the bar's word]) and an item's name.
 * @type {Record<List, { readonly noun: string, readonly the: string, readonly this: string, readonly home: [string, string], name: (item: Item) => string }>}
 */
export const LISTS = /** @type {any} */ (
  Object.fromEntries(
    Object.entries(PLACES).map(([list, p]) => [
      list,
      {
        get noun() {
          return t(`list.${list}`);
        },
        /** "the dish" / "het gerecht" */
        get the() {
          return t(`list.${list}.the`);
        },
        /** "this dish" / "dit gerecht", "deze categorie" */
        get this() {
          return t(`list.${list}.this`);
        },
        get home() {
          return [p.home[0], t(`nav.${p.home[1]}`)];
        },
        name: p.name,
      },
    ]),
  )
);

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
  if (e.shelf_id) return shelfItem(e.shelf_id)?.title ?? t("rec.goneShelf");
  return recipe(e.recipe_id)?.name ?? t("rec.goneRecipe");
}

/** "Fries and mayonnaise", or the side's own label: one entry of the small wheel, in the current language. @param {Item} side */
export function sideName(side) {
  const other = lang() === "nl" ? "en" : "nl";
  const label = String(side.label?.[lang()] || side.label?.[other] || "").trim();
  if (label) return label;
  const parts = /** @type {string[]} */ (side.ingredients ?? []).map((id, i) => {
    const n = ingredientName(id, lang());
    return i ? n.charAt(0).toLowerCase() + n.slice(1) : n;
  });
  return parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} ${t("common.and")} ${parts.at(-1)}`;
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
    h("button", { type: "button", class: "kp-button", "data-kp-date-open": true, "aria-label": t("rec.openCalendar"), title: t("rec.openCalendar") }, h("span", { "aria-hidden": "true" }, "▦")),
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
  openDrawer(drawer(), {
    title: item ? t("rec.editTitle", LISTS[list].name(item)) : t(`list.${list}.add`),
    text: item ? t("rec.editText") : t("rec.addText"),
    form,
    saveLabel: item ? t("common.save") : t(`list.${list}.addSave`),
    onSave: async () => {
      const b = body();
      if ("error" in b && typeof b.error === "string") return { error: b.error, remedy: b.remedy, word: t("rec.notSaved") };
      try {
        const out = item ? await replace(list, { ...item, ...b }) : await create(list, b);
        toast(saved(out));
      } catch (e) {
        return { error: why(e), word: t("rec.notSaved") };
      }
      return t("rec.saved");
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
    const nl = input(String(v.name?.nl ?? ""), "text", { autocomplete: "off", lang: "nl", placeholder: t("rec.phIngNl") });
    const en = input(String(v.name?.en ?? ""), "text", { autocomplete: "off", placeholder: t("rec.phIngEn") });
    const cats = ordered(k?.ingredient_categories ?? []);
    const cat = select(cats.map((c) => /** @type {[string, string]} */ ([c.id, nameOf(c).text])), v.category ?? cats.find((c) => c.name?.en === "Other")?.id ?? cats[0]?.id ?? "", t("rec.category"));
    openForm({
      list,
      item,
      title: t("rec.ingTitle"),
      text: t("rec.ingText"),
      rows: [
        row(t("rec.dutchName"), nl, t("rec.dutchHint")),
        row(t("rec.englishName"), en, t("rec.englishHint")),
        row(t("rec.category"), cat, t("rec.ingCatHint")),
      ],
      body: () => {
        const name = { nl: /** @type {HTMLInputElement} */ (nl).value.trim(), en: /** @type {HTMLInputElement} */ (en).value.trim() };
        if (!name.nl && !name.en) return { error: t("rec.errIng"), remedy: t("rec.fixName") };
        return { name, category: cat.value || null };
      },
      saved: (b) => t(item ? "rec.savedName" : "rec.addedName", nameOf(b).text),
    });
    return;
  }
  const v = { ...preset, ...(item ?? {}) };
  if (list === "freezer") {
    const dish = input(String(v.dish ?? ""), "text", { autocomplete: "off", placeholder: t("rec.phDish") });
    const from = select([["", t("rec.noRecipe")], ...recipeOptions()], v.recipe_id ?? "", t("rec.recipe"));
    const portions = stepper(Number(v.portions ?? 2), { min: 0, max: 99, unit: "portions", one: "portion", label: t("rec.portions") });
    portions.classList.add("kp-formgrid__fill");
    const frozen = dateField(v.frozen_on ? brusselsDay(v.frozen_on) : today(), { max: today(), label: t("rec.frozenOn") });
    openForm({
      list,
      item,
      title: t("rec.inFreezer"),
      text: t("rec.inFreezerText"),
      rows: [
        row(t("rec.dish"), dish, t("rec.dishHint")),
        row(t("rec.recipe"), from, t("rec.recipeHint")),
        row(t("rec.portions"), portions, t("rec.portionsHint")),
        row(t("rec.frozenOn"), frozen.el, t("rec.frozenHint")),
      ],
      after: frozen.start,
      body: () => {
        const name = /** @type {HTMLInputElement} */ (dish).value.trim();
        const day = frozen.get();
        if (!name) return { error: t("rec.errDish"), remedy: t("rec.fixDish") };
        if (!day || day > today()) return { error: t("rec.errDay"), remedy: t("rec.fixDay") };
        // A day other than today is kept at noon, so it never slips to the day before in another time zone.
        const at = day === today() && item === null ? new Date().toISOString() : new Date(`${day}T12:00:00`).toISOString();
        return { dish: name, recipe_id: from.value || null, portions: getQuantity(portions), frozen_on: at };
      },
      saved: (b) => t(item ? "rec.savedName" : "rec.addedName", b.dish),
    });
    return;
  }
  if (list === "shelf") {
    const title = input(String(v.title ?? ""), "text", { autocomplete: "off", placeholder: t("rec.phFood") });
    const text = area(String(v.text ?? ""), 2);
    const minutes = stepper(Number(v.minutes ?? 2), { min: 0, max: 60, unit: "min", label: t("rec.minutes") });
    minutes.classList.add("kp-formgrid__fill");
    const gear = input(String(v.gear ?? ""), "text", { autocomplete: "off", placeholder: "a bowl and a spoon" });
    const energy = choiceOf(energies(), String(v.energy ?? "open"), t("rec.energy"));
    openForm({
      list,
      item,
      title: t("rec.onShelf"),
      text: t("rec.onShelfText"),
      rows: [
        row(t("rec.name"), title, t("rec.nameHint")),
        row(t("rec.whatToDo"), text, t("rec.whatToDoHint")),
        row(t("rec.minutes"), minutes, t("rec.minutesHint")),
        row(t("rec.gear"), gear, t("rec.gearHint")),
        row(t("rec.energy"), energy, t("rec.energyHint")),
      ],
      body: () => {
        const name = /** @type {HTMLInputElement} */ (title).value.trim();
        if (!name) return { error: t("rec.errFood"), remedy: t("rec.fixFood") };
        return {
          title: name,
          text: /** @type {HTMLTextAreaElement} */ (text).value.trim(),
          minutes: getQuantity(minutes),
          gear: /** @type {HTMLInputElement} */ (gear).value.trim(),
          energy: getSegmentedValues(energy)[0] ?? "open",
        };
      },
      saved: (b) => t(item ? "rec.savedName" : "rec.addedName", b.title),
    });
    return;
  }
  if (list === "resting") {
    const what = select(recipeOptions(), v.recipe_id ?? "", t("rec.recipe"));
    const until = dateField(String(v.until ?? today()), { label: t("rec.restingUntil") });
    openForm({
      list,
      item,
      title: t("rec.restingTitle"),
      text: t("rec.restingText"),
      rows: [row(t("rec.recipe"), what, t("rec.restingHint")), row(t("rec.until"), until.el, t("rec.untilHint"))],
      after: until.start,
      body: () => {
        const day = until.get();
        if (!what.value) return { error: t("rec.errRest"), remedy: t("rec.fixRest") };
        if (!day) return { error: t("rec.errUntil"), remedy: t("rec.fixUntil") };
        return { recipe_id: what.value, until: day };
      },
      saved: (b) => t("rec.restsUntil", recipe(b.recipe_id)?.name ?? t("rec.theDish"), dmy(b.until)),
    });
    return;
  }
  if (list === "log") {
    const shelf = [...(k?.shelf ?? [])].sort((a, b) => String(a.title).localeCompare(String(b.title)));
    const what = select(
      [...recipeOptions().map(([id, n]) => /** @type {[string, string]} */ ([`r:${id}`, t("rec.optRecipe", n)])), ...shelf.map((s) => /** @type {[string, string]} */ ([`s:${s.id}`, t("rec.optShelf", s.title)]))],
      v.shelf_id ? `s:${v.shelf_id}` : v.recipe_id ? `r:${v.recipe_id}` : "",
      t("rec.whatEaten"),
    );
    const day = dateField(String(v.date ?? today()), { max: today(), label: t("rec.day") });
    const felt = choiceOf({ none: t("rec.noAnswer"), ...feelings() }, String(v.feeling ?? "none"), t("rec.howFelt"));
    const note = input(String(v.note ?? ""), "text", { autocomplete: "off", placeholder: t("rec.phNote") });
    openForm({
      list,
      item,
      title: t("rec.whatEaten"),
      text: t("rec.whatEatenText"),
      rows: [
        row(t("rec.what"), what, t("rec.whatHint")),
        row(t("rec.day"), day.el, t("rec.dayHint")),
        row(t("rec.howFelt"), felt, t("rec.feltHint")),
        row(t("rec.note"), note, t("rec.noteHint")),
      ],
      after: day.start,
      body: () => {
        const [kind, id] = [what.value.slice(0, 1), what.value.slice(2)];
        const d = day.get();
        if (!id) return { error: t("rec.errWhat"), remedy: t("rec.fixWhat") };
        if (!d || d > today()) return { error: t("rec.errDay2"), remedy: t("rec.fixDay") };
        const feeling = getSegmentedValues(felt)[0] ?? "none";
        return {
          recipe_id: kind === "r" ? id : null,
          shelf_id: kind === "s" ? id : null,
          date: d,
          feeling: feeling === "none" ? null : feeling,
          note: /** @type {HTMLInputElement} */ (note).value.trim(),
        };
      },
      saved: (b) => t(item ? "rec.savedLine" : "rec.loggedLine", logWhat(b), dmy(b.date)),
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
  const pick = select(free.map((r) => /** @type {[string, string]} */ ([r.id, String(r.name)])), free[0]?.id ?? "", t("rec.recipe"));
  const fresh = h("button", { type: "button", class: "kp-button" }, t("rec.writeNew"));
  fresh.addEventListener("click", () => openRecipeEditor(null, { safe: true }));
  const form = /** @type {HTMLFormElement} */ (
    h(
      "form",
      { class: "kp-drawer__body rl-form", id: "rc-form", novalidate: true },
      sec(
        t("rec.safeTitle"),
        t("rec.safeText"),
        h(
          "div",
          { class: "kp-formgrid kitchen-formgrid" },
          free.length ? row(t("rec.recipe"), pick, t("rec.safeOnlyFree")) : row(t("rec.recipe"), h("p", { class: "kp-kv__none" }, t("rec.allSafe")), ""),
          h("div", { class: "kp-formgrid__row kp-formgrid__row--buttons" }, h("div", { class: "kp-formgrid__control" }, fresh)),
        ),
      ),
    )
  );
  openDrawer(drawer(), {
    title: t("rec.safeAdd"),
    text: t("rec.safeAddText"),
    form,
    saveLabel: t("rec.makeSafe"),
    onSave: async () => {
      const r = free.find((x) => x.id === pick.value);
      if (!r) return { error: t("rec.errNoRecipe"), remedy: t("rec.fixNoRecipe"), word: t("rec.notSaved") };
      try {
        await replace("recipes", { ...r, safe: true });
      } catch (e) {
        return { error: why(e), word: t("rec.notSaved") };
      }
      toast(t("rec.isSafe", r.name));
      return t("rec.saved");
    },
  });
}

/** Take a recipe off the safe dishes; the recipe stays, and Undo puts it back. @param {Item} r */
export function unmarkSafe(r) {
  void replace("recipes", { ...r, safe: false }).then(
    () =>
      undoToast(t("rec.notSafe", r.name), {
        mode: "revert",
        ms: 10_000,
        clock: "ring",
        undo: async () => {
          const now = kitchenNow()?.recipes.find((x) => x.id === r.id);
          if (now) await replace("recipes", { ...now, safe: true }).catch((e) => toast(t("rec.notBack", why(e)), { live: "assertive", sticky: true }));
        },
      }),
    (e) => toast(t("rec.notChanged", why(e)), { live: "assertive", sticky: true }),
  );
}

// ---- the zero-prep shelf: I ate this ------------------------------------------------------------------------------

/** Log a shelf food as eaten today (Kenny, 24/10/2026 05:07), with Undo. Resolves to the sentence that says so. @param {Item} s */
export async function ateShelf(s) {
  const line = await create("log", { recipe_id: null, shelf_id: s.id, date: today(), feeling: null, note: "" });
  undoToast(t("rec.loggedToday", s.title), {
    mode: "revert",
    ms: 10_000,
    clock: "ring",
    undo: async () => {
      try {
        await remove("log", line.id);
      } catch (e) {
        toast(t("rec.notTakenBack", why(e)), { live: "assertive", sticky: true });
      }
    },
  });
  return t("rec.loggedReadout", s.title, dmy(today()));
}

// ---- delete --------------------------------------------------------------------------------------------------------

/** What deleting an item loses, in one line per thing. @param {List} list @param {Item} item */
function loses(list, item) {
  const k = kitchenNow();
  switch (list) {
    case "freezer":
      return [t("rec.losesFreezer", item.dish, item.portions)];
    case "shelf":
      return [t("rec.losesShelf", (k?.log ?? []).filter((e) => e.shelf_id === item.id).length)];
    default:
      return [t(`list.${list}.loses`)];
  }
}

/** What still points at an item, by name: a category's dishes, an ingredient's dishes and recipes, an ingredient category's ingredients. @param {List} list @param {Item} item */
export function usersOf(list, item) {
  const k = kitchenNow();
  if (list === "dish_categories") return (k?.dishes ?? []).filter((d) => d.category === item.id).map((d) => nameOf(d).text);
  if (list === "ingredient_categories") return (k?.ingredients ?? []).filter((i) => i.category === item.id).map((i) => ingredientName(i.id));
  if (list === "ingredients")
    return [
      ...(k?.dishes ?? []).filter((d) => dishHas(d, item.id)).map((d) => t("rec.userDish", nameOf(d).text)),
      ...(k?.recipes ?? []).filter((r) => (r.ingredients ?? []).some((/** @type {Item} */ l) => l.ingredient === item.id)).map((r) => t("rec.userRecipe", r.name)),
    ];
  return [];
}

/** Is `item` still in use so it cannot go? Returns the sentence that says so, naming every user. @param {List} list @param {Item} item */
function inUse(list, item) {
  const users = usersOf(list, item);
  if (!users.length) return null;
  return t(`list.${list}.inUse`, LISTS[list].name(item), users.length, users.join(", "));
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
        undoToast(t("rec.deletedDot", name), {
          mode: "revert",
          ms: 10_000,
          clock: "ring",
          undo: async () => {
            try {
              await create(list, rest);
            } catch (e) {
              toast(t("rec.notBack", why(e)), { live: "assertive", sticky: true });
            }
          },
        });
      },
      (e) => toast(t("rec.notDeleted", why(e)), { live: "assertive", sticky: true }),
    );
    return;
  }
  openConfirmation(anchor, {
    phrase: t("rec.deleteAsk", name),
    typeName: name,
    acceptLabel: t(`list.${list}.delete`),
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
            toast(t("rec.deleted", name));
            after?.();
          },
          (e) => toast(t("rec.notDeleted", why(e)), { live: "assertive", sticky: true }),
        ),
  });
}

/** Edit and Delete for one row of a list. @param {List} list @param {Item} item */
export function rowActions(list, item) {
  const name = LISTS[list].name(item);
  const edit = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": t("rec.editName", name) }, t("common.edit"));
  const del = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--destructive", "aria-label": t("rec.deleteName", name) }, t("common.delete"));
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
    h("p", { class: "kp-empty__title", "data-kp-datatable-empty-nomatch": true }, t("rec.noMatch", noun)),
    h("p", { class: "kp-empty__body", "data-kp-datatable-empty-nomatch": true }, t("rec.noMatchText")),
    h("button", { type: "button", class: "kp-button", "data-kp-datatable-empty-nomatch": true, "data-kp-datatable-clear": true }, t("rec.clearSearch")),
  );
  const body = h("tbody");
  const search = h("input", { class: "kp-field__input kp-datatable__search", type: "search", "data-kp-datatable-search": true, "aria-label": t("rec.search", plural), placeholder: t("rec.search", plural) });
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
    h("div", { class: "kp-alert kp-alert--destructive", "data-kp-datatable-failed": true, role: "alert", hidden: true }, h("p", { "data-kp-datatable-failed-reason": true }, t("rec.notRead", plural)), h("button", { type: "button", class: "kp-button", "data-kp-datatable-retry": true }, t("common.tryAgain"))),
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
