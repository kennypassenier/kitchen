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
import { mountDishWheel } from "/eten/dishwheel.js";
import { attachSegmented, getSegmentedValues, SEGMENTED_EVENT } from "/static/kp/js/segmented.js";
import { attachSelects } from "/static/kp/js/combobox.js";
import { loadKitchen, onKitchen, kitchenNow, ingredientName, defaultRecipe, makeDefaultRecipe, recipeLabel, remove, ApiError } from "../api.js";
import { toast } from "/static/kp/js/overlays.js";
import { openConfirmation } from "/static/kp/js/components.js";
import { h } from "../dom.js";
import { LISTS, DETAIL_BASE, itemLink, missingBadge, openRecordEditor, openRecipeEditor, BLANK_RECIPE, deleteRecord, dmy, brusselsDay, energies, feelings, logWhat, tableCard, sideName, dishHas } from "../records.js";
import { t, textOf } from "../i18n/index.js";
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
/** A link to a dish's page, or the words for one that is gone. @param {string | null | undefined} id */
const dishLink = (id) => {
  const d = id ? kitchenNow()?.dishes.find((x) => x.id === id) : null;
  return d ? itemLink("dishes", d) : h("span", { class: "kp-kv__none" }, id ? t("rec.goneDish") : t("it.none"));
};
/** The created and updated moments, as dd/mm/yyyy HH:mm. @param {Item} item */
const stamps = (item) =>
  /** @type {[string, Node | string][]} */ ([
    [t("it.added"), item.created ? agoMoment(Date.parse(item.created)) : "–"],
    [t("it.changed"), item.updated ? agoMoment(Date.parse(item.updated)) : t("it.notChanged")],
  ]);

