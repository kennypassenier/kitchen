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
import { deletePhoto, photosOf } from "../recipe/photos.js";
import { dmy } from "../recipe/log.js";
import { t } from "../i18n/index.js";

/** @typedef {import("../api.js").Kitchen} Kitchen */

const prepLabels = () => /** @type {Record<string, string>} */ ({ none: t("recs.prepNone"), light: t("recs.prepLight"), full: t("recs.prepFull") });
const mealLabels = () => /** @type {Record<string, string>} */ ({ breakfast: t("wheel.mealBreakfast"), lunch: t("wheel.mealLunch"), dinner: t("wheel.mealDinner") });

/** The day number of an ISO date, for sorting; -1 for never. @param {string | null} iso */
const dayNumber = (iso) => (iso ? Math.floor(Date.parse(`${iso}T12:00:00Z`) / 86_400_000) : -1);

/** @param {HTMLElement} root */
export function mount(root) {
  document.title = `${t("nav.recipes")} · Kitchen`;
  let alive = true;
  const add = h("button", { type: "button", class: "kp-button kp-button--primary" }, t("list.recipes.add"));

  const head = h(
    "header",
    { class: "kp-page-header" },
    h(
      "div",
      { class: "kp-page-header__inner" },
      h("div", null, h("h1", { class: "kp-page-header__title" }, t("nav.recipes")), h("p", { class: "kp-page-header__description" }, t("recs.intro"))),
      h("div", { class: "kp-page-header__actions" }, add),
    ),
  );

  // The package draws this slot as its state plate (centred, the table's full height); the page only supplies the words.
  const empty = h(
    "div",
    { class: "kp-empty", "data-kp-datatable-empty": true, hidden: true },
    h("p", { class: "kp-empty__title", "data-kp-datatable-empty-none": true }, t("recs.noneTitle")),
    h("p", { class: "kp-empty__body", "data-kp-datatable-empty-none": true }, t("recs.noneText")),
    h("button", { type: "button", class: "kp-button kp-button--primary", "data-kp-datatable-empty-none": true, "data-rl-add": true }, t("list.recipes.add")),
    h("p", { class: "kp-empty__title", "data-kp-datatable-empty-nomatch": true }, t("recs.noMatch")),
    h("p", { class: "kp-empty__body", "data-kp-datatable-empty-nomatch": true }, t("recs.noMatchText")),
    h("button", { type: "button", class: "kp-button", "data-kp-datatable-empty-nomatch": true, "data-kp-datatable-clear": true }, t("rec.clearSearch")),
  );
  const body = h("tbody");
  const search = h("input", { class: "kp-field__input kp-datatable__search", type: "search", "data-kp-datatable-search": true, "aria-label": t("recs.search"), placeholder: t("recs.search") });
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
        h("caption", { class: "kp-sr-only" }, t("nav.recipes")),
        h(
          "thead",
          null,
          h(
            "tr",
            null,
            h("th", { scope: "col", "data-kp-sort": "text" }, t("recs.colName")),
            h("th", { scope: "col", class: "kp-col-low" }, t("recs.colMeals")),
            h("th", { scope: "col", "data-kp-sort": "number" }, t("recs.colMinutes")),
            h("th", { scope: "col", "data-kp-sort": "text", "data-kp-sort-order": Object.values(prepLabels()).join(",") }, t("recs.colPrep")),
            h("th", { scope: "col", "data-kp-sort": "text" }, t("recs.colSafe")),
            h("th", { scope: "col", "data-kp-sort": "number" }, t("recs.colLast")),
            h("th", { scope: "col" }, t("recs.colActions")),
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
    h("div", { class: "kp-card__header" }, h("h2", { class: "kp-card__title", id: "rl-list-t" }, t("recs.all"))),
    h("p", { class: "kp-lede" }, t("recs.lede")),
    table,
  );
  const editor = h("dialog", { class: "kp-drawer kp-dialog rl-editor", "aria-labelledby": "rl-editor-t" });
  const page = h("div", { class: "rl-page" }, head, list);
  root.replaceChildren(page, editor);

  const detach = attachDataTables(page);
  const handle = dataTable(table);
  handle?.busy({ text: t("recs.loading"), overlay: true });
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
    for (const e of k.log) if (e.recipe_id && (!last.has(e.recipe_id) || e.date > last.get(e.recipe_id))) last.set(e.recipe_id, e.date);
    return k.recipes.map((r) => {
      const cooked = last.get(r.id) ?? null;
      const edit = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": t("rec.editName", r.name) }, t("common.edit"));
      const del = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--destructive", "aria-label": t("rec.deleteName", r.name) }, t("common.delete"));
      edit.addEventListener("click", () => openFor(r));
      del.addEventListener("click", () => {
        openConfirmation(del, {
          phrase: t("rec.deleteAsk", r.name),
          typeName: r.name,
          acceptLabel: t("list.recipes.delete"),
          loses: [t("recs.loses")],
          onAccept: () =>
            void remove("recipes", r.id).then(
              () => {
                // Its photos go with it (Kenny, 24/10/2026 05:23).
                for (const photo of photosOf(r)) void deletePhoto(photo);
                toast(t("rec.deleted", r.name));
              },
              (e) => toast(t("rec.notDeleted", e instanceof ApiError ? e.message : String(e)), { live: "assertive", sticky: true }),
            ),
        });
      });
      return h(
        "tr",
        { "data-kp-row-key": r.id },
        h("td", { "data-label": t("recs.colName") }, h("a", { href: `/recipe?id=${encodeURIComponent(r.id)}` }, r.name)),
        h("td", { class: "kp-col-low", "data-label": t("recs.colMeals") }, (r.meals ?? []).map((/** @type {string} */ m) => mealLabels()[m] ?? m).join(", ") || "–"),
        h("td", { "data-label": t("recs.colMinutes"), class: "kp-numeric" }, t("wheel.min", r.minutes ?? 0)),
        h("td", { "data-label": t("recs.colPrep") }, h("span", { class: "kp-badge" }, prepLabels()[r.prep] ?? "–")),
        h("td", { "data-label": t("recs.colSafe") }, r.safe ? h("span", { class: "kp-badge kp-badge--success" }, t("recs.safe")) : "–"),
        h("td", { "data-label": t("recs.colLast"), "data-kp-sort-value": String(dayNumber(cooked)) }, cooked ? dmy(cooked) : t("recs.never")),
        h("td", { "data-label": t("recs.colActions") }, h("div", { class: "rl-actions" }, edit, del)),
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
      handle?.busy({ text: t("recs.loading"), overlay: true });
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
