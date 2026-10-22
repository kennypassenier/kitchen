// The dishes screen, `/dishes` (Kenny, 22/10/2026): what lands on a plate, the dishes the parents' wheel picks from.
// Three cards, each the package's data table with its own loading, empty and failed states: the dishes, the kinds of
// part a dish can have ("Potatoes and co.", "Sauce", …) and the categories ("Everyday", "Special", …). Add and Edit
// open the drawer (js/dishes/editor.js); Delete asks for the typed name. A part kind or a category a dish still uses
// cannot be deleted, so no dish ever points at nothing.

import { loadKitchen, onKitchen, kitchenNow, remove, replace, ApiError } from "../api.js";
import { h } from "../dom.js";
import { attachDataTables, dataTable } from "/static/kp/js/datatable.js";
import { openConfirmation } from "/static/kp/js/components.js";
import { toast } from "/static/kp/js/overlays.js";
import { openDishEditor, openNameEditor, names, label, languages, ordered } from "../dishes/editor.js";

/** @typedef {import("../api.js").Kitchen} Kitchen */
/** @typedef {Record<string, any>} Item */

/**
 * One card with a data table: header, a sentence, the table and its own states.
 * @param {{ id: string, title: string, lede: string, noun: string, plural: string, columns: [string, string?][], add: string, emptyTitle: string, emptyText: string }} spec
 */
