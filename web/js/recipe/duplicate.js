// Duplicate (Kenny, 29/10/2026): an editable copy of a dish or a recipe with new ids, which the editors open and a Save
// then makes real. Nothing is stored here. Photos are shared: the copy refers to the same photo ids (files in
// <state dir>/photos, docs/agent/DATA.md), so a photo file is deleted only when no recipe refers to it any more
// (recipe/photos.js `deletePhoto`).

import { newId } from "./editor/ids.js";

/** The words a copy's name gets, per language. */
const SUFFIX = { nl: " (kopie)", en: " (copy)" };
/** The label of a copy of a recipe that had none (it must be told apart from the original). */
const BARE = { nl: "Kopie", en: "Copy" };

/** @param {Record<string, any>} x */
const clone = (x) => JSON.parse(JSON.stringify(x));

/** A name `{nl, en}` with the suffix of each language. @param {{ nl?: string, en?: string } | undefined} name */
const suffixed = (name) => ({ nl: `${String(name?.nl ?? "").trim()}${SUFFIX.nl}`.trim(), en: `${String(name?.en ?? "").trim()}${SUFFIX.en}`.trim() });

/**
 * A copy of a recipe: new ids for the recipe, its steps, tracks, tools and ingredient lines (a step's `track` and
 * `with` follow the new ids), a label with the suffix (" (kopie)" / " (copy)", or "Kopie" / "Copy" when it had none),
 * not the default of its dish. The view's own fields (name, dish_id, dates) are dropped; the photos stay.
 * @param {Record<string, any>} recipe
 */
export function copyRecipe(recipe) {
  const c = clone(recipe);
  for (const key of ["id", "name", "created", "updated", "isNew", "dish_id", "dishName", "new_dish"]) delete c[key];
  const tracks = new Map((c.tracks ?? []).map((/** @type {{ id: string }} */ tk) => [tk.id, newId()]));
  const steps = new Map((c.steps ?? []).map((/** @type {{ id: string }} */ st) => [st.id, newId()]));
  for (const tk of c.tracks ?? []) tk.id = tracks.get(tk.id);
  for (const st of c.steps ?? []) {
    st.id = steps.get(st.id);
    st.track = st.track ? tracks.get(st.track) ?? null : null;
    st.with = st.with ? steps.get(st.with) ?? null : null;
  }
  for (const tool of c.tools ?? []) tool.id = newId();
  for (const line of c.ingredients ?? []) line.id = newId();
  const nl = String(c.label?.nl ?? "").trim();
  const en = String(c.label?.en ?? "").trim();
  const label = nl || en ? { nl: `${nl || en}${SUFFIX.nl}`, en: `${en || nl}${SUFFIX.en}` } : { ...BARE };
  return { ...c, label, default: false };
}

/**
 * A copy of a dish for the dish editor: no id or dates, names with the suffix per language, every recipe copied
 * (the default stays the default of the copy).
 * @param {Record<string, any>} dish
 */
export function copyDish(dish) {
  const { id: _id, created: _created, updated: _updated, ...rest } = clone(dish);
  const recipes = (dish.recipes ?? []).map((/** @type {Record<string, any>} */ r) => ({ ...copyRecipe(r), id: newId(), label: { nl: String(r.label?.nl ?? ""), en: String(r.label?.en ?? "") }, default: r.default === true }));
  return { ...rest, name: suffixed(dish.name), recipes };
}
