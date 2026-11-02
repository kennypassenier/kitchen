// node --test scripts/offline-gone.test.mjs: a kept recipe whose dish is gone from the kitchen (feat-offline-gone, Kenny
// 02/11/2026 19:43, "Uit kopie halen"): the pure decision (web/js/offline/gone.js, kept.js) that a real 404 drops the
// keep and says so once, a lost connection keeps everything, and any other refusal keeps the copy and is surfaced.
// Written on 02/11/2026, not run (Kenny's test rule): a release check in docs/OPEN.md.
import test from "node:test";
import assert from "node:assert/strict";
import { classifyDishRead, createNoticeOnce, missingKeptDishIds } from "../web/js/offline/gone.js";
import { orphanIngredientPaths } from "../web/js/offline/kept.js";
import { dishPath, ingredientPath } from "../web/js/offline/config.js";

/** The kit's error shape: a message with `status` (and `offline` when there was neither a connection nor a copy). */
const kitError = (status, extra = {}) => Object.assign(new Error("chassisData: x"), { status, ...extra });

test("a real 404 means the dish is gone", () => {
  assert.equal(classifyDishRead(kitError(404, { body: { error: "no such dish" } })), "gone");
});

test("no connection is never gone, with or without the offline flag", () => {
  assert.equal(classifyDishRead(kitError(0, { offline: true })), "offline");
  assert.equal(classifyDishRead(kitError(0)), "offline");
  assert.equal(classifyDishRead(Object.assign(new Error("x"), { offline: true })), "offline");
});

test("any other refusal or a bare error keeps the copy and is surfaced", () => {
  for (const status of [400, 401, 403, 409, 500, 502, 503]) assert.equal(classifyDishRead(kitError(status)), "error", String(status));
  assert.equal(classifyDishRead(new Error("a bad path")), "error");
  assert.equal(classifyDishRead(null), "error");
  assert.equal(classifyDishRead("404"), "error");
});

test("only kept dishes missing from the kitchen's list are asked about", () => {
  const server = [{ id: "d1" }, { id: "d3" }];
  assert.deepEqual(missingKeptDishIds(["d1", "d2", "d3", "d4"], server), ["d2", "d4"]);
  assert.deepEqual(missingKeptDishIds([], server), []);
  assert.deepEqual(missingKeptDishIds(["d1"], []), ["d1"]);
});

test("the notice is claimed once per dish", () => {
  const once = createNoticeOnce();
  assert.equal(once.claim("d1"), true);
  assert.equal(once.claim("d1"), false);
  assert.equal(once.claim("d2"), true);
});

test("a decision walk: 404 drops and tells once, offline keeps, error keeps", () => {
  const once = createNoticeOnce();
  const told = [];
  const dropped = [];
  for (const [id, err] of [["a", kitError(404)], ["b", kitError(0, { offline: true })], ["c", kitError(500)], ["a", kitError(404)]]) {
    if (classifyDishRead(err) !== "gone") continue;
    dropped.push(id);
    if (once.claim(id)) told.push(id);
  }
  assert.deepEqual(dropped, ["a", "a"]);
  assert.deepEqual(told, ["a"]);
});

const dishes = [
  { id: "d1", recipes: [{ ingredients: [{ ingredient: "salt" }, { ingredient: "beef" }] }] },
  { id: "d2", recipes: [{ ingredients: [{ ingredient: "salt" }] }] },
];

test("ingredients only the gone dish used are swept; shared ones stay while a kept dish uses them", () => {
  // d3 (gone) was kept with salt, beef and beer; d1 stays kept, d2 is not kept.
  const items = [dishPath("d1"), ingredientPath("salt"), ingredientPath("beef"), ingredientPath("beer")];
  assert.deepEqual(orphanIngredientPaths(dishes, items), [ingredientPath("beer")]);
});

test("with no kept dish left every kept ingredient is swept, and other paths are untouched", () => {
  const items = ["/data/freezer/f1", ingredientPath("salt"), ingredientPath("a b")];
  assert.deepEqual(orphanIngredientPaths(dishes, items), [ingredientPath("salt"), ingredientPath("a b")]);
});

test("an ingredient two kept dishes use stays until neither is kept", () => {
  const both = [dishPath("d1"), dishPath("d2"), ingredientPath("salt")];
  assert.deepEqual(orphanIngredientPaths(dishes, both), []);
  assert.deepEqual(orphanIngredientPaths(dishes, [dishPath("d2"), ingredientPath("salt"), ingredientPath("beef")]), [ingredientPath("beef")]);
});
