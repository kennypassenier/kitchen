// What the log's buttons and the heat grid do: add a day, change its feeling, remove it (with an undo), pick a day.

import { getSegmentedValues } from "/static/kp/js/segmented.js";
import { runFlashButton } from "/static/kp/js/flash.js";
import { undoToast } from "/static/kp/js/undo-toast.js";
import { create, remove, replace, reason } from "../../api.js";
import { today } from "../../format.js";
import { plus } from "./dates.js";
import { paint } from "./paint.js";

/** @param {unknown} error @param {import("../words.js").Words} words */
const refusal = (error, words) => ({
  error: reason(error),
  word: words.notSaved,
});

/** The log line for the chosen day. @param {import("./paint.js").LogState} s @param {string} recipeId */
const itemOf = (s, recipeId) => ({
  dish_id: s.kitchen?.recipes.find((r) => r.id === recipeId)?.dish_id ?? null,
  recipe_id: recipeId,
  date: s.view.day,
  feeling: s.feeling === "none" ? null : s.feeling,
  note: "",
});

/** Run a save on a flash button and give back its word or its refusal. @param {import("./paint.js").LogState} s @param {HTMLElement} button @param {() => Promise<unknown>} save @param {() => string | undefined} done */
function flashSave(s, button, save, done) {
  void runFlashButton(button, async () => {
    try {
      await save();
      return done();
    } catch (e) {
      return refusal(e, /** @type {import("../words.js").Words} */ (s.words));
    }
  });
}

/** Remove the chosen day's line, with an undo that puts it back. @param {import("./paint.js").LogState} s @param {Record<string, any>} entry */
function dropEntry(s, entry) {
  void remove("log", entry.id).then(
    (gone) => {
      undoToast(s.words?.entryRemoved ?? "", {
        mode: "revert",
        undo: async () => {
          const { id: _old, ...rest } = gone;
          await create("log", rest);
        },
      });
    },
    (e) => undoToast(`${s.words?.notSaved}: ${e instanceof Error ? e.message : e}`, { ms: 0 }),
  );
}

/** @param {import("./paint.js").LogState} s @param {string} recipeId */
export function wireActions(s, recipeId) {
  const { feel, grid, add, change, drop } = s.el;
  feel.addEventListener("kp-segmented-change", (event) => {
    s.feeling = /** @type {CustomEvent} */ (event).detail.value ?? getSegmentedValues(feel)[0] ?? "none";
  });
  grid.addEventListener("kp-heat-pick", (event) => {
    const { rowKey, colKey, picked } = /** @type {CustomEvent} */ (event).detail;
    const day = plus(String(rowKey), Number(colKey));
    s.view.day = picked && day <= today() ? day : today();
    paint(s);
  });
  s.narrow.addEventListener("change", () => paint(s));
  add.addEventListener("click", () => flashSave(s, add, () => create("log", itemOf(s, recipeId)), () => s.words?.added));
  change.addEventListener("click", () => {
    const entry = s.entries.get(s.view.day);
    if (!entry) return;
    flashSave(s, change, () => replace("log", { ...entry, feeling: s.feeling === "none" ? null : s.feeling }), () => s.words?.changed);
  });
  drop.addEventListener("click", () => {
    const entry = s.entries.get(s.view.day);
    if (entry) dropEntry(s, entry);
  });
}