const hasIt = dishHas;
/** Does one of a dish's recipes have a line with the ingredient? @param {Item} d @param {string} id */
const inRecipe = (d, id) => (d.recipes ?? []).some((/** @type {Item} */ r) => (r.ingredients ?? []).some((/** @type {Item} */ l) => l.ingredient === id));

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
        [t("rec.dutchName"), n.nl || "–"],
        [t("rec.englishName"), n.en || "–"],
        [t("rec.category"), cat ? itemLink("dish_categories", cat) : t("it.noCategory")],
        [t("it.parentsWheel"), t(item.parents !== true ? "it.wheelOff" : on === "both" ? "it.wheelBoth" : on === "nl" ? "it.wheelNl" : "it.wheelEn")],
        [t("nav.recipes"), String((item.recipes ?? []).length)],
        [t("it.always"), linkList(/** @type {string[]} */ (item.ingredients ?? []).map((id) => ingLink(k, id)), t("it.nothingFixed"))],
        [
          t("it.sides"),
          sides.length
            ? h(
                "ol",
                { class: "it-links" },
                ...sides.map((s) => {
                  const own = String(s.label?.en || s.label?.nl || "").trim();
                  const ids = /** @type {string[]} */ (s.ingredients ?? []);
                  return h("li", null, own ? `${own}: ` : "", ...ids.flatMap((id, i) => [i ? (i === ids.length - 1 ? ` ${t("common.and")} ` : ", ") : "", ingLink(k, id)]));
                }),
              )
            : t("it.noSides"),
        ],
        [t("it.smallWheel"), sides.length > 1 ? t("it.picksOne", sides.length, sides.map(sideName).join("; ")) : t(sides.length === 1 ? "it.oneSide" : "it.noSpin")],
        ...stamps(item),
      ];
    }
    case "dish_categories": {
      const n = names(item);
      const dishes = k.dishes.filter((d) => d.category === item.id);
      return [
        [t("rec.dutchName"), n.nl || "–"],
        [t("rec.englishName"), n.en || "–"],
        [t("it.position"), String(ordered(k.dish_categories).findIndex((c) => c.id === item.id) + 1)],
        [t("nav.dishes"), linkList(dishes.map((d) => itemLink("dishes", d)), t("it.noDishUses"))],
        ...stamps(item),
      ];
    }
    case "ingredients": {
      const n = names(item);
      const cat = k.ingredient_categories.find((c) => c.id === item.category);
      return [
        [t("rec.dutchName"), n.nl || "–"],
        [t("rec.englishName"), n.en || "–"],
        [t("rec.category"), cat ? itemLink("ingredient_categories", cat) : t("it.noCategory")],
        [t("nav.dishes"), String(k.dishes.filter((d) => hasIt(d, item.id)).length)],
        [t("it.inRecipes"), String(k.dishes.filter((d) => inRecipe(d, item.id)).length)],
        ...stamps(item),
      ];
    }
    case "ingredient_categories": {
      const n = names(item);
      const ings = k.ingredients.filter((i) => i.category === item.id).sort((a, b) => ingredientName(a.id).localeCompare(ingredientName(b.id)));
      return [
        [t("rec.dutchName"), n.nl || "–"],
        [t("rec.englishName"), n.en || "–"],
        [t("it.position"), String(ordered(k.ingredient_categories).findIndex((c) => c.id === item.id) + 1)],
        [t("nav.ingredients"), linkList(ings.map((i) => itemLink("ingredients", i)), t("it.noIngIn"))],
        ...stamps(item),
      ];
    }
    case "freezer": {
      const at = Date.parse(item.frozen_on);
      const days = Math.floor((Date.now() - at) / 86_400_000);
      return [
        [t("rec.dish"), textOf(item.dish)],
        [t("rec.dishLink"), item.dish_id ? dishLink(item.dish_id) : t("rec.noDish")],
        [t("it.portionsLeft"), String(item.portions)],
        [t("rec.frozenOn"), dmy(brusselsDay(item.frozen_on))],
        [t("it.inFreezerFor"), Number.isFinite(days) ? t("it.days", Math.max(0, days)) : "–"],
        ...stamps(item),
      ];
    }
    case "shelf": {
      const eaten = k.log.filter((e) => e.shelf_id === item.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      return [
        [t("rec.name"), textOf(item.title)],
        [t("rec.whatToDo"), textOf(item.text) || "–"],
        [t("rec.minutes"), String(item.minutes ?? 0)],
        [t("rec.gear"), textOf(item.gear) || "–"],
        [t("rec.energy"), energies()[item.energy] ?? "–"],
        [t("it.eaten"), linkList(eaten.map((e) => itemLink("log", e, dmy(e.date))), t("it.notLogged"))],
        ...stamps(item),
      ];
    }
    case "log": {
      const shelf = item.shelf_id ? k.shelf.find((s) => s.id === item.shelf_id) : null;
      return [
        [t("rec.what"), item.shelf_id ? (shelf ? itemLink("shelf", shelf) : logWhat(item)) : dishLink(item.dish_id)],
        [t("it.kind"), t(item.shelf_id ? "it.kindShelf" : "it.kindRecipe")],
        [t("rec.day"), dmy(item.date)],
        [t("rec.howFelt"), item.feeling ? (feelings()[item.feeling] ?? item.feeling) : t("rec.noAnswer")],
        [t("rec.note"), item.note || "–"],
        ...stamps(item),
      ];
    }
    case "resting": {
      const back = item.until ? new Date(Date.parse(`${item.until}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10) : "";
      return [
        [t("rec.dish"), dishLink(item.dish_id)],
        [t("rec.restingUntil"), dmy(item.until)],
        [t("it.back"), back ? dmy(back) : "–"],
        ...stamps(item),
      ];
    }
  }
}

/**
 * A dish's recipes (Kenny, 24/10/2026 09:18, 09:27: the recipe belongs to the dish, and a dish may have several, one
 * the default): one row per recipe with its label, Open, Cook, Make default, Edit and Delete, and Add a recipe.
 * @param {HTMLElement} pageEl
 */
function dishRecipes(pageEl) {
  const add = h("button", { type: "button", class: "kp-button kp-button--primary" }, t("it.addRecipe"));
  const listEl = h("ul", { class: "kp-action-list it-recipes" });
  const card = h(
    "section",
    { class: "kp-card it-card", "data-kp-state": "ready", "aria-labelledby": "it-recipes-t" },
    h("div", { class: "kp-card__header" }, h("h2", { class: "kp-card__title", id: "it-recipes-t" }, t("nav.recipes")), h("div", { class: "kp-card__actions" }, add)),
    h("p", { class: "kp-card__body" }, t("it.recipesLede")),
    h("div", { class: "kp-card__stage" }, h("div", { class: "kp-card__data" }, listEl)),
  );
  pageEl.append(card);
  const stopCard = attachCardStates(card);
  /** @type {Item | null} */
  let dish = null;
  add.addEventListener("click", () => {
    if (!dish) return;
    openRecipeEditor(null, { ...BLANK_RECIPE, dish_id: dish.id });
  });
  return {
    /** @param {Kitchen} k @param {Item} d */
    show(k, d) {
      dish = d;
      const recipes = /** @type {Item[]} */ (d.recipes ?? []);
      if (!recipes.length) {
        const first = h("button", { type: "button", class: "kp-button kp-button--primary" }, t("it.addRecipe"));
        first.addEventListener("click", () => add.click());
        setCardState(card, "empty", { title: t("it.noRecipeYet"), text: t("it.noRecipeText"), action: first });
        return;
      }
      listEl.replaceChildren(
        ...recipes.map((r, i) => {
          const view = k.recipes.find((x) => x.id === r.id) ?? r;
          const label = recipeLabel(r, i);
          const edit = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": t("rec.editName", label) }, t("common.edit"));
          edit.addEventListener("click", () => openRecipeEditor(view));
          const del = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--destructive", "aria-label": t("rec.deleteName", label) }, t("common.delete"));
          del.addEventListener("click", () =>
            openConfirmation(del, {
              phrase: t("rec.deleteAsk", view.name),
              typeName: label,
              acceptLabel: t("list.recipes.delete"),
              loses: [t("it.recipeLoses")],
              onAccept: () => void remove("recipes", r.id).then(() => toast(t("rec.deleted", view.name)), (e) => toast(t("rec.notDeleted", e instanceof ApiError ? e.message : String(e)), { live: "assertive", sticky: true })),
            }),
          );
          const isDefault = r.default === true || (i === 0 && !recipes.some((x) => x.default === true));
          const def = isDefault
            ? h("span", { class: "kp-badge kp-badge--success" }, t("it.default"))
            : h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": t("it.makeDefaultName", label) }, t("it.makeDefault"));
          if (!isDefault) def.addEventListener("click", () => void makeDefaultRecipe(r.id).catch((e) => toast(String(e), { live: "assertive" })));
          return h(
            "li",
            { "data-key": r.id },
            h("span", { class: "kp-action-list__lead" }, h("span", { class: "kp-badge" }, `${r.minutes ?? 0} min`)),
            h("div", { class: "kp-action-list__main" }, h("strong", { class: "kp-action-list__title" }, h("a", { href: `/recipe?id=${encodeURIComponent(r.id)}` }, label)), h("span", { class: "kp-action-list__text" }, r.summary || "")),
            h("div", { class: "kp-row-actions" }, def, h("a", { class: "kp-button kp-button--sm kp-button--primary", href: `/cook?id=${encodeURIComponent(r.id)}` }, t("it.cook")), edit, del),
          );
        }),
      );
      setCardState(card, "ready");
    },
    stop: stopCard,
  };
}

/**
 * An ingredient's dishes and recipes: one data table with a search and four filters (the dish's category, on the
 * parents' wheel, safe, has a recipe), and a wheel that picks only among the dishes with it.
 * @param {HTMLElement} pageEl @param {string} id
 */
function usedBy(pageEl, id) {
  const table = tableCard({
    id: "it-used",
    title: t("it.usedTitle"),
    lede: t("it.usedLede"),
    noun: t("it.usedNoun"),
    plural: t("it.usedPlural"),
    columns: [[t("rec.name"), "text"], [t("it.kind"), "text"], [t("rec.category"), "text"], [t("it.parentsWheel"), "text"], [t("it.safe"), "text"], [t("rec.recipe")]],
    add: t("list.dishes.add"),
    emptyTitle: t("it.usedEmpty"),
    emptyText: t("it.usedEmptyText"),
  });
  table.addButtons.forEach((b) => b.addEventListener("click", () => openRecordEditor("dishes", null)));
  const cat = /** @type {HTMLSelectElement} */ (h("select", { class: "kp-field__input", "aria-label": t("it.dishCategory") }));
  const flags = h(
    "div",
    { class: "kp-segmented kp-segmented--chips", "data-kp-segmented": "multi", role: "group", "aria-label": t("it.showOnly") },
    ...[["parents", t("it.onParents")], ["safe", t("it.safe")], ["recipe", t("it.hasRecipe")]].map(([v, text]) =>
      h("button", { type: "button", class: "kp-segmented__item", "data-value": v, "aria-pressed": "false" }, h("span", { class: "kp-segmented__label" }, text)),
    ),
  );
  const filters = h("div", { class: "kp-formgrid kitchen-formgrid it-filters" }, h("div", { class: "kp-formgrid__row" }, h("span", { class: "kp-formgrid__label" }, t("rec.category")), h("div", { class: "kp-formgrid__control" }, cat)), h("div", { class: "kp-formgrid__row" }, h("span", { class: "kp-formgrid__label" }, t("it.showOnly")), h("div", { class: "kp-formgrid__control" }, flags)));
  table.card.querySelector(".kp-lede")?.after(filters);

  // The one wheel component (web/eten/dishwheel.js): one wheel among the dishes, no side wheel and no answer column; its own
  // answer card stands under it.
  const wheelHost = h("div", {});
  const wheels = mountDishWheel(wheelHost, { sides: false, answer: false, kiosk: true, cards: true, words: { dishLabel: t("it.wheelLabel"), dishEmpty: t("it.wheelEmpty") } });
  const wheelCard = h(
    "section",
    { class: "kp-card it-wheel", "aria-labelledby": "it-wheel-t" },
    h("div", { class: "kp-card__header" }, h("h2", { class: "kp-card__title", id: "it-wheel-t" }, t("it.wheelTitle"))),
    h("p", { class: "kp-card__body" }, t("it.wheelText")),
    wheelHost,
  );
  pageEl.append(table.card, wheelCard);
  const stops = [attachDataTables(table.card), attachSegmented(filters), attachSelects(filters), () => wheels.destroy()].filter((f) => typeof f === "function");
  const handle = dataTable(table.table);
  /** @type {Kitchen | null} */
  let kitchen = null;

  const draw = () => {
    const k = kitchen;
    if (!k) return;
    const on = new Set(getSegmentedValues(flags));
    // One row per dish that has it: fixed, in a side, or as a line of its recipe (the recipe belongs to the dish).
    /** @type {{ kind: string, item: Item, category: string | null, parents: boolean | null, safe: boolean, recipe: Item | null }[]} */
    const rows = k.dishes
      .filter((d) => hasIt(d, id) || inRecipe(d, id))
      .map((d) => ({
        kind: [hasIt(d, id) ? t("it.inDish") : "", inRecipe(d, id) ? t("it.inRecipe") : ""].filter(Boolean).join(", "),
        item: d,
        category: d.category ?? null,
        parents: d.parents === true,
        safe: defaultRecipe(d)?.safe === true,
        recipe: defaultRecipe(d),
      }))
      .filter((x) => (!cat.value || x.category === cat.value) && (!on.has("parents") || x.parents === true) && (!on.has("safe") || x.safe) && (!on.has("recipe") || x.recipe));
    table.body.replaceChildren(
      ...rows.map((x) => {
        const c = k.dish_categories.find((y) => y.id === x.category);
        return h(
          "tr",
          { "data-kp-row-key": x.item.id },
          h("td", { "data-label": t("rec.name") }, itemLink("dishes", x.item)),
          h("td", { "data-label": t("it.kind") }, x.kind),
          h("td", { "data-label": t("rec.category") }, c ? itemLink("dish_categories", c) : "–"),
          h("td", { "data-label": t("it.parentsWheel") }, x.parents === null ? "–" : t(x.parents ? "it.yes" : "it.no")),
          h("td", { "data-label": t("it.safe") }, t(x.safe ? "it.yes" : "it.no")),
          h("td", { "data-label": t("rec.recipe") }, x.recipe ? h("a", { href: `/recipe?id=${encodeURIComponent(x.recipe.id)}` }, t("it.openRecipe")) : "–"),
        );
      }),
    );
    handle?.refresh({ keepPage: true });
    handle?.state("ready");
    wheels.setDishes(k.dishes.filter((d) => hasIt(d, id) || inRecipe(d, id)).map((d) => ({ id: d.id, label: LISTS.dishes.name(d) })));
  };
  cat.addEventListener("change", draw);
  flags.addEventListener(SEGMENTED_EVENT, draw);
  handle?.busy({ text: t("it.readingDishes"), overlay: true });
  handle?.state("loading");
  return {
    /** @param {Kitchen} k */
    show(k) {
      kitchen = k;
      const was = cat.value;
      cat.replaceChildren(h("option", { value: "" }, t("it.everyCategory")), ...ordered(k.dish_categories).map((c) => h("option", { value: c.id }, LISTS.dish_categories.name(c))));
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

  const crumb = h("nav", { class: "kp-breadcrumb", "aria-label": t("it.crumb") }, h("ol", null, h("li", null, h("a", { href: homeHref }, homeName)), h("li", { "aria-current": "page" }, meta.noun)));
  const title = h("h1", { class: "kp-page-header__title" }, "…");
  const edit = h("button", { type: "button", class: "kp-button" }, t("common.edit"));

  const del = h("button", { type: "button", class: "kp-button kp-button--destructive" }, t("common.delete"));
  const head = h(
    "header",
    { class: "kp-page-header" },
    crumb,
    h("div", { class: "kp-page-header__inner" }, h("div", null, title, h("p", { class: "kp-page-header__description" }, t("it.keeps", meta.this))), h("div", { class: "kp-page-header__actions" }, edit, del)),
  );
  const kv = h("dl", { class: "kp-kv kp-kv--lines" });
  const card = h(
    "section",
    { class: "kp-card it-card", "data-kp-state": "loading", "data-kp-loading-words": t("it.reading", meta.the), "aria-labelledby": "it-card-t" },
    h("div", { class: "kp-card__header" }, h("h2", { class: "kp-card__title", id: "it-card-t" }, t("it.details"))),
    h("div", { class: "kp-card__stage" }, h("div", { class: "kp-card__data" }, kv)),
  );
  const pageEl = h("div", { class: "it-page" }, head, card);
  root.replaceChildren(pageEl);
  const stopCard = attachCardStates(card);
  const extra = list === "ingredients" ? usedBy(pageEl, id) : null;
  const recipesCard = list === "dishes" ? dishRecipes(pageEl) : null;

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
      title.textContent = t("it.notThere", meta.this);
      document.title = `${t("shell.notFoundTitle")} · Kitchen`;
      setActions(false);
      const back = h("a", { class: "kp-button kp-button--primary", href: homeHref }, t("it.open", homeName));
      setCardState(card, "empty", { title: t("it.noneHere", meta.noun), text: t("it.noneHereText", homeName), action: back });
      return;
    }
    const name = meta.name(item);
    title.replaceChildren(name, ...(["dishes", "dish_categories", "ingredients", "ingredient_categories"].includes(list) ? [" ", missingBadge(list, item) ?? ""] : []));
    document.title = `${name} · Kitchen`;
    kv.replaceChildren(...facts(list, item, k).map(([key, value]) => h("div", { class: "kp-kv__row" }, h("dt", null, key), h("dd", null, value))));
    setActions(true);
    recipesCard?.show(k, item);
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
        setCardState(card, "error", { title: t("it.notRead", meta.the), text: e instanceof Error ? e.message : String(e) });
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
    recipesCard?.stop();
    card.removeEventListener(CARD_RETRY_EVENT, retry);
  };
}

