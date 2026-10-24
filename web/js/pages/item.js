// One item's own page (Kenny, 24/10/2026 05:08): `/dishes/<id>`, `/categories/<id>`, `/freezer/<id>`, `/shelf/<id>`,
// `/log/<id>` and `/resting/<id>` (js/main.js routes them here; a recipe keeps its own page, /recipe?id=…). The page
// header carries a crumb back to the list, the item's name and Edit and Delete; one card shows every field as the
// package's key-value list, with links to what the item points at and what points at it. The card has the package's
// loading and failed states; an item that does not exist (any more) is an empty plate with the way back.

import { attachCardStates, setCardState, CARD_RETRY_EVENT } from "/static/kp/js/card-state.js";
import { agoMoment } from "/static/kp/js/freshness.js";
import { loadKitchen, onKitchen, kitchenNow } from "../api.js";
import { h } from "../dom.js";
import { LISTS, DETAIL_BASE, itemLink, openRecordEditor, deleteRecord, dmy, brusselsDay, ENERGY, FEELING, logWhat } from "../records.js";
import { names, languages, ordered } from "../dishes/editor.js";

/** @typedef {import("../api.js").Kitchen} Kitchen */
/** @typedef {import("../records.js").List} List */
/** @typedef {Record<string, any>} Item */

/** The list behind a path word. */
const BY_BASE = /** @type {Record<string, Exclude<List, "recipes">>} */ (Object.fromEntries(Object.entries(DETAIL_BASE).map(([list, base]) => [base, list])));

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
        [
          "Sides",
          sides.length
            ? h(
                "ul",
                { class: "it-links" },
                ...sides.map((s) =>
                  h("li", null, `${names(s).nl || "–"} · ${names(s).en || "–"} `, s.choice === true ? h("span", { class: "kp-badge kp-badge--success" }, "Choice") : h("span", { class: "kp-badge" }, "Always")),
                ),
              )
            : "No sides",
        ],
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
  root.replaceChildren(h("div", { class: "it-page" }, head, card));
  const stopCard = attachCardStates(card);

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
  }

  /** @param {boolean} [force] */
  function load(force = false) {
    if (force) setCardState(card, "loading");
    loadKitchen({ force }).then(
      (k) => alive && show(k),
      (e) => {
        if (!alive) return;
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
    card.removeEventListener(CARD_RETRY_EVENT, retry);
  };
}

