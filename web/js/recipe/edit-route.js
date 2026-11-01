// The recipe editor's address (ux-editor-page-1, Kenny 01/11/2026): pure parsing, building and return-target logic, no DOM.
// Tested by scripts/edit-page.test.mjs.
//
//   /recipe/edit?id=<recipe id>                        edit a saved recipe
//   /recipe/edit?dish=<dish id>  or  ?new=1            a new recipe (in that dish); `safe=1` marks it a safe dish
//   /recipe/edit?new=1&start=copy|import               a new recipe that starts from a handoff (recipe/edit-handoff.js)
//   &from=<path>                                       where Save and Back return to (a path inside the app)

export const EDIT_PATH = "/recipe/edit";

/** @typedef {{ kind: "edit", id: string } | { kind: "new", dishId: string | null, safe: boolean, start: "copy" | "import" | null } | { kind: "none" }} EditTarget */

/**
 * What an address asks for. An `id` wins; otherwise `dish` or `new` ask for a new recipe; anything else is nothing.
 * @param {URLSearchParams} params @returns {EditTarget}
 */
export function parseEdit(params) {
  const id = params.get("id");
  if (id) return { kind: "edit", id };
  const dish = params.get("dish");
  if (!dish && params.get("new") !== "1") return { kind: "none" };
  const start = params.get("start");
  return { kind: "new", dishId: dish || null, safe: params.get("safe") === "1", start: start === "copy" || start === "import" ? start : null };
}

/**
 * A path the app may return to: inside the app, not another origin, not the editor itself. Anything else is null.
 * @param {string | null | undefined} from @returns {string | null}
 */
export function safeReturn(from) {
  if (!from || !from.startsWith("/") || from.startsWith("//") || from.includes("\\")) return null;
  const path = from.split(/[?#]/)[0].replace(/\/+$/, "");
  return path === EDIT_PATH ? null : from;
}

/** Where the person is now, as a return address (null on the editor itself). @param {{ pathname: string, search: string }} loc */
export const here = (loc) => safeReturn(loc.pathname + loc.search);

/**
 * The editor's address. @param {{ id?: string, dish?: string | null, safe?: boolean, start?: "copy" | "import" }} spec @param {string | null} [from]
 */
export function editHref(spec, from = null) {
  const q = new URLSearchParams();
  if (spec.id) q.set("id", spec.id);
  else {
    q.set("new", "1");
    if (spec.dish) q.set("dish", spec.dish);
    if (spec.safe) q.set("safe", "1");
    if (spec.start) q.set("start", spec.start);
  }
  const back = safeReturn(from);
  if (back) q.set("from", back);
  return `${EDIT_PATH}?${q}`;
}

/** The recipe's own page. @param {string} id */
export const recipeHref = (id) => `/recipe?id=${encodeURIComponent(id)}`;

/** Where Back goes: the page the person came from, else the recipe's page, else the list. @param {EditTarget} target @param {string | null} from */
export const backTarget = (target, from) => safeReturn(from) ?? (target.kind === "edit" ? recipeHref(target.id) : "/recipes");

/** Where Save goes: back to where the person came from, else the saved recipe's page. @param {string | null} from @param {string} savedId */
export const afterSave = (from, savedId) => safeReturn(from) ?? recipeHref(savedId);
