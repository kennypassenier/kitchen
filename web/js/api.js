// The kitchen's JSON API (src/routes.rs) and the one copy of its data.
//
// Every screen reads the kitchen through `loadKitchen()` and changes it
// through the calls below; a change updates the shared copy and tells every
// listener, so two screens never disagree. A failure is an `ApiError` whose
// message is fit to show as it is: the server's own words, or that the
// connection dropped (never that anything is gone).

/** @typedef {Record<string, any>} Item */
/** @typedef {{ format: number, recipes: Item[], freezer: Item[], shelf: Item[], log: Item[], resting: Item[], dishes: Item[], dish_categories: Item[], ingredients: Item[], ingredient_categories: Item[], drafts?: Item[], recipe_sources?: Item[], settings: Record<string, any> }} Kitchen */

import { nameOf, lang, onLang, t } from "./i18n/index.js";

export class ApiError extends Error {
  /** @param {string} message @param {number} status */
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/** @param {string} method @param {string} path @param {unknown} [body] */
async function call(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError("The connection to the kitchen dropped. Nothing is lost; try again.", 0);
  }
  if (res.status === 401) {
    location.assign(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    throw new ApiError("Signed out; opening the login page.", 401);
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON: handled below */
  }
  if (!res.ok) throw new ApiError(data?.error ?? `The kitchen answered ${res.status}.`, res.status);
  return data;
}

/** @type {Kitchen | null} */
let copy = null;
/** @type {Promise<Kitchen> | null} */
let pending = null;
/** @type {Set<(k: Kitchen) => void>} */
const listeners = new Set();

// The recipes are a view (Kenny, 24/10/2026 09:18, 09:27: "the recipe belongs to the dish", and a dish may have
// several): the store keeps them in their dish (`dish.recipes`, one `default`); every screen that reads `k.recipes`
// sees all of them, each with its own id, its dish (`dish_id`) and a name made of the dish's name and, when the dish
// has more than one or it has a label, its label ("Stoofvlees · Oven"). A create, replace or remove on "recipes"
// goes to the dish.

/** The recipe fields a dish keeps for it; the view's name, dish and dates are not stored. @param {Item} r */
function recipeBody(r) {
  const { name, created, updated, isNew, dish_id, dishName, new_dish, ...body } = r;
  return body;
}

/** A recipe's own label in the language shown, else its other half, else "Recipe n". @param {Item} r @param {number} i */
export function recipeLabel(r, i) {
  const own = String(r.label?.[lang()] || r.label?.[lang() === "nl" ? "en" : "nl"] || "").trim();
  return own || t("recipes.numbered", i + 1);
}

/** All recipes of all dishes, as recipes. @param {Kitchen} k */
function recipeView(k) {
  return (k.dishes ?? []).flatMap((d) => {
    const list = Array.isArray(d.recipes) ? d.recipes : [];
    const dish = nameOf(d).text;
    return list.map((r, i) => {
      const own = String(r.label?.[lang()] || r.label?.[lang() === "nl" ? "en" : "nl"] || "").trim();
      return { ...r, dish_id: d.id, dishName: dish, name: list.length > 1 || own ? `${dish} · ${recipeLabel(r, i)}` : dish, created: d.created, updated: d.updated };
    });
  });
}

function tell() {
  if (!copy) return;
  copy.recipes = recipeView(copy);
  for (const fn of listeners) fn(copy);
}

// A recipe's name is its dish's name in the language shown: read it again when the language changes.
onLang(() => {
  if (copy) copy.recipes = recipeView(copy);
});

/**
 * The whole kitchen; read once and shared. `force` reads it again (Retry).
 * @param {{ force?: boolean }} [opts]
 * @returns {Promise<Kitchen>}
 */
export function loadKitchen({ force = false } = {}) {
  if (copy && !force) return Promise.resolve(copy);
  if (pending && !force) return pending;
  pending = call("GET", "/data/kitchen").then(
    (k) => {
      copy = k;
      copy.recipes = recipeView(k);
      pending = null;
      tell();
      return k;
    },
    (e) => {
      pending = null;
      throw e;
    },
  );
  return pending;
}

/** The kitchen as last read, or null. */
export const kitchenNow = () => copy;

/**
 * @param {(k: Kitchen) => void} fn called after every change
 * @returns {() => void} stop listening
 */
export function onKitchen(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** @param {string} list @param {Item} item */
function put(list, item) {
  if (!copy) return;
  const arr = /** @type {Item[]} */ (copy[/** @type {keyof Kitchen} */ (list)]);
  const at = arr.findIndex((x) => x.id === item.id);
  if (at >= 0) arr[at] = item;
  else arr.push(item);
  tell();
}

/** Add an item to a list; resolves to the item with its new id. @param {string} list @param {Item} body */
export async function create(list, body) {
  if (list === "recipes") {
    // A new recipe goes into a dish and never makes one silently (Kenny, 29/10/2026): `dish_id` is the dish it joins,
    // `new_dish` ({nl, en}, both halves) a dish made together with it; neither is an error. `label` is the recipe's own
    // label ({nl, en}; both halves or none).
    const at = body.dish_id ? copy?.dishes.find((d) => d.id === body.dish_id) : null;
    const id = crypto.randomUUID();
    const label = { nl: String(body.label?.nl ?? ""), en: String(body.label?.en ?? "") };
    if (at) {
      const list = Array.isArray(at.recipes) ? at.recipes : [];
      await replace("dishes", { ...at, recipes: [...list, { ...recipeBody(body), id, label, default: !list.some((r) => r.default === true) }] });
    } else if (body.new_dish?.nl && body.new_dish?.en) {
      await create("dishes", { name: { nl: String(body.new_dish.nl), en: String(body.new_dish.en) }, category: null, parents: false, ingredients: [], sides: [], recipes: [{ ...recipeBody(body), id, label, default: true }] });
    } else {
      throw new ApiError("A recipe belongs to a dish: pick one, or name a new one.", 400);
    }
    return copy?.recipes.find((r) => r.id === id) ?? { ...body, id };
  }
  const item = await call("POST", `/data/${list}`, body);
  put(list, item);
  return item;
}

/** Replace an item whole. @param {string} list @param {Item} item */
export async function replace(list, item) {
  if (list === "recipes") {
    // A recipe saved is its dish saved. When `dish_id` names another dish the recipe MOVES (Kenny, 29/10/2026): it is
    // added to the new dish first (the default only when that dish had none), then taken off the old one, whose first
    // remaining recipe becomes the default when the moved one was it. `label` ({nl, en}) replaces the label when given.
    const dish = copy?.dishes.find((d) => (d.recipes ?? []).some((/** @type {Item} */ r) => r.id === item.id));
    if (!dish) throw new ApiError("That recipe does not exist (any more).", 404);
    const list = /** @type {Item[]} */ (dish.recipes);
    const old = /** @type {Item} */ (list.find((r) => r.id === item.id));
    const label = item.label ? { nl: String(item.label.nl ?? ""), en: String(item.label.en ?? "") } : { ...(old.label ?? { nl: "", en: "" }) };
    const target = item.dish_id && item.dish_id !== dish.id ? copy?.dishes.find((d) => d.id === item.dish_id) : null;
    if (item.dish_id && item.dish_id !== dish.id && !target) throw new ApiError("That dish does not exist (any more).", 404);
    if (target) {
      const there = Array.isArray(target.recipes) ? target.recipes : [];
      const moved = { ...recipeBody(item), id: item.id, label, default: !there.some((/** @type {Item} */ r) => r.default === true) };
      await replace("dishes", { ...target, recipes: [...there, moved] });
      const rest = list.filter((r) => r.id !== item.id);
      if (rest.length && !rest.some((r) => r.default === true)) rest[0] = { ...rest[0], default: true };
      try {
        await replace("dishes", { ...dish, recipes: rest });
      } catch (e) {
        await replace("dishes", { ...target, recipes: there }).catch(() => {}); // not in both dishes
        throw e;
      }
    } else {
      await replace("dishes", { ...dish, recipes: list.map((r) => (r.id === item.id ? { ...recipeBody(item), id: item.id, label, default: old.default === true } : r)) });
    }
    return copy?.recipes.find((r) => r.id === item.id) ?? item;
  }
  const saved = await call("PUT", `/data/${list}/${encodeURIComponent(item.id)}`, item);
  put(list, saved);
  return saved;
}

/** Remove an item; resolves to what was removed (keep it for Undo). @param {string} list @param {string} id */
export async function remove(list, id) {
  if (list === "recipes") {
    // Removing a recipe takes it off its dish; the dish stays, and its first other recipe becomes the default.
    const dish = copy?.dishes.find((d) => (d.recipes ?? []).some((/** @type {Item} */ r) => r.id === id));
    if (!dish) throw new ApiError("That recipe does not exist (any more).", 404);
    const was = copy?.recipes.find((r) => r.id === id);
    const rest = /** @type {Item[]} */ (dish.recipes).filter((r) => r.id !== id);
    if (rest.length && !rest.some((r) => r.default === true)) rest[0] = { ...rest[0], default: true };
    await replace("dishes", { ...dish, recipes: rest });
    return was;
  }
  const gone = await call("DELETE", `/data/${list}/${encodeURIComponent(id)}`);
  if (copy) {
    const arr = /** @type {Item[]} */ (copy[/** @type {keyof Kitchen} */ (list)]);
    const at = arr.findIndex((x) => x.id === id);
    if (at >= 0) arr.splice(at, 1);
    tell();
  }
  return gone;
}

// Drafts (Kenny, 29/10/2026): the recipe editor autosaves its form into the kitchen's database, one per key (a recipe's id,
// or `new:<dish id>`), so a closed tab or a dropped connection loses nothing. The server keeps one per key (src/store.rs);
// the shared copy is not told, so no page redraws on every autosave.

/** The draft saved under `key`, or null. @param {string} key @returns {Promise<Item | null>} */
export async function readDraft(key) {
  const all = await call("GET", "/data/drafts");
  return (Array.isArray(all) ? all : []).find((/** @type {Item} */ d) => d.key === key) ?? null;
}

/** Save (or replace) the draft under `key`. @param {string} key @param {Item} data */
export async function saveDraft(key, data) {
  return call("POST", "/data/drafts", { key, data });
}

/** Delete the draft under `key`, if there is one. @param {string} key */
export async function deleteDraft(key) {
  const draft = await readDraft(key);
  if (draft) await call("DELETE", `/data/drafts/${encodeURIComponent(draft.id)}`);
}

/** A recipe read from a web page (`{ url }`) or pasted text (`{ text }`), normalised; a refusal's message is its code (src/import.rs). @param {{ url?: string, text?: string }} body */
export const importRecipe = (body) => call("POST", "/data/import", body);

/** The parents' wheel in English, made by the server from the dishes (src/parents.rs). */
export const readWheelEnglish = () => call("GET", "/data/wheel/en");
/** The same list in Dutch, behind the login: Kitchen's /parents in Dutch, also away from home. */
export const readWheelDutch = () => call("GET", "/data/wheel/nl");

/** Take portions out of the freezer (negative puts them back). @param {string} id @param {number} [portions] */
export async function takePortions(id, portions = 1) {
  const item = await call("POST", `/data/freezer/${encodeURIComponent(id)}/take`, { portions });
  put("freezer", item);
  return item;
}

/** Merge keys into the settings (`null` removes one). @param {Record<string, unknown>} patch */
export async function patchSettings(patch) {
  const settings = await call("PATCH", "/data/settings", patch);
  if (copy) {
    copy.settings = settings;
    tell();
  }
  return settings;
}

/** A recipe by id from the shared copy. @param {string | null} id */
export const recipeById = (id) => copy?.recipes.find((r) => r.id === id) ?? null;

/**
 * Days since a dish (or its recipe, which has the dish's id) was last cooked, from the log; Infinity when never.
 * @param {Kitchen} k @param {string} dishId @param {Date} [now]
 */
export function daysSinceCooked(k, dishId, now = new Date()) {
  let last = -Infinity;
  for (const e of k.log) if (e.dish_id === dishId) last = Math.max(last, Date.parse(e.date));
  if (last === -Infinity) return Infinity;
  return Math.floor((now.getTime() - last) / 86_400_000);
}

/** An ingredient by id (Kenny, 24/10/2026 05:15: sides and recipe lines point at one list). @param {string | null | undefined} id */
export const ingredientById = (id) => (id ? copy?.ingredients?.find((i) => i.id === id) ?? null : null);

/**
 * An ingredient's name in `lang`, else its other half; an id that points at nothing says so.
 * @param {string | null | undefined} id @param {"en" | "nl"} [lang]
 */
export function ingredientName(id, lang = "en") {
  const i = ingredientById(id);
  if (!i) return lang === "nl" ? "(verwijderd ingrediënt)" : "(deleted ingredient)";
  const other = lang === "nl" ? "en" : "nl";
  return String(i.name?.[lang] || i.name?.[other] || "").trim() || "(no name)";
}

/** Make a recipe its dish's default (the wheel's and Cook this's). @param {string} id */
export async function makeDefaultRecipe(id) {
  const dish = copy?.dishes.find((d) => (d.recipes ?? []).some((/** @type {Item} */ r) => r.id === id));
  if (!dish) throw new ApiError("That recipe does not exist (any more).", 404);
  await replace("dishes", { ...dish, recipes: dish.recipes.map((/** @type {Item} */ r) => ({ ...r, default: r.id === id })) });
}

/** A dish's default recipe, or null when it has none. @param {Item | null | undefined} dish */
export const defaultRecipe = (dish) => {
  const list = Array.isArray(dish?.recipes) ? dish.recipes : [];
  return list.find((r) => r.default === true) ?? list[0] ?? null;
};
