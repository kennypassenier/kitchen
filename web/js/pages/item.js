// One item's own page (Kenny, 24/10/2026 05:08): `/dishes/<id>`, `/categories/<id>`, `/ingredients/<id>`,
// `/ingredient-categories/<id>`, `/freezer/<id>`, `/shelf/<id>`, `/log/<id>` and `/resting/<id>` (js/main.js routes
// them here; a recipe keeps its own page, /recipe?id=…). An ingredient's page also lists every dish and recipe with
// it, with a search and filters, and has a wheel that picks only among those dishes (05:15). The page
// header carries a crumb back to the list, the item's name and Edit and Delete; one card shows every field as the
// package's key-value list, with links to what the item points at and what points at it. The card has the package's
// loading and failed states; an item that does not exist (any more) is an empty plate with the way back.

import { attachCardStates, setCardState, CARD_RETRY_EVENT } from "/static/kp/js/card-state.js";
import { agoMoment } from "/static/kp/js/freshness.js";
import { attachDataTables, dataTable } from "/static/kp/js/datatable.js";
import { attachWheels, setWheelItems } from "/static/kp/js/wheel.js";
import { attachSegmented, getSegmentedValues, SEGMENTED_EVENT } from "/static/kp/js/segmented.js";
import { attachSelects } from "/static/kp/js/combobox.js";
import { loadKitchen, onKitchen, kitchenNow, ingredientName } from "../api.js";
import { h } from "../dom.js";
import { LISTS, DETAIL_BASE, itemLink, openRecordEditor, deleteRecord, dmy, brusselsDay, ENERGY, FEELING, logWhat, tableCard, sideName, dishHas } from "../records.js";
import { names, languages, ordered } from "../dishes/editor.js";

/** @typedef {import("../api.js").Kitchen} Kitchen */
/** @typedef {import("../records.js").List} List */
/** @typedef {Record<string, any>} Item */

/** The list behind a path word. */
const BY_BASE = /** @type {Record<string, Exclude<List, "recipes">>} */ (Object.fromEntries(Object.entries(DETAIL_BASE).map(([list, base]) => [base, list])));

/** A link to an ingredient's page, or the words for one that is gone. @param {Kitchen} k @param {string} id */
const ingLink = (k, id) => {
  const ing = k.ingredients.find((i) => i.id === id);
  return ing ? itemLink("ingredients", ing) : h("span", { class: "kp-kv__none" }, ingredientName(id));
};

/** A list of links, or the words for none. @param {HTMLElement[]} links @param {string} none */
const linkList = (links, none) => (links.length ? h("ul", { class: "it-links" }, ...links.map((a) => h("li", null, a))) : h("span", { class: "kp-kv__none" }, none));
/** @param {number} n @param {string} one @param {string} many */
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
/** @param {string} id */
const recipeLink = (id) => {
  const r = kitchenNow()?.recipes.find((x) => x.id === id);
  return r ? itemLink("recipes", r) : h("span", { class: "kp-kv__none" }, id ? "A recipe that was deleted" : "None");
};
/** The created and updated moments, as dd/mm/yyyy HH:mm. @param {Item} item */
const stamps = (item) =>
  /** @type {[string, Node | string][]} */ ([
    ["Added", item.created ? agoMoment(Date.parse(item.created)) : "–"],
    ["Last changed", item.updated ? agoMoment(Date.parse(item.updated)) : "Not changed since"],
  ]);

const hasIt = dishHas;
/** Does a recipe have a line with the ingredient? @param {Item} r @param {string} id */
const inRecipe = (r, id) => (r.ingredients ?? []).some((/** @type {Item} */ l) => l.ingredient === id);

/**
 * The facts of an item, as [key, value] rows.
 * @param {Exclude<List, "recipes">} list @param {Item} item @param {Kitchen} k
 * @returns {[string, Node | string][]}
 */
