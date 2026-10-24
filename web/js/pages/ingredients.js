// The ingredients screen, `/ingredients` (Kenny, 24/10/2026 05:15): the one list of ingredients every dish side and
// every recipe line points at, and the categories they sit in ("Vlees" / "Meat" → Steak, "Aardappelen" / "Potatoes"
// → Frieten). Two cards with the package's data table and its loading, empty and failed states; Add, Edit and
// Delete through js/records.js, and every name opens its own page. An ingredient or a category still in use cannot
// be deleted; the refusal names what uses it.

import { attachDataTables, dataTable } from "/static/kp/js/datatable.js";
import { loadKitchen, onKitchen, kitchenNow } from "../api.js";
import { h } from "../dom.js";
import { names, ordered } from "../dishes/editor.js";
import { tableCard, rowActions, itemLink, openRecordEditor, usersOf } from "../records.js";
import { t } from "../i18n/index.js";

/** @typedef {import("../api.js").Kitchen} Kitchen */

/** @param {HTMLElement} root */
export function mount(root) {
  document.title = `${t("nav.ingredients")} · Kitchen`;
  let alive = true;

  const head = h(
    "header",
    { class: "kp-page-header" },
    h(
      "div",
      { class: "kp-page-header__inner" },
      h(
        "div",
        null,
        h("h1", { class: "kp-page-header__title" }, t("nav.ingredients")),
        h("p", { class: "kp-page-header__description" }, t("ig.lede")),
      ),
    ),
  );
  const ings = tableCard({
    id: "ig-ings",
    title: t("ig.allTitle"),
    lede: t("ig.allLede"),
    noun: t("list.ingredients"),
    plural: t("ig.plural"),
    columns: [[t("rec.dutchName"), "text"], [t("rec.englishName"), "text"], [t("rec.category"), "text"], [t("ig.usedBy"), "number"], [t("lg.actions")]],
    add: t("list.ingredients.add"),
    emptyTitle: t("ig.empty"),
    emptyText: t("ig.emptyText"),
  });
  const cats = tableCard({
    id: "ig-cats",
    title: t("ig.catTitle"),
    lede: t("ig.catLede"),
    noun: t("list.ingredient_categories"),
    plural: t("ig.catPlural"),
    columns: [[t("it.position"), "number"], [t("rec.dutchName"), "text"], [t("rec.englishName"), "text"], [t("nav.ingredients"), "number"], [t("lg.actions")]],
    add: t("list.ingredient_categories.add"),
    emptyTitle: t("ig.catEmpty"),
    emptyText: t("ig.catEmptyText"),
  });
  const page = h("div", { class: "dl-page" }, head, ings.card, cats.card);
  root.replaceChildren(page);
  const detach = attachDataTables(page);
  const handles = [ings, cats].map((c) => dataTable(c.table));
  for (const b of ings.addButtons) b.addEventListener("click", () => openRecordEditor("ingredients", null));
  for (const b of cats.addButtons) b.addEventListener("click", () => openRecordEditor("ingredient_categories", null));

  const busy = () => {
    for (const handle of handles) {
      handle?.busy({ text: t("ig.reading"), overlay: true });
      handle?.state("loading");
    }
  };

  /** @param {Kitchen} k */
  function show(k) {
    const catList = k.ingredient_categories ?? [];
    ings.body.replaceChildren(
      ...(k.ingredients ?? []).map((i) => {
        const n = names(i);
        const cat = catList.find((c) => c.id === i.category);
        const used = usersOf("ingredients", i).length;
        return h(
          "tr",
          { "data-kp-row-key": i.id },
          h("td", { "data-label": t("rec.dutchName"), lang: "nl" }, n.nl ? itemLink("ingredients", i, n.nl) : "–"),
          h("td", { "data-label": t("rec.englishName") }, n.en ? itemLink("ingredients", i, n.en) : "–"),
          h("td", { "data-label": t("rec.category") }, cat ? itemLink("ingredient_categories", cat) : "–"),
          h("td", { "data-label": t("ig.usedBy"), class: "kp-numeric", "data-kp-sort-value": String(used) }, t("ig.used", used)),
          h("td", { "data-label": t("lg.actions") }, rowActions("ingredients", i)),
        );
      }),
    );
    cats.body.replaceChildren(
      ...ordered(catList).map((c, at) => {
        const n = names(c);
        const count = (k.ingredients ?? []).filter((i) => i.category === c.id).length;
        return h(
          "tr",
          { "data-kp-row-key": c.id },
          h("td", { "data-label": t("it.position"), class: "kp-numeric" }, String(at + 1)),
          h("td", { "data-label": t("rec.dutchName"), lang: "nl" }, n.nl ? itemLink("ingredient_categories", c, n.nl) : "–"),
          h("td", { "data-label": t("rec.englishName") }, n.en ? itemLink("ingredient_categories", c, n.en) : "–"),
          h("td", { "data-label": t("nav.ingredients"), class: "kp-numeric", "data-kp-sort-value": String(count) }, String(count)),
          h("td", { "data-label": t("lg.actions") }, rowActions("ingredient_categories", c)),
        );
      }),
    );
    for (const handle of handles) {
      handle?.refresh({ keepPage: true });
      handle?.state("ready");
    }
  }

  /** @param {boolean} [force] */
  async function load(force = false) {
    if (force || !kitchenNow()) busy();
    try {
      const k = await loadKitchen({ force });
      if (alive) show(k);
    } catch (e) {
      if (alive) for (const handle of handles) handle?.fail(e instanceof Error ? e.message : String(e));
    }
  }
  for (const c of [ings, cats]) c.table.addEventListener("kp-datatable-retry", () => void load(true));
  const stop = onKitchen((k) => alive && show(k));
  void load();

  return () => {
    alive = false;
    stop();
    detach();
  };
}
