// Drafts (Kenny, 29/10/2026), moved out of api.js on 01/11/2026: the recipe editor autosaves its form into the kitchen's
// database, one per key (a recipe's id, `new:<dish id>`, or an import's or a copy's own key: recipe/draft-keys.js), so a closed tab or a dropped connection loses nothing. The
// server keeps one per key (src/store/ops.rs); the shared copy is not told, so no page redraws on every autosave.
// Saving one is a POST, which the kit cannot queue: a draft needs a connection (api/http.js says so).

import { call } from "./http.js";
import { readJson, writeJson } from "./kit-data.js";

/** @typedef {Record<string, any>} Item */

/** Every draft the kitchen keeps. @returns {Promise<Item[]>} */
export async function readDrafts() {
  // Read through the kit like every GET; drafts are not kept offline (a draft is saved with a POST, which needs a
  // connection), so without one this says so instead of showing an old list.
  const { data: all } = await readJson("/data/drafts");
  return Array.isArray(all) ? all : [];
}

/** The draft saved under `key`, or null. @param {string} key @returns {Promise<Item | null>} */
export async function readDraft(key) {
  return (await readDrafts()).find((/** @type {Item} */ d) => d.key === key) ?? null;
}

/** Save (or replace) the draft under `key`. `keepalive`: sent while the page goes away. @param {string} key @param {Item} data @param {{ keepalive?: boolean }} [o] */
export async function saveDraft(key, data, o = {}) {
  return call("POST", "/data/drafts", { key, data }, o);
}

/** Delete the draft under `key`, if there is one. @param {string} key */
export async function deleteDraft(key) {
  const draft = await readDraft(key);
  if (draft) await writeJson("DELETE", `/data/drafts/${encodeURIComponent(draft.id)}`);
}

