// node --test scripts/wheel-tri.test.mjs: a wheel filter chip's Want / Not / Either way menu mapped onto the model's tri
// (web/js/pages/wheel/tri.js, Kenny 01/11/2026 "Klein menu"). The filtering itself is unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import { TRI_STATES, isTriState, stateOf, withState, keepOnly, markOf } from "../web/js/pages/wheel/tri.js";
import { fits } from "../web/js/pages/wheel/logic.js";

const tri = (include = [], exclude = []) => ({ include, exclude });

test("the menu offers Want, Not, Either way in that order", () => {
  assert.deepEqual([...TRI_STATES], ["want", "not", "either"]);
  assert.equal(isTriState("not"), true);
  assert.equal(isTriState("include"), false);
});

test("a chip reads its answer from the tri", () => {
  const t = tri(["dinner"], ["lunch"]);
  assert.equal(stateOf(t, "dinner"), "want");
  assert.equal(stateOf(t, "lunch"), "not");
  assert.equal(stateOf(t, "breakfast"), "either");
});

test("an answer moves the value to its list and keeps the others in order", () => {
  const t = tri(["a", "b"], ["c"]);
  assert.deepEqual(withState(t, "a", "not"), tri(["b"], ["c", "a"]));
  assert.deepEqual(withState(t, "c", "want"), tri(["a", "b", "c"], []));
  assert.deepEqual(withState(t, "b", "either"), tri(["a"], ["c"]));
  assert.deepEqual(withState(t, "x", "either"), t);
  assert.deepEqual(t, tri(["a", "b"], ["c"]), "the given tri is not changed");
});

test("the same answer twice changes nothing", () => {
  const once = withState(tri(), "beef", "want");
  assert.deepEqual(withState(once, "beef", "want"), once);
});

test("values without a chip are dropped", () => {
  assert.deepEqual(keepOnly(tri(["beef", "gone"], ["fish", "old"]), ["beef", "fish"]), tri(["beef"], ["fish"]));
});

test("each answer has its mark; either way has none", () => {
  assert.equal(markOf("want"), "✓");
  assert.equal(markOf("not"), "✕");
  assert.equal(markOf("either"), "");
});

test("the menu's answers filter as the old chips did (logic.fits unchanged)", () => {
  const m = (meal) => ({ meal, time: tri(), ing: tri(), cat: tri(), easy: false, kinds: new Set(), resting: new Set(), order: [] });
  const dish = { id: "d", meals: ["dinner"], minutes: 30, ing: [], category: null, safe: false, freezer: 0, prep: "light", days: null };
  assert.equal(fits(dish, m(withState(tri(), "dinner", "want"))), true);
  assert.equal(fits(dish, m(withState(tri(), "dinner", "not"))), false);
  assert.equal(fits(dish, m(withState(tri(), "lunch", "want"))), false);
  assert.equal(fits(dish, m(withState(tri(["lunch"]), "lunch", "either"))), true);
});
