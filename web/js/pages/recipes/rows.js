// The table rows of the recipes screen: one per recipe, with Edit and a menu for Duplicate and Delete (row-actions.js).

import { h } from "../../dom.js";
import { dmy } from "../../format.js";
import { t } from "../../i18n/index.js";
import { actionsOf } from "./row-actions.js";

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

/** @param {import("../../api.js").Kitchen} k */
export function rowsFor(k) {
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
      h("td", { "data-label": t("recs.colActions") }, actionsOf(r)),
    );
  });
}
