// node --test scripts/offline-keep-plan.test.mjs: what "Offline bewaren" on one recipe keeps and lets go in the kit's
// local database, and which kept dishes the server deleted (feat-offline-recipe, feat-offline-gone; on chassisData.db
// since feat-db-pages-2, web/js/offline/keep-plan.js). Written 03/11/2026, NOT run (Kenny's test rule): docs/OPEN.md
// release check 16.
import test from "node:test";
import assert from "node:assert/strict";
import { createNoticeOnce, dishIngredientIds, goneDishIds, keepStateOf, keptCount, missingIngredientIds, orphanIngredientIds, releasePlan } from "../web/js/offline/keep-plan.js";

const dish = (id, ...lines) => ({ id, recipes: [{ id: `${id}-r`, ingredients: lines.map((ingredient) => ({ ingredient })) }] });

test("the toggle is hidden while everything is kept, else shows the dish's mark", () => {
  assert.equal(keepStateOf(true, false), "all");
  assert.equal(keepStateOf(false, true), "kept");
  assert.equal(keepStateOf(false, false), "not-kept");
});

test("a dish names the ingredients of every recipe once, in first-use order; odd lines are skipped", () => {
  const d = { id: "d", recipes: [{ ingredients: [{ ingredient: "salt" }, { ingredient: "" }, {}] }, { ingredients: [{ ingredient: "beef" }, { ingredient: "salt" }] }, {}] };
  assert.deepEqual(dishIngredientIds(d), ["salt", "beef"]);
  assert.deepEqual(dishIngredientIds(null), []);
});

test("letting a dish go releases only the ingredients no other kept dish names", () => {
  const kept = [dish("d1", "salt", "beef"), dish("d2", "salt")];
  assert.deepEqual(releasePlan(kept, dish("d1", "salt", "beef")), ["beef"]);
  assert.deepEqual(releasePlan([], dish("d1", "salt")), ["salt"]);
});

test("orphans: kept ingredients no kept dish names; missing: names a kept dish uses that are not kept yet", () => {
  const kept = [dish("d1", "salt", "beer")];
  assert.deepEqual(orphanIngredientIds(kept, [{ id: "salt" }, { id: "beef" }]), ["beef"]);
  assert.deepEqual(missingIngredientIds(kept, [{ id: "salt" }]), ["beer"]);
});

test("the kept count is every recipe of every dish the device holds", () => {
  assert.deepEqual(keptCount([{ id: "a", recipes: [{}, {}] }, { id: "b" }]), { recipes: 2, dishes: 2 });
  assert.deepEqual(keptCount([]), { recipes: 0, dishes: 0 });
});

test("a kept dish that left the database is gone unless this device deleted or let it go", () => {
  const before = new Set(["a", "b", "c"]);
  assert.deepEqual(goneDishIds(before, new Set(["a"]), new Set(["c"])), ["b"]);
  assert.deepEqual(goneDishIds(before, before, new Set()), []);
});

test("each gone dish gets the notice once", () => {
  const once = createNoticeOnce();
  assert.equal(once.claim("a"), true);
  assert.equal(once.claim("a"), false);
  assert.equal(once.claim("b"), true);
});
