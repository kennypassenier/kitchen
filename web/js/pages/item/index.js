// One item's own page (Kenny, 24/10/2026 05:08): `/dishes/<id>`, `/categories/<id>`, `/ingredients/<id>`,
// `/ingredient-categories/<id>`, `/freezer/<id>`, `/shelf/<id>`, `/log/<id>` and `/resting/<id>` (js/main.js routes
// them here; a recipe keeps its own page, /recipe?id=…). An ingredient's page also lists every dish and recipe with
// it, with a search and filters, and has a wheel that picks only among those dishes (05:15). The page
// header carries a crumb back to the list, the item's name and Edit and Delete; one card shows every field as the
// package's key-value list, with links to what the item points at and what points at it. The card has the package's
// loading and failed states; an item that does not exist (any more) is an empty plate with the way back.


import { attachCardStates, setCardState, CARD_RETRY_EVENT } from "/static/kp/dist/kp-themes.min.js";
import { loadKitchen, onKitchen } from "../../api.js";
import { h } from "../../dom.js";
import { LISTS, DETAIL_BASE, missingBadge, openRecordEditor, openRecipeImport, duplicateDish, deleteRecord } from "../../records/index.js";
import { t } from "../../i18n/index.js";
import { facts } from "./facts.js";
import { dishRecipes } from "./dish-recipes.js";
import { usedBy } from "./used-by.js";

/** @typedef {import("../../api.js").Kitchen} Kitchen */
/** @typedef {import("../../records/index.js").List} List */
/** @typedef {Record<string, any>} Item */

/** The list behind a path word. */
const BY_BASE = /** @type {Record<string, Exclude<List, "recipes">>} */ (Object.fromEntries(Object.entries(DETAIL_BASE).map(([list, base]) => [base, list])));

/** The page header (crumb, title, actions) and the details card. @param {Exclude<List, "recipes">} list */
function buildPage(list) {
  const meta = LISTS[list];
  const [homeHref, homeName] = meta.home;
  const crumb = h("nav", { class: "kp-breadcrumb", "aria-label": t("it.crumb") }, h("ol", null, h("li", null, h("a", { href: homeHref }, homeName)), h("li", { "aria-current": "page" }, meta.noun)));
  const title = h("h1", { class: "kp-page-header__title" }, "…");
  const edit = h("button", { type: "button", class: "kp-button" }, t("common.edit"));
  // A dish can be duplicated from its own page (Kenny, 29/10/2026).
  const copy = list === "dishes" ? h("button", { type: "button", class: "kp-button" }, t("common.duplicate")) : null;
  const del = h("button", { type: "button", class: "kp-button kp-button--destructive" }, t("common.delete"));
  // A source opens the import with a pointer to its site (Kenny, 29/10/2026 15:11).
  const fromSite = list === "recipe_sources" ? h("button", { type: "button", class: "kp-button" }, t("src.import")) : null;
  const head = h(
    "header",
    { class: "kp-page-header" },
    crumb,
    h("div", { class: "kp-page-header__inner" }, h("div", null, title, h("p", { class: "kp-page-header__description" }, t("it.keeps", meta.this))), h("div", { class: "kp-page-header__actions" }, ...(fromSite ? [fromSite] : []), edit, ...(copy ? [copy] : []), del)),
  );
  const kv = h("dl", { class: "kp-kv kp-kv--lines" });
  const card = h(
    "section",
    { class: "kp-card it-card", "data-kp-state": "loading", "data-kp-loading-words": t("it.reading", meta.the), "aria-labelledby": "it-card-t" },
    h("div", { class: "kp-card__header" }, h("h2", { class: "kp-card__title", id: "it-card-t" }, t("it.details"))),
    h("div", { class: "kp-card__stage" }, h("div", { class: "kp-card__data" }, kv)),
  );
  return { title, edit, copy, del, fromSite, kv, card, pageEl: h("div", { class: "it-page" }, head, card) };
}

/** @param {Exclude<List, "recipes">} list @param {ReturnType<typeof buildPage>} p @param {{ item: Item | null }} cur @param {(href: string) => void} navigate */
function wireButtons(list, p, cur, navigate) {
  const { edit, copy, del, fromSite } = p;
  const off = (/** @type {HTMLElement} */ b) => b.getAttribute("aria-disabled") === "true";
  edit.addEventListener("click", () => cur.item && !off(edit) && openRecordEditor(list, cur.item));
  fromSite?.addEventListener("click", () => cur.item && openRecipeImport(null, cur.item));
  copy?.addEventListener("click", () => cur.item && !off(copy) && duplicateDish(cur.item));
  del.addEventListener("click", () => cur.item && !off(del) && deleteRecord(del, list, cur.item, { after: () => navigate(LISTS[list].home[0]) }));
}