function facts(list, item, k) {
  switch (list) {
    case "dishes": {
      const n = names(item);
      const cat = k.dish_categories.find((c) => c.id === item.category);
      const on = languages(item);
      const sides = /** @type {Item[]} */ (item.sides ?? []);
      return [
        ["Dutch name", n.nl || "–"],
        ["English name", n.en || "–"],
        ["Category", cat ? itemLink("dish_categories", cat) : "No category"],
        ["Parents' wheel", item.parents !== true ? "Not on the wheel" : on === "both" ? "On the Dutch and the English wheel" : on === "nl" ? "Only on the Dutch wheel (no English name)" : "Only on the English wheel (no Dutch name)"],
        ["Recipe", item.recipe_id ? recipeLink(item.recipe_id) : "No recipe"],
        ["Always with it", linkList(/** @type {string[]} */ (item.ingredients ?? []).map((id) => ingLink(k, id)), "Nothing fixed")],
        [
          "Sides",
          sides.length
            ? h(
                "ol",
                { class: "it-links" },
                ...sides.map((s) => {
                  const own = String(s.label?.en || s.label?.nl || "").trim();
                  const ids = /** @type {string[]} */ (s.ingredients ?? []);
                  return h("li", null, own ? `${own}: ` : "", ...ids.flatMap((id, i) => [i ? (i === ids.length - 1 ? " and " : ", ") : "", ingLink(k, id)]));
                }),
              )
            : "No sides",
        ],
        ["Small wheel", sides.length > 1 ? `Picks one of ${sides.length} sides: ${sides.map(sideName).join("; ")}` : sides.length === 1 ? "One side, so nothing to spin" : "Nothing to spin"],
        ...stamps(item),
      ];
    }
    case "dish_categories": {
      const n = names(item);
      const dishes = k.dishes.filter((d) => d.category === item.id);
      return [
        ["Dutch name", n.nl || "–"],
        ["English name", n.en || "–"],
        ["Position", String(ordered(k.dish_categories).findIndex((c) => c.id === item.id) + 1)],
        ["Dishes", linkList(dishes.map((d) => itemLink("dishes", d)), "No dish uses it")],
        ...stamps(item),
      ];
    }
    case "ingredients": {
      const n = names(item);
      const cat = k.ingredient_categories.find((c) => c.id === item.category);
      return [
        ["Dutch name", n.nl || "–"],
        ["English name", n.en || "–"],
        ["Category", cat ? itemLink("ingredient_categories", cat) : "No category"],
        ["Dishes", String(k.dishes.filter((d) => hasIt(d, item.id)).length)],
        ["Recipes", String(k.recipes.filter((r) => inRecipe(r, item.id)).length)],
        ...stamps(item),
      ];
    }
    case "ingredient_categories": {
      const n = names(item);
      const ings = k.ingredients.filter((i) => i.category === item.id).sort((a, b) => ingredientName(a.id).localeCompare(ingredientName(b.id)));
      return [
        ["Dutch name", n.nl || "–"],
        ["English name", n.en || "–"],
        ["Position", String(ordered(k.ingredient_categories).findIndex((c) => c.id === item.id) + 1)],
        ["Ingredients", linkList(ings.map((i) => itemLink("ingredients", i)), "No ingredient is in it")],
        ...stamps(item),
      ];
    }
    case "freezer": {
      const at = Date.parse(item.frozen_on);
      const days = Math.floor((Date.now() - at) / 86_400_000);
      return [
        ["Dish", String(item.dish)],
        ["Recipe", item.recipe_id ? recipeLink(item.recipe_id) : "No recipe"],
        ["Portions left", String(item.portions)],
        ["Frozen on", dmy(brusselsDay(item.frozen_on))],
        ["In the freezer for", Number.isFinite(days) ? count(Math.max(0, days), "day", "days") : "–"],
        ...stamps(item),
      ];
    }
    case "shelf": {
      const eaten = k.log.filter((e) => e.shelf_id === item.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      return [
        ["Name", String(item.title)],
        ["What to do", item.text || "–"],
        ["Minutes", String(item.minutes ?? 0)],
        ["What it uses", item.gear || "–"],
        ["How much it asks", ENERGY[item.energy] ?? "–"],
        ["Eaten", linkList(eaten.map((e) => itemLink("log", e, dmy(e.date))), "Not logged yet")],
        ...stamps(item),
      ];
    }
    case "log": {
      const shelf = item.shelf_id ? k.shelf.find((s) => s.id === item.shelf_id) : null;
      return [
        ["What", item.shelf_id ? (shelf ? itemLink("shelf", shelf) : logWhat(item)) : recipeLink(item.recipe_id)],
        ["Kind", item.shelf_id ? "A food from the zero-prep shelf" : "A recipe that was cooked"],
        ["Day", dmy(item.date)],
        ["How did it feel?", item.feeling ? (FEELING[item.feeling] ?? item.feeling) : "No answer"],
        ["Note", item.note || "–"],
        ...stamps(item),
      ];
    }
    case "resting": {
      const back = item.until ? new Date(Date.parse(`${item.until}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10) : "";
      return [
        ["Recipe", recipeLink(item.recipe_id)],
        ["Resting until", dmy(item.until)],
        ["Back on the wheel", back ? dmy(back) : "–"],
        ...stamps(item),
      ];
    }
  }
}

/**
 * An ingredient's dishes and recipes: one data table with a search and four filters (the dish's category, on the
 * parents' wheel, safe, has a recipe), and a wheel that picks only among the dishes with it.
 * @param {HTMLElement} pageEl @param {string} id
 */
function usedBy(pageEl, id) {
  const t = tableCard({
    id: "it-used",
    title: "Dishes and recipes with it",
    lede: "Every dish that has it as a side and every recipe that has it as a line. Narrow the list with the filters; a name opens its page.",
    noun: "dish or recipe",
    plural: "dishes and recipes",
    columns: [["Name", "text"], ["Kind", "text"], ["Category", "text"], ["Parents' wheel", "text"], ["Safe", "text"], ["Recipe"]],
    add: "Add a dish",
    emptyTitle: "No dish or recipe has it yet",
    emptyText: "Add it as a side to a dish, or as a line to a recipe, and it shows here.",
  });
  t.addButtons.forEach((b) => b.addEventListener("click", () => openRecordEditor("dishes", null)));
  const cat = /** @type {HTMLSelectElement} */ (h("select", { class: "kp-field__input", "aria-label": "Dish category" }));
  const flags = h(
    "div",
    { class: "kp-segmented kp-segmented--chips", "data-kp-segmented": "multi", role: "group", "aria-label": "Show only" },
    ...[["parents", "On the parents' wheel"], ["safe", "Safe"], ["recipe", "Has a recipe"]].map(([v, text]) =>
      h("button", { type: "button", class: "kp-segmented__item", "data-value": v, "aria-pressed": "false" }, h("span", { class: "kp-segmented__label" }, text)),
    ),
  );
  const filters = h("div", { class: "kp-formgrid kitchen-formgrid it-filters" }, h("div", { class: "kp-formgrid__row" }, h("span", { class: "kp-formgrid__label" }, "Category"), h("div", { class: "kp-formgrid__control" }, cat)), h("div", { class: "kp-formgrid__row" }, h("span", { class: "kp-formgrid__label" }, "Show only"), h("div", { class: "kp-formgrid__control" }, flags)));
  t.card.querySelector(".kp-lede")?.after(filters);

  const wheel = h("div", { class: "kp-wheel", "data-kp-wheel": true, "data-kp-wheel-kiosk": true, "data-kp-wheel-answer": true, "data-kp-wheel-empty": "No dish has it yet: add it as a side to a dish.", "aria-label": "A dish with this ingredient" });
  const wheelCard = h(
    "section",
    { class: "kp-card it-wheel", "aria-labelledby": "it-wheel-t" },
    h("div", { class: "kp-card__header" }, h("h2", { class: "kp-card__title", id: "it-wheel-t" }, "A wheel of its dishes")),
    h("p", { class: "kp-card__body" }, "Tap the wheel and it picks one of the dishes with this ingredient, as the parents' wheel does with all of them."),
    wheel,
  );
  pageEl.append(t.card, wheelCard);
  const stops = [attachDataTables(t.card), attachSegmented(filters), attachSelects(filters), attachWheels(wheelCard)].filter((f) => typeof f === "function");
  const handle = dataTable(t.table);
  /** @type {Kitchen | null} */
  let kitchen = null;

  const draw = () => {
    const k = kitchen;
    if (!k) return;
    const on = new Set(getSegmentedValues(flags));
    const recipeOf = (/** @type {Item} */ d) => k.recipes.find((r) => r.id === d.recipe_id) ?? null;
    /** @type {{ kind: "dish" | "recipe", item: Item, category: string | null, parents: boolean | null, safe: boolean, recipe: Item | null }[]} */
    const rows = [
      ...k.dishes.filter((d) => hasIt(d, id)).map((d) => ({ kind: /** @type {const} */ ("dish"), item: d, category: d.category ?? null, parents: d.parents === true, safe: recipeOf(d)?.safe === true, recipe: recipeOf(d) })),
      ...k.recipes.filter((r) => inRecipe(r, id)).map((r) => ({ kind: /** @type {const} */ ("recipe"), item: r, category: null, parents: null, safe: r.safe === true, recipe: r })),
    ].filter((x) => (!cat.value || x.category === cat.value) && (!on.has("parents") || x.parents === true) && (!on.has("safe") || x.safe) && (!on.has("recipe") || x.recipe));
    t.body.replaceChildren(
      ...rows.map((x) => {
        const c = k.dish_categories.find((y) => y.id === x.category);
        return h(
          "tr",
          { "data-kp-row-key": x.item.id },
          h("td", { "data-label": "Name" }, x.kind === "dish" ? itemLink("dishes", x.item) : itemLink("recipes", x.item)),
          h("td", { "data-label": "Kind" }, x.kind === "dish" ? "Dish" : "Recipe"),
          h("td", { "data-label": "Category" }, c ? itemLink("dish_categories", c) : "–"),
          h("td", { "data-label": "Parents' wheel" }, x.parents === null ? "–" : x.parents ? "Yes" : "No"),
          h("td", { "data-label": "Safe" }, x.safe ? "Yes" : "No"),
          h("td", { "data-label": "Recipe" }, x.recipe ? itemLink("recipes", x.recipe) : "–"),
        );
      }),
    );
    handle?.refresh({ keepPage: true });
    handle?.state("ready");
    setWheelItems(wheel, k.dishes.filter((d) => hasIt(d, id)).map((d) => ({ id: d.id, label: LISTS.dishes.name(d) })));
  };
  cat.addEventListener("change", draw);
  flags.addEventListener(SEGMENTED_EVENT, draw);
  handle?.busy({ text: "Reading the dishes", overlay: true });
  handle?.state("loading");
  return {
    /** @param {Kitchen} k */
    show(k) {
      kitchen = k;
      const was = cat.value;
      cat.replaceChildren(h("option", { value: "" }, "Every category"), ...ordered(k.dish_categories).map((c) => h("option", { value: c.id }, LISTS.dish_categories.name(c))));
      cat.value = was;
      draw();
    },
    /** @param {string} why */
    fail(why) {
      handle?.fail(why);
    },
    stop() {
      for (const s of stops) s();
    },
  };
}

/**
 * @param {HTMLElement} root
 * @param {{ params: URLSearchParams, navigate: (href: string) => void }} ctx
 */
export function mount(root, { params, navigate }) {
  const list = BY_BASE[params.get("list") ?? ""];
  const id = params.get("id") ?? "";
  const meta = LISTS[list];
  const [homeHref, homeName] = meta.home;
  let alive = true;

  const crumb = h("nav", { class: "kp-breadcrumb", "aria-label": "Breadcrumb" }, h("ol", null, h("li", null, h("a", { href: homeHref }, homeName)), h("li", { "aria-current": "page" }, meta.noun)));
  const title = h("h1", { class: "kp-page-header__title" }, "…");
  const edit = h("button", { type: "button", class: "kp-button" }, "Edit");
  const del = h("button", { type: "button", class: "kp-button kp-button--destructive" }, "Delete");
  const head = h(
    "header",
    { class: "kp-page-header" },
    crumb,
    h("div", { class: "kp-page-header__inner" }, h("div", null, title, h("p", { class: "kp-page-header__description" }, `Everything Kitchen keeps about this ${meta.noun}.`)), h("div", { class: "kp-page-header__actions" }, edit, del)),
  );
  const kv = h("dl", { class: "kp-kv kp-kv--lines" });
  const card = h(
    "section",
    { class: "kp-card it-card", "data-kp-state": "loading", "data-kp-loading-words": `Reading the ${meta.noun}`, "aria-labelledby": "it-card-t" },
    h("div", { class: "kp-card__header" }, h("h2", { class: "kp-card__title", id: "it-card-t" }, "Details")),
    h("div", { class: "kp-card__stage" }, h("div", { class: "kp-card__data" }, kv)),
  );
  const pageEl = h("div", { class: "it-page" }, head, card);
  root.replaceChildren(pageEl);
  const stopCard = attachCardStates(card);
  const extra = list === "ingredients" ? usedBy(pageEl, id) : null;

  /** @type {Item | null} */
  let item = null;
  const setActions = (on) => {
    for (const b of [edit, del]) {
      if (on) b.removeAttribute("aria-disabled");
      else b.setAttribute("aria-disabled", "true");
    }
  };
  setActions(false);
  edit.addEventListener("click", () => item && edit.getAttribute("aria-disabled") !== "true" && openRecordEditor(list, item));
  del.addEventListener("click", () => item && del.getAttribute("aria-disabled") !== "true" && deleteRecord(del, list, item, { after: () => navigate(homeHref) }));

  /** @param {Kitchen} k */
  function show(k) {
    item = /** @type {Item[]} */ (k[list] ?? []).find((x) => x.id === id) ?? null;
    if (!item) {
      title.textContent = `This ${meta.noun} does not exist`;
      document.title = `Not found · Kitchen`;
      setActions(false);
      const back = h("a", { class: "kp-button kp-button--primary", href: homeHref }, `Open ${homeName}`);
      setCardState(card, "empty", { title: `No ${meta.noun} here`, text: `It may have been deleted, or the address is old. ${homeName} lists every one that is kept.`, action: back });
      return;
    }
    const name = meta.name(item);
    title.textContent = name;
    document.title = `${name} · Kitchen`;
    kv.replaceChildren(...facts(list, item, k).map(([key, value]) => h("div", { class: "kp-kv__row" }, h("dt", null, key), h("dd", null, value))));
    setActions(true);
    setCardState(card, "ready");
    extra?.show(k);
  }

  /** @param {boolean} [force] */
  function load(force = false) {
    if (force) setCardState(card, "loading");
    loadKitchen({ force }).then(
      (k) => alive && show(k),
      (e) => {
        if (!alive) return;
        extra?.fail(e instanceof Error ? e.message : String(e));
        setActions(false);
        setCardState(card, "error", { title: `The ${meta.noun} could not be read`, text: e instanceof Error ? e.message : String(e) });
      },
    );
  }
  const retry = () => load(true);
  card.addEventListener(CARD_RETRY_EVENT, retry);
  const stop = onKitchen((k) => alive && show(k));
  load();

  return () => {
    alive = false;
    stop();
    stopCard();
    extra?.stop();
    card.removeEventListener(CARD_RETRY_EVENT, retry);
  };
}

