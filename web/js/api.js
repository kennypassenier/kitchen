// The kitchen's JSON API (src/routes.rs) and the one copy of its data.
//
// Every screen reads the kitchen through `loadKitchen()` and changes it
// through the calls below; a change updates the shared copy and tells every
// listener, so two screens never disagree. A failure is an `ApiError` whose
// message is fit to show as it is: the server's own words, or that the
// connection dropped (never that anything is gone).

/** @typedef {Record<string, any>} Item */
/** @typedef {{ format: number, recipes: Item[], freezer: Item[], shelf: Item[], log: Item[], resting: Item[], dishes: Item[], dish_categories: Item[], ingredients: Item[], ingredient_categories: Item[], settings: Record<string, any> }} Kitchen */

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

function tell() {
  if (copy) for (const fn of listeners) fn(copy);
}

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
  const item = await call("POST", `/data/${list}`, body);
  put(list, item);
  return item;
}

/** Replace an item whole. @param {string} list @param {Item} item */
export async function replace(list, item) {
  const saved = await call("PUT", `/data/${list}/${encodeURIComponent(item.id)}`, item);
  put(list, saved);
  return saved;
}

/** Remove an item; resolves to what was removed (keep it for Undo). @param {string} list @param {string} id */
export async function remove(list, id) {
  const gone = await call("DELETE", `/data/${list}/${encodeURIComponent(id)}`);
  if (copy) {
    const arr = /** @type {Item[]} */ (copy[/** @type {keyof Kitchen} */ (list)]);
    const at = arr.findIndex((x) => x.id === id);
    if (at >= 0) arr.splice(at, 1);
    tell();
  }
  return gone;
}

/** The parents' wheel in English, made by the server from the dishes (src/parents.rs). */
export const readWheelEnglish = () => call("GET", "/data/wheel/en");

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
 * Days since a recipe was last cooked, from the log; Infinity when never.
 * @param {Kitchen} k @param {string} recipeId @param {Date} [now]
 */
export function daysSinceCooked(k, recipeId, now = new Date()) {
  let last = -Infinity;
  for (const e of k.log) if (e.recipe_id === recipeId) last = Math.max(last, Date.parse(e.date));
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
