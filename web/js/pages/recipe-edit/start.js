// What the editor page starts from, for an address (recipe/edit-route.js): the saved recipe, a blank one in a dish, or the
// handoff of a copy or an import (recipe/edit-handoff.js).

import { readDraft } from "../../api.js";
import { readHandoff } from "../../recipe/edit-handoff.js";

/**
 * @typedef {{ recipe: Record<string, any> | null, preset: Record<string, any>, restore: Record<string, any> | null, copyOf: string, imported: boolean, cover: string | null }} Start
 * @typedef {{ missing: true } | ({ missing: false } & Start)} Resolved
 */

/** The main ingredients the recipes already name, for the editor's suggestions. @param {import("../../api.js").Kitchen} k */
export const mainOptionsOf = (k) => [...new Set((k.recipes ?? []).flatMap((r) => r.ing ?? []))];

/**
 * @param {import("../../recipe/edit-route.js").EditTarget} target @param {import("../../api.js").Kitchen} k @param {Pick<Storage, "getItem">} storage
 * @returns {Promise<Resolved>}
 */
export async function resolveStart(target, k, storage) {
  /** @type {Start} */
  const blank = { recipe: null, preset: {}, restore: null, copyOf: "", imported: false, cover: null };
  if (target.kind === "none") return { missing: true };
  if (target.kind === "edit") {
    const recipe = k.recipes.find((r) => r.id === target.id) ?? null;
    return recipe ? { missing: false, ...blank, recipe } : { missing: true };
  }
  const preset = { ...(target.dishId ? { dish_id: target.dishId } : {}), ...(target.safe ? { safe: true } : {}) };
  if (target.start === "copy") {
    const hand = readHandoff(storage, "copy");
    if (hand?.kind === "copy") return { missing: false, ...blank, preset: hand.preset, copyOf: hand.copyOf };
  }
  if (target.start === "import") {
    const hand = readHandoff(storage, "import");
    if (hand?.kind === "import") return { missing: false, ...blank, preset, restore: hand.restore, imported: true, cover: hand.cover };
    // A reload in a new tab has no handoff: the draft the import wrote is the import.
    const found = await readDraft(`new:${target.dishId ?? ""}`);
    if (found) return { missing: false, ...blank, preset, restore: found.data, imported: true };
  }
  return { missing: false, ...blank, preset };
}
