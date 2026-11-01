// What the "Add a safe dish" list offers. Run: node scripts/safe-choices.test.mjs
import assert from "node:assert/strict";
import { notSafeRecipes, choiceHint } from "../web/js/pages/baddays/safe-choices.js";

const k = { recipes: [{ id: "a", name: "Soup", safe: true }, { id: "b", name: "stew", safe: false }, { id: "c", name: "Curry" }, { id: "d", name: "Anchovy", safe: "yes" }] };
assert.deepEqual(notSafeRecipes(k).map((r) => r.id), ["d", "c", "b"], "everything that is not exactly safe, by name, case-blind");
assert.deepEqual(notSafeRecipes({ recipes: [{ id: "a", name: "x", safe: true }] }), [], "all safe: nothing to offer");
assert.equal(choiceHint({ id: "a", name: "x", minutes: 40, gear: "a pan" }), "40 min, a pan");
assert.equal(choiceHint({ id: "a", name: "x" }), "", "no time and no gear: no hint");
console.log("safe-choices: ok");
