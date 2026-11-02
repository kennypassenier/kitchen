// node --test scripts/timing-count.test.mjs: the picker line on "When do I start?" counts the steps, as the plan does
// (web/js/pages/timing/count.js, Kenny 02/11/2026 03:43, feat-timing-durations-1).
import test from "node:test";
import assert from "node:assert/strict";
import { countedMinutes, timedSteps } from "../web/js/pages/timing/count.js";

const tracks = [{ id: "p", name: "Pasta" }, { id: "s", name: "Sauce" }];
const step = (id, track, mins, extra = {}) => ({ id, track, mins, active: false, ...extra });

test("the counted total wins over the stored minutes", () => {
  const recipe = { minutes: 90, tracks: [], steps: [step("a", null, 10), step("b", null, 15)] };
  assert.equal(countedMinutes(recipe), 25);
});

test("tracks side by side count the longest path, a meeting step after them", () => {
  const recipe = { minutes: 5, tracks, steps: [step("a", "p", 10), step("b", "s", 20), step("m", null, 3)] };
  assert.equal(countedMinutes(recipe), 23);
});

test("steps without minutes are left out, as the plan leaves them out", () => {
  const recipe = { tracks: [], steps: [step("a", null, 0), step("b", null, 12), step("c", null, "")] };
  assert.equal(timedSteps(recipe).length, 1);
  assert.equal(countedMinutes(recipe), 12);
});

test("a slow pace stretches only the hands-on steps", () => {
  const recipe = { tracks: [], steps: [step("a", null, 20, { active: true }), step("b", null, 10)] };
  assert.equal(countedMinutes(recipe, 1.25), 35);
});

test("a first step placed later by hand counts from there, as the plan starts there", () => {
  const recipe = { tracks: [], steps: [step("a", null, 10, { start: 5 }), step("b", null, 5)] };
  assert.equal(countedMinutes(recipe), 15);
});

test("a recipe without timed steps counts nothing", () => {
  assert.equal(countedMinutes({ steps: [] }), 0);
});
