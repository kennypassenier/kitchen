// What an import becomes, kept pure so node can test it (scripts/import-plan.test.mjs): which input is sent, the draft key,
// and the editor's form state for what the kitchen read. The fetching and the hand-over are recipe/import.js.

import { newId } from "./editor/ids.js";
import { importKey } from "./draft-keys.js";
import { parseIngredientLine, firstMinutes, matchIngredient } from "./import-lines.js";

/** What the server found, as the editor's form state. @typedef {{ name: string, portions: number | null, ingredients: string[], steps: string[], minutes: { prep: number | null, cook: number | null, total: number | null }, image_url: string | null, source_url: string | null }} Imported */

/** Error codes after which pasting the text is the way on. */
const PASTE_INSTEAD = new Set(["no_recipe", "http_status", "not_html", "unreachable", "timeout", "too_large", "too_many_redirects"]);

/** Whether the page should offer the pasted text after this error. @param {string} code @param {boolean} usedPaste */
export const shouldOfferPaste = (code, usedPaste) => PASTE_INSTEAD.has(code) && !usedPaste;

/**
 * What a failed import says: a dropped connection (no answer at all, status 0, or no kitchen error) says so, a page or
 * text without a recipe points at the pasted text, any other error code is said by its own words (`code`).
 * @param {{ fromKitchen: boolean, code: string, status: number, usedPaste: boolean }} o
 * @returns {{ key: string } | { code: string }}
 */
export function failureOf({ fromKitchen, code, status, usedPaste }) {
  if (!fromKitchen || status === 0) return { key: "photo.dropped" };
  if (code === "no_recipe") return { key: usedPaste ? "imp.noText" : "imp.fallback" };
  return { code };
}

/**
 * The request for what was typed: pasted text wins when its fold is open and has text, else the web address.
 * @param {{ address: string, pasted: string, pasteOpen: boolean }} o
 * @returns {{ ok: true, usePaste: boolean, body: { url: string } | { text: string } } | { ok: false }}
 */
export function importInput({ address, pasted, pasteOpen }) {
  const text = pasted.trim();
  const url = address.trim();
  if (pasteOpen && text) return { ok: true, usePaste: true, body: { text } };
  return url ? { ok: true, usePaste: false, body: { url } } : { ok: false };
}

/** The Recipes page with its import field focused: `dish` puts the result into that dish, `site` points at a recipe source. @param {{ dish?: string | null, site?: string | null }} [o] */
export function importHref({ dish = null, site = null } = {}) {
  const q = new URLSearchParams({ import: "1" });
  if (dish) q.set("dish", dish);
  if (site) q.set("site", site);
  return `/recipes?${q}`;
}

/** What the Recipes address asks of the import field. @param {URLSearchParams} params */
export const importAsk = (params) => ({ focus: params.get("import") === "1", dishId: params.get("dish") || null, siteId: params.get("site") || null });


/**
 * The editor's form state for an imported recipe: label from the name, portions, one step per instruction with the first
 * duration it names as its minutes, the page's total as the override only when the page gives one and no step has minutes,
 * and one ingredient line per line (a remark in brackets becomes its note), matched to the catalogue or kept as a proposal
 * that must be resolved before Save, and the page's address as the recipe's source.
 * @param {Imported} imp @param {string | null} dishId @param {{ id: string, name?: { nl?: string, en?: string } }[]} catalogue @param {string} group the ingredient group lines go in
 */
export function toRestore(imp, dishId, catalogue, group) {
  const steps = imp.steps.map((text) => ({ id: newId(), text, track: null, mins: firstMinutes(text), say: "", active: true, mini: true }));
  const stepMinutes = steps.some((s) => s.mins > 0);
  const m = imp.minutes ?? { prep: null, cook: null, total: null };
  const pageTotal = m.total ?? (m.prep || m.cook ? (m.prep ?? 0) + (m.cook ?? 0) : null);
  const ingredients = imp.ingredients.map((line) => {
    const p = parseIngredientLine(line);
    const found = matchIngredient(p.name, catalogue);
    return {
      id: newId(),
      ingredient: found,
      amount: p.amount,
      unit: p.unit,
      group,
      ...(p.note ? { note: p.note } : {}),
      ...(found ? {} : { proposal: { text: p.text, name: p.name } }),
    };
  });
  const name = imp.name.trim();
  return {
    dish_id: dishId,
    new_dish: null,
    ...(name ? { label: { nl: name, en: name } } : {}),
    // Where it came from (Kenny, 29/10/2026): only a web address the server vetted, shown as a link on the recipe page.
    ...(imp.source_url && /^https?:\/\//i.test(imp.source_url) ? { source: imp.source_url } : {}),
    portions: Math.min(24, Math.max(1, imp.portions ?? 2)),
    steps,
    ingredients,
    ...(!stepMinutes && pageTotal ? { minutes: pageTotal, minutes_override: pageTotal } : {}),
  };
}

/**
 * Everything the editor page needs from a read page. `uuid` makes the import's own draft key (recipe/draft-keys.js), so it
 * never writes over a draft kept for a blank new recipe or another import in that dish (fix-draft-key-1).
 * @param {Imported} found @param {string | null} dishId @param {{ id: string }[]} catalogue @param {string} group @param {string} uuid
 */
export const planImport = (found, dishId, catalogue, group, uuid) => ({ key: importKey(dishId, uuid), restore: toRestore(found, dishId, catalogue, group), cover: found.image_url });
