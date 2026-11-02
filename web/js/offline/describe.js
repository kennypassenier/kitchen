// Words for one refused edit in the failed list (feat-offline-kitchen): what it changed, when it was made and why the
// kitchen refused it. Pure (the words and the language are passed in), so scripts/offline-describe.test.mjs tests it.

import { shapeOf } from "./apply.js";
import { stamp } from "../format.js";
import { pick } from "../recipe/bilingual.js";

/** @typedef {(key: string, ...args: any[]) => string} Words */
/** @typedef {{ method: string, path: string, body?: any, at?: number, conflict?: { status: number, body: any } }} Edit */
/** @typedef {Record<string, any>} KitchenData */

/** The name of an item in `lang`, else its other half, else "". @param {Record<string, any> | null | undefined} item @param {"en" | "nl"} lang */
const nameIn = (item, lang) => String(pick(item?.name ?? "", lang) ?? "").trim();

/**
 * What the edit changes, as a short phrase: "Change to dish “Beef stew”", "Delete of shelf food “Bread”", "Your
 * settings". The name comes from the edit's own body, else from the kitchen as the page holds it.
 * @param {Edit} edit @param {KitchenData | null} kitchen @param {Words} t @param {"en" | "nl"} lang
 */
export function whatOf(edit, kitchen, t, lang) {
  const shape = shapeOf(edit);
  if (!shape) return t("off.whatUnknown");
  if (shape.kind === "settings") return t("off.whatSettings");
  const held = Array.isArray(kitchen?.[shape.list]) ? kitchen[shape.list].find((/** @type {any} */ x) => x.id === shape.id) : null;
  const name = nameIn(edit.body, lang) || nameIn(held, lang);
  const thing = name ? t("off.whatItem", t(`list.${shape.list}`), name) : t(`list.${shape.list}`);
  return shape.kind === "delete" ? t("off.whatDelete", thing) : t("off.whatChange", thing);
}

/** Why the kitchen refused it: changed elsewhere (the kit's 409 "stale"), else the kitchen's own words. @param {Edit} edit @param {Words} t */
export function whyOf(edit, t) {
  const body = edit.conflict?.body;
  if (edit.conflict?.status === 409 && body?.code === "stale") return t("off.failedWhyStale");
  const words = typeof body?.error === "string" && body.error ? body.error : String(edit.conflict?.status ?? "");
  return t("off.failedWhyOther", words);
}

/** When it was made, as the screens show times (dd/mm/yyyy HH:mm, Brussels), or "" when the kit did not say. @param {Edit} edit @param {Words} t */
export const whenOf = (edit, t) => (Number.isFinite(edit.at) ? t("off.failedWhen", stamp(new Date(/** @type {number} */ (edit.at)).toISOString())) : "");