/** @param {ReturnType<typeof buildPage>} p @param {boolean} on */
function setActions({ edit, copy, del, fromSite }, on) {
  for (const b of [edit, ...(copy ? [copy] : []), ...(fromSite ? [fromSite] : []), del]) {
    if (on) b.removeAttribute("aria-disabled");
    else b.setAttribute("aria-disabled", "true");
  }
}

/** @typedef {{ list: Exclude<List, "recipes">, id: string, meta: (typeof LISTS)[keyof typeof LISTS], p: ReturnType<typeof buildPage>, cur: { item: Item | null }, extra: ReturnType<typeof usedBy> | null, recipesCard: ReturnType<typeof dishRecipes> | null }} ItemView */

/** The item is not (any more) in the kitchen: an empty plate with the way back. @param {ItemView} v */
function showMissing({ meta, p }) {
  const [homeHref, homeName] = meta.home;
  p.title.textContent = t("it.notThere", meta.this);
  document.title = `${t("shell.notFoundTitle")} · Kitchen`;
  setActions(p, false);
  const back = h("a", { class: "kp-button kp-button--primary", href: homeHref }, t("it.open", homeName));
  setCardState(p.card, "empty", { title: t("it.noneHere", meta.noun), text: t("it.noneHereText", homeName), action: back });
}

/** @param {ItemView} v @param {Kitchen} k */
function showItem(v, k) {
  const { list, meta, p } = v;
  const item = /** @type {Item} */ (v.cur.item);
  const name = meta.name(item);
  p.title.replaceChildren(name, ...(["dishes", "dish_categories", "ingredients", "ingredient_categories"].includes(list) ? [" ", missingBadge(list, item) ?? ""] : []));
  document.title = `${name} · Kitchen`;
  p.kv.replaceChildren(...facts(list, item, k).map(([key, value]) => h("div", { class: "kp-kv__row" }, h("dt", null, key), h("dd", null, value))));
  setActions(p, true);
  v.recipesCard?.show(k, item);
  setCardState(p.card, "ready");
  v.extra?.show(k);
}

/** @param {ItemView} v @param {Kitchen} k */
function show(v, k) {
  v.cur.item = /** @type {Item[]} */ (k[v.list] ?? []).find((x) => x.id === v.id) ?? null;
  if (v.cur.item) showItem(v, k);
  else showMissing(v);
}

/**
 * @param {HTMLElement} root
 * @param {{ params: URLSearchParams, navigate: (href: string) => void }} ctx
 */
export function mount(root, { params, navigate }) {
  const list = BY_BASE[params.get("list") ?? ""];
  let alive = true;
  const p = buildPage(list);
  root.replaceChildren(p.pageEl);
  const stopCard = attachCardStates(p.card);
  const id = params.get("id") ?? "";
  /** @type {ItemView} */
  const v = { list, id, meta: LISTS[list], p, cur: { item: null }, extra: list === "ingredients" ? usedBy(p.pageEl, id) : null, recipesCard: list === "dishes" ? dishRecipes(p.pageEl) : null };
  setActions(p, false);
  wireButtons(list, p, v.cur, navigate);

  /** @param {boolean} [force] */
  function load(force = false) {
    if (force) setCardState(p.card, "loading");
    loadKitchen({ force }).then(
      (k) => alive && show(v, k),
      (e) => {
        if (!alive) return;
        v.extra?.fail(e instanceof Error ? e.message : String(e));
        setActions(p, false);
        setCardState(p.card, "error", { title: t("it.notRead", v.meta.the), text: e instanceof Error ? e.message : String(e) });
      },
    );
  }
  const retry = () => load(true);
  p.card.addEventListener(CARD_RETRY_EVENT, retry);
  const stop = onKitchen((k) => alive && show(v, k));
  load();
  return () => {
    alive = false;
    stop();
    stopCard();
    v.extra?.stop();
    v.recipesCard?.stop();
    p.card.removeEventListener(CARD_RETRY_EVENT, retry);
  };
}
