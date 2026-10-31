// The table rows of the recipes screen: one per recipe, with Edit, Duplicate and Delete.

import { remove, ApiError } from "../../api.js";
import { h } from "../../dom.js";
import { openConfirmation, toast } from "/static/kp/dist/kp-themes.min.js";
import { deletePhoto, photosOf } from "../../recipe/photos.js";
import { dmy } from "../../format.js";
import { t } from "../../i18n/index.js";

export const prepLabels = () => /** @type {Record<string, string>} */ ({ none: t("recs.prepNone"), light: t("recs.prepLight"), full: t("recs.prepFull") });
const mealLabels = () => /** @type {Record<string, string>} */ ({ breakfast: t("wheel.mealBreakfast"), lunch: t("wheel.mealLunch"), dinner: t("wheel.mealDinner") });

/** The day number of an ISO date, for sorting; -1 for never. @param {string | null} iso */
const dayNumber = (iso) => (iso ? Math.floor(Date.parse(`${iso}T12:00:00Z`) / 86_400_000) : -1);

/** The latest log day of each recipe. @param {import("../../api.js").Kitchen} k */
function lastCooked(k) {
  const last = new Map();
  for (const e of k.log) if (e.recipe_id && (!last.has(e.recipe_id) || e.date > last.get(e.recipe_id))) last.set(e.recipe_id, e.date);
  return last;
}

/** Delete asks for the recipe's name; its photos go with it (Kenny, 24/10/2026 05:23). @param {HTMLElement} del @param {Record<string, any>} r */
function askDelete(del, r) {
  openConfirmation(del, {
    phrase: t("rec.deleteAsk", r.name),
    typeName: r.name,
    acceptLabel: t("list.recipes.delete"),
    loses: [t("recs.loses")],
    onAccept: () =>
      void remove("recipes", r.id).then(
        () => {
          for (const photo of photosOf(r)) void deletePhoto(photo);
          toast(t("rec.deleted", r.name));
        },
        (e) => toast(t("rec.notDeleted", e instanceof ApiError ? e.message : String(e)), { live: "assertive", sticky: true }),
      ),
  });
}

/** The three buttons of a row. @param {Record<string, any>} r @param {{ edit: (r: Record<string, any>) => void, copy: (r: Record<string, any>) => void }} on */
function actionsOf(r, on) {
  const edit = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": t("rec.editName", r.name) }, t("common.edit"));
  const copy = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": t("rec.duplicateName", r.name) }, t("common.duplicate"));
  const del = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--destructive", "aria-label": t("rec.deleteName", r.name) }, t("common.delete"));
  edit.addEventListener("click", () => on.edit(r));
  copy.addEventListener("click", () => on.copy(r));
  del.addEventListener("click", () => askDelete(del, r));
  return h("div", { class: "rl-actions" }, edit, copy, del);
}

/** @param {import("../../api.js").Kitchen} k @param {{ edit: (r: Record<string, any>) => void, copy: (r: Record<string, any>) => void }} on */
export function rowsFor(k, on) {
  const last = lastCooked(k);
  return k.recipes.map((r) => {
    const cooked = last.get(r.id) ?? null;
    return h(
      "tr",
      { "data-kp-row-key": r.id },
      h("td", { "data-label": t("recs.colName") }, h("a", { href: `/recipe?id=${encodeURIComponent(r.id)}` }, r.name)),
      h("td", { class: "kp-col-low", "data-label": t("recs.colMeals") }, (r.meals ?? []).map((/** @type {string} */ m) => mealLabels()[m] ?? m).join(", ") || "–"),
      h("td", { "data-label": t("recs.colMinutes"), class: "kp-numeric" }, t("wheel.min", r.minutes ?? 0)),
      h("td", { "data-label": t("recs.colPrep") }, h("span", { class: "kp-badge" }, prepLabels()[r.prep] ?? "–")),
      h("td", { "data-label": t("recs.colSafe") }, r.safe ? h("span", { class: "kp-badge kp-badge--success" }, t("recs.safe")) : "–"),
      h("td", { "data-label": t("recs.colLast"), "data-kp-sort-value": String(dayNumber(cooked)) }, cooked ? dmy(cooked) : t("recs.never")),
      h("td", { "data-label": t("recs.colActions") }, actionsOf(r, on)),
    );
  });
}
