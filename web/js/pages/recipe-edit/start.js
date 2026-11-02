// What the editor page starts from, for an address (recipe/edit-route.js): the saved recipe, a blank one in a dish, or the
// handoff of a copy or an import (recipe/edit-handoff.js).

import { readDraft } from "../../api.js";
import { readHandoff } from "../../recipe/edit-handoff.js";

/**
 * `draftKey` is the copy's or the import's own draft key (recipe/draft-keys.js), "" for the default.
 * @typedef {{ recipe: Record<string, any> | null, preset: Record<string, any>, restore: Record<string, any> | null, copyOf: string, imported: boolean, cover: string | null, draftKey: string }} Start
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
  const blank = { recipe: null, preset: {}, restore: null, copyOf: "", imported: false, cover: null, draftKey: "" };
  if (target.kind === "none") return { missing: true };
  if (target.kind === "edit") {
    const recipe = k.recipes.find((r) => r.id === target.id) ?? null;
    return recipe ? { missing: false, ...blank, recipe } : { missing: true };
  }
  const preset = { ...(target.dishId ? { dish_id: target.dishId } : {}), ...(target.safe ? { safe: true } : {}) };
  if (!target.start) return { missing: false, ...blank, preset };
  return { missing: false, ...blank, ...(await fromHandoff(target, preset, storage)) };
}

/**
 * A copy or an import: the tab's handoff, else (a reload in another tab) the draft under the address's own key. An import
 * starts from its draft when there is one, so a reload keeps what was typed since; a copy starts from the copy and its
 * draft is offered above the form like any other (recipe/editor/draft.js).
 * @param {Extract<import("../../recipe/edit-route.js").EditTarget, { kind: "new" }>} target @param {Record<string, any>} preset @param {Pick<Storage, "getItem">} storage
 * @returns {Promise<Partial<Start>>}
 */
async function fromHandoff(target, preset, storage) {
  const kind = /** @type {"copy" | "import"} */ (target.start);
  const hand = readHandoff(storage, kind);
  // A handoff of another copy or import (another tab's address in this tab) is not this one's.
  const ours = hand && (!target.draft || hand.draftKey === target.draft) ? hand : null;
  const draftKey = target.draft ?? ours?.draftKey ?? "";
  // A draft that cannot be read leaves the handoff to start from; without one, the copy or import is gone (a new recipe).
  const found = draftKey ? await readDraft(draftKey).catch((e) => (console.error("the draft could not be read", e), null)) : null;
  if (ours?.kind === "copy") return { preset: ours.preset, copyOf: ours.copyOf, draftKey };
  if (ours?.kind === "import") return { preset, restore: found?.data ?? ours.restore, imported: true, cover: ours.cover, draftKey };
  if (found) return { preset, restore: found.data, imported: kind === "import", draftKey };
  return { preset };
}
