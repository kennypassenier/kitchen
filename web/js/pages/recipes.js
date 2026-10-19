// The recipes screen, `/recipes`: every recipe in one table, with Add, Edit
// and Delete. Built only from the package's parts: the page header, the
// data table with its own loading, empty and failed states, a drawer on the
// form grid for the editor (js/recipe/editor.js) and the typed confirmation
// for Delete.

import { loadKitchen, onKitchen, kitchenNow, remove, ApiError } from "../api.js";
import { h } from "../dom.js";
import { attachDataTables, dataTable } from "/static/kp/js/datatable.js";
import { openConfirmation } from "/static/kp/js/components.js";
import { toast } from "/static/kp/js/overlays.js";
import { openEditor } from "../recipe/editor.js";
import { dmy } from "../recipe/log.js";

/** @typedef {import("../api.js").Kitchen} Kitchen */

const PREP = /** @type {Record<string, string>} */ ({ none: "No prep", light: "Light prep", full: "Full prep" });
const MEAL = /** @type {Record<string, string>} */ ({ breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" });

/** The day number of an ISO date, for sorting; -1 for never. @param {string | null} iso */
const dayNumber = (iso) => (iso ? Math.floor(Date.parse(`${iso}T12:00:00Z`) / 86_400_000) : -1);

/** @param {HTMLElement} root */
export function mount(root) {
  let alive = true;
  const add = h("button", { type: "button", class: "kp-button kp-button--primary" }, "Add a recipe");

  const head = h(
    "header",
    { class: "kp-page-header" },
    h(
      "div",
      { class: "kp-page-header__inner" },
      h("div", null, h("h1", { class: "kp-page-header__title" }, "Recipes"), h("p", { class: "kp-page-header__description" }, "Every dish the wheel can pick: open one to cook it, or add one of your own.")),
      h("div", { class: "kp-page-header__actions" }, add),
    ),
  );

  // The package draws this slot as its state plate (centred, the table's full height); the page only supplies the words.
  const empty = h(
    "div",
    { class: "kp-empty", "data-kp-datatable-empty": true, hidden: true },
    h("p", { class: "kp-empty__title", "data-kp-datatable-empty-none": true }, "No recipes yet"),
    h("p", { class: "kp-empty__body", "data-kp-datatable-empty-none": true }, "The wheel has nothing to pick from until you add one."),
    h("button", { type: "button", class: "kp-button kp-button--primary", "data-kp-datatable-empty-none": true, "data-rl-add": true }, "Add a recipe"),
    h("p", { class: "kp-empty__title", "data-kp-datatable-empty-nomatch": true }, "No recipe matches"),
    h("p", { class: "kp-empty__body", "data-kp-datatable-empty-nomatch": true }, "Nothing has that in its name or its details."),
    h("button", { type: "button", class: "kp-button", "data-kp-datatable-empty-nomatch": true, "data-kp-datatable-clear": true }, "Clear the search"),
  );
  const body = h("tbody");
  const search = h("input", { class: "kp-field__input kp-datatable__search", type: "search", "data-kp-datatable-search": true, "aria-label": "Search the recipes", placeholder: "Search the recipes" });
  const table = h(
    "div",
    { class: "kp-datatable rl-datatable", "data-kp-datatable": true, "data-kp-cards": true, "data-kp-state": "loading", "data-kp-page-size": "25" },
    h("div", { class: "kp-datatable__bar" }, search),
    h(
      "div",
      { class: "kp-table-wrap" },
      h(
        "table",
        { class: "kp-table" },
        h("caption", { class: "kp-sr-only" }, "Recipes"),
        h(
          "thead",
          null,
          h(
            "tr",
            null,
            h("th", { scope: "col", "data-kp-sort": "text" }, "Name"),
            h("th", { scope: "col", class: "kp-col-low" }, "Meals"),
            h("th", { scope: "col", "data-kp-sort": "number" }, "Minutes"),
            h("th", { scope: "col", "data-kp-sort": "text", "data-kp-sort-order": "No prep,Light prep,Full prep" }, "Prep"),
            h("th", { scope: "col", "data-kp-sort": "text" }, "Safe"),
            h("th", { scope: "col", "data-kp-sort": "number" }, "Last cooked"),
            h("th", { scope: "col" }, "Actions"),
          ),
        ),
        body,
      ),
    ),
    empty,
    h("div", { class: "kp-datatable__bar" }, h("p", { class: "kp-datatable__status", "data-kp-datatable-status": true, role: "status", "aria-live": "polite" }), h("div", { class: "kp-datatable__pager", "data-kp-datatable-pager": true })),
  );
  const list = h(
    "section",
    { class: "kp-card rl-list", "aria-labelledby": "rl-list-t" },
    h("div", { class: "kp-card__header" }, h("h2", { class: "kp-card__title", id: "rl-list-t" }, "All recipes")),
    h("p", { class: "kp-lede" }, "Search by name, sort by any column, and press a name to open the recipe."),
    table,
  );
  const editor = h("dialog", { class: "kp-drawer kp-dialog rl-editor", "aria-labelledby": "rl-editor-t" });
  const page = h("div", { class: "rl-page" }, head, list);
  root.replaceChildren(page, editor);

  const detach = attachDataTables(page);
  const handle = dataTable(table);
  handle?.busy({ text: "Reading your recipes", overlay: true });
  handle?.state("loading");

  /** @param {Record<string, any> | null} recipe */
  const openFor = (recipe) => {
    const k = kitchenNow();
    openEditor(/** @type {HTMLDialogElement} */ (editor), { recipe, mainOptions: [...new Set((k?.recipes ?? []).flatMap((r) => r.ing ?? []))] });
  };
  add.addEventListener("click", () => openFor(null));
  empty.querySelector("[data-rl-add]")?.addEventListener("click", () => openFor(null));

  /** @param {Kitchen} k */
  function rowsFor(k) {
    const last = new Map();
    for (const e of k.log) if (!last.has(e.recipe_id) || e.date > last.get(e.recipe_id)) last.set(e.recipe_id, e.date);
    return k.recipes.map((r) => {
      const cooked = last.get(r.id) ?? null;
      const edit = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": `Edit ${r.name}` }, "Edit");
      const del = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--destructive", "aria-label": `Delete ${r.name}` }, "Delete");
      edit.addEventListener("click", () => openFor(r));
      del.addEventListener("click", () => {
        openConfirmation(del, {
          phrase: `Delete ${r.name}?`,
          typeName: r.name,
          acceptLabel: "Delete recipe",
          loses: ["The recipe, its ingredients, tools and steps."],
          onAccept: () =>
            void remove("recipes", r.id).then(
              () => toast(`Deleted ${r.name}`),
              (e) => toast(`Not deleted: ${e instanceof ApiError ? e.message : e}`, { live: "assertive", sticky: true }),
            ),
        });
      });
      return h(
        "tr",
        { "data-kp-row-key": r.id },
        h("td", { "data-label": "Name" }, h("a", { href: `/recipe?id=${encodeURIComponent(r.id)}` }, r.name)),
        h("td", { class: "kp-col-low", "data-label": "Meals" }, (r.meals ?? []).map((/** @type {string} */ m) => MEAL[m] ?? m).join(", ") || "–"),
        h("td", { "data-label": "Minutes", class: "kp-numeric" }, `${r.minutes ?? 0} min`),
        h("td", { "data-label": "Prep" }, h("span", { class: "kp-badge" }, PREP[r.prep] ?? "–")),
        h("td", { "data-label": "Safe" }, r.safe ? h("span", { class: "kp-badge kp-badge--success" }, "Safe") : "–"),
        h("td", { "data-label": "Last cooked", "data-kp-sort-value": String(dayNumber(cooked)) }, cooked ? dmy(cooked) : "Never"),
        h("td", { "data-label": "Actions" }, h("div", { class: "rl-actions" }, edit, del)),
      );
    });
  }

  /** @param {Kitchen} k */
  function show(k) {
    body.replaceChildren(...rowsFor(k));
    handle?.refresh({ keepPage: true });
    handle?.state("ready");
  }

  /** @param {boolean} [force] */
  async function load(force = false) {
    if (force || !kitchenNow()) {
      handle?.busy({ text: "Reading your recipes", overlay: true });
      handle?.state("loading");
    }
    try {
      const k = await loadKitchen({ force });
      if (alive) show(k);
    } catch (e) {
      if (alive) handle?.fail(e instanceof Error ? e.message : String(e));
    }
  }
  table.addEventListener("kp-datatable-retry", () => void load(true));
  const stop = onKitchen((k) => alive && show(k));
  void load();

  return () => {
    alive = false;
    stop();
    detach();
  };
}
