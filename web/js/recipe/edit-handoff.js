// What a page hands the editor page when it opens a recipe that does not exist yet: a copy (recipe/duplicate.js) or an
// import (recipe/import.js). It lives in the tab's sessionStorage, so a reload of the editor page still finds it; Save and
// Discard clear it. The storage is passed in, so node can test this (scripts/edit-page.test.mjs).

const KEY = "rl-edit-handoff";

/** `draftKey` is the copy's or the import's own draft key (recipe/draft-keys.js). @typedef {{ kind: "copy", preset: Record<string, any>, copyOf: string, draftKey?: string } | { kind: "import", dishId: string | null, restore: Record<string, any>, cover: string | null, draftKey?: string }} Handoff */

/** Keep a handoff for the editor page. Throws when the browser refuses (the caller says so). @param {Pick<Storage, "setItem">} storage @param {Handoff} data */
export const putHandoff = (storage, data) => storage.setItem(KEY, JSON.stringify(data));

/** The handoff of that kind, or null (none, another kind, or unreadable). @param {Pick<Storage, "getItem">} storage @param {"copy" | "import"} kind @returns {Handoff | null} */
export function readHandoff(storage, kind) {
  const raw = storage.getItem(KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    return data && data.kind === kind ? data : null;
  } catch {
    return null;
  }
}

/** @param {Pick<Storage, "removeItem">} storage */
export const clearHandoff = (storage) => storage.removeItem(KEY);