function tableCard({ id, title, lede, noun, plural, columns, add, emptyTitle, emptyText }) {
  const addButton = h("button", { type: "button", class: "kp-button kp-button--primary" }, add);
  const empty = h(
    "div",
    { class: "kp-empty", "data-kp-datatable-empty": true, hidden: true },
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

/** Edit and Delete for one row. @param {string} name @param {() => void} onEdit @param {() => void} onDelete */
function actions(name, onEdit, onDelete) {
  const edit = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": `Edit ${name}` }, "Edit");
  const del = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--destructive", "aria-label": `Delete ${name}` }, "Delete");
  edit.addEventListener("click", onEdit);
  del.addEventListener("click", () => onDelete.call(del));
  return { cell: h("div", { class: "rl-actions" }, edit, del), del };
}

/** @param {HTMLElement} root */
export function mount(root) {
  document.title = "Dishes · Kitchen";
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
        h("h1", { class: "kp-page-header__title" }, "Dishes"),
        h("p", { class: "kp-page-header__description" }, "What lands on a plate, with its Dutch and English name and the parts that come with it. The parents' wheel picks from the dishes marked for it."),
      ),
      h("div", { class: "kp-page-header__actions" }, h("a", { class: "kp-button", href: "/parents", title: "The wheel as Kenny's parents see it, in English" }, "Open the parents' wheel")),
    ),
  );

  const dishes = tableCard({
    id: "dl-dishes",
    title: "All dishes",
    lede: "A dish shows on the Dutch wheel with a Dutch name and on the English wheel with an English name; the Wheel column says which.",
    noun: "dish",
    plural: "dishes",
    columns: [["Dutch name", "text"], ["English name", "text"], ["Category", "text"], ["Wheel", "text"], ["Parts"], ["Actions"]],
    add: "Add a dish",
    emptyTitle: "No dishes yet",
    emptyText: "The parents' wheel has nothing to pick from until you add one.",
  });
  const kinds = tableCard({
    id: "dl-kinds",
    title: "Kinds of part",
    lede: "What a dish can come with: potatoes, rice or pasta, vegetables, a sauce. Add a kind and every dish can use it; only a kind marked for the small wheel is picked by it.",
    noun: "kind",
    plural: "kinds of part",
    columns: [["Position", "number"], ["Dutch name", "text"], ["English name", "text"], ["Small wheel", "text"], ["Used by", "number"], ["Actions"]],
    add: "Add a kind of part",
    emptyTitle: "No kinds of part yet",
    emptyText: "Without one, every dish always comes the same way.",
  });
  const cats = tableCard({
    id: "dl-cats",
    title: "Categories",
    lede: "Kinds of food, such as everyday or special; the parents' page can narrow its wheel to one.",
    noun: "category",
    plural: "categories",
    columns: [["Position", "number"], ["Dutch name", "text"], ["English name", "text"], ["Used by", "number"], ["Actions"]],
    add: "Add a category",
    emptyTitle: "No categories yet",
    emptyText: "Without them the parents' page shows all its dishes on one wheel.",
  });

  const drawer = h("dialog", { class: "kp-drawer kp-dialog rl-editor", "aria-labelledby": "rl-editor-t" });
  const page = h("div", { class: "dl-page" }, head, dishes.card, kinds.card, cats.card);
  root.replaceChildren(page, drawer);
  const detach = attachDataTables(page);
  const handles = [dishes, kinds, cats].map((c) => dataTable(c.table));
  const dialog = /** @type {HTMLDialogElement} */ (drawer);

  const busy = () => {
    for (const handle of handles) {
      handle?.busy({ text: "Reading the dishes", overlay: true });
      handle?.state("loading");
    }
  };
  busy();

  /** @param {Item | null} dish */
  const editDish = (dish) => {
    const k = kitchenNow();
    openDishEditor(dialog, { dish, kinds: k?.dish_parts ?? [], categories: ordered(k?.dish_categories ?? []), recipes: k?.recipes ?? [] });
  };
  /** @param {"dish_parts" | "dish_categories"} list @param {Item | null} item */
  const editName = (list, item) => {
    const k = kitchenNow();
    openNameEditor(dialog, {
      list,
      item,
      items: k?.[list] ?? [],
      noun: list === "dish_parts" ? "kind of part" : "category",
      example: list === "dish_parts" ? { nl: "Saus", en: "Sauce" } : { nl: "Speciaal", en: "Special" },
    });
  };
  for (const b of dishes.addButtons) b.addEventListener("click", () => editDish(null));
  for (const b of kinds.addButtons) b.addEventListener("click", () => editName("dish_parts", null));
  for (const b of cats.addButtons) b.addEventListener("click", () => editName("dish_categories", null));

  /** @param {string} list @param {Item} item @param {string} what @param {string[]} loses */
  const askDelete = (list, item, what, loses) =>
    /** @this {HTMLElement} */ function () {
      openConfirmation(this, {
        phrase: `Delete ${label(item)}?`,
        typeName: label(item),
        acceptLabel: `Delete ${what}`,
        loses,
        onAccept: () =>
          void remove(list, item.id)
            .then(async () => {
              // A deleted kind or category leaves no gap: the others close up to 1, 2, 3, ….
              if (list === "dishes") return;
              const rest = ordered(kitchenNow()?.[/** @type {"dish_parts" | "dish_categories"} */ (list)] ?? []);
              for (const [i, x] of rest.entries()) if (x.order !== i + 1) await replace(list, { ...x, order: i + 1 });
            })
            .then(
            () => toast(`Deleted ${label(item)}`),
            (e) => toast(`Not deleted: ${e instanceof ApiError ? e.message : e}`, { live: "assertive", sticky: true }),
          ),
      });
    };

  /** @param {Kitchen} k */
  function show(k) {
    const kindList = k.dish_parts ?? [];
    const catList = k.dish_categories ?? [];
    const dishList = k.dishes ?? [];
    dishes.body.replaceChildren(
      ...dishList.map((d) => {
        const n = names(d);
        const only = languages(d);
        const cat = catList.find((c) => c.id === d.category);
        const parts = (d.parts ?? [])
          .map((/** @type {Item} */ p) => {
            const kind = kindList.find((x) => x.id === p.part);
            const count = (p.choices ?? []).length;
            return kind ? `${label(kind)} (${count === 1 ? (p.choices[0].en || p.choices[0].nl) : `${count} choices`})` : null;
          })
          .filter(Boolean)
          .join(", ");
        const wheel =
          d.parents !== true
            ? h("span", { class: "kp-badge" }, "Not on the wheel")
            : only === "both"
              ? h("span", { class: "kp-badge kp-badge--success" }, "Both wheels")
              : h("span", { class: "kp-badge kp-badge--warning" }, only === "nl" ? "Dutch wheel only" : "English wheel only");
        const { cell } = actions(label(d), () => editDish(d), askDelete("dishes", d, "dish", ["The dish, its parts and their choices. A recipe it points at stays."]));
        return h(
          "tr",
          { "data-kp-row-key": d.id },
          h("td", { "data-label": "Dutch name", lang: "nl" }, n.nl || "–"),
          h("td", { "data-label": "English name" }, n.en || "–"),
          h("td", { "data-label": "Category" }, cat ? label(cat) : "–"),
          h("td", { "data-label": "Wheel" }, wheel),
          h("td", { "data-label": "Parts" }, parts || "Always the same way"),
          h("td", { "data-label": "Actions" }, cell),
        );
      }),
    );
    /** @param {"dish_parts" | "dish_categories"} list @param {Item[]} items @param {(d: Item, id: string) => boolean} uses @param {string} what */
    const nameRows = (list, items, uses, what) =>
      ordered(items).map((item, i) => {
        const n = names(item);
        const used = dishList.filter((d) => uses(d, item.id)).length;
        const { cell, del } = actions(
          label(item),
          () => editName(list, item),
          used
            ? () => toast(`${label(item)} is used by ${used} ${used === 1 ? "dish" : "dishes"}; take it out of ${used === 1 ? "that dish" : "them"} first.`, { live: "assertive" })
            : askDelete(list, item, what, [`The ${what}; no dish uses it.`]),
        );
        if (used) del.setAttribute("title", `Used by ${used} ${used === 1 ? "dish" : "dishes"}: take it out of them first`);
        return h(
          "tr",
          { "data-kp-row-key": item.id },
          h("td", { "data-label": "Position", class: "kp-numeric" }, String(i + 1)),
          h("td", { "data-label": "Dutch name", lang: "nl" }, n.nl || "–"),
          h("td", { "data-label": "English name" }, n.en || "–"),
          list === "dish_parts" ? h("td", { "data-label": "Small wheel" }, item.wheel === true ? h("span", { class: "kp-badge kp-badge--success" }, "Picks it") : "–") : null,
          h("td", { "data-label": "Used by", class: "kp-numeric", "data-kp-sort-value": String(used) }, `${used} ${used === 1 ? "dish" : "dishes"}`),
          h("td", { "data-label": "Actions" }, cell),
        );
      });
    kinds.body.replaceChildren(...nameRows("dish_parts", kindList, (d, id) => (d.parts ?? []).some((/** @type {Item} */ p) => p.part === id), "kind of part"));
    cats.body.replaceChildren(...nameRows("dish_categories", catList, (d, id) => d.category === id, "category"));
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
  for (const c of [dishes, kinds, cats]) c.table.addEventListener("kp-datatable-retry", () => void load(true));
  const stop = onKitchen((k) => alive && show(k));
  void load();

  return () => {
    alive = false;
    stop();
    detach();
  };
}
