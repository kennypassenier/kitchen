// node --test scripts/tonight.test.mjs: tonight's wheel answer as the timing page reads it (web/js/tonight.js, Kenny
// 01/11/2026 "Eén kiezer").
import test from "node:test";
import assert from "node:assert/strict";
import { tonightOf, tonightRecipe } from "../web/js/tonight.js";

const DAY = "2026-11-01";

test("a dish with a recipe is kept with its day", () => {
  assert.deepEqual(tonightOf({ id: "d1", cookId: "r1" }, DAY), { day: DAY, dish: "d1", recipe: "r1" });
});

test("a dish without a recipe keeps nothing", () => {
  assert.equal(tonightOf({ id: "d1", cookId: null }, DAY), null);
  assert.equal(tonightOf(/** @type {any} */ (null), DAY), null);
});

test("today's answer gives its recipe", () => {
  assert.equal(tonightRecipe(JSON.stringify(tonightOf({ id: "d1", cookId: "r1" }, DAY)), DAY), "r1");
});

test("yesterday's answer, nothing stored, or junk gives none", () => {
  assert.equal(tonightRecipe(JSON.stringify({ day: "2026-10-31", dish: "d1", recipe: "r1" }), DAY), null);
  assert.equal(tonightRecipe(null, DAY), null);
  assert.equal(tonightRecipe("{not json", DAY), null);
  assert.equal(tonightRecipe(JSON.stringify({ day: DAY, recipe: "" }), DAY), null);
  assert.equal(tonightRecipe("42", DAY), null);
});
