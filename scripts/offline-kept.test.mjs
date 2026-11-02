// node --test scripts/offline-kept.test.mjs: the recipes kept one by one (feat-offline-recipe, Kenny 02/11/2026 17:25
// and 19:12): which dishes the kit keeps (web/js/offline/kept.js), what the recipe page's toggle shows, the settings
// count, the partial kitchen read without a connection, and the route table (web/js/offline/config.js).
// Written on 02/11/2026, not run (Kenny's test rule): a release check in docs/OPEN.md.
import test from "node:test";
import assert from "node:assert/strict";
import { keepStateOf, keptCount, keptDishIds, partialKitchen } from "../web/js/offline/kept.js";
import { DISH_ROUTE, KITCHEN_PATH, LOOKUP_PATHS, PER_RECIPE_KEEP, dishPath, offlineRoutes } from "../web/js/offline/config.js";

test("a dish path is the item route with the id escaped", () => {
  assert.equal(dishPath("d1"), "/data/dishes/d1");
  assert.equal(dishPath("a b/c"), "/data/dishes/a%20b%2Fc");
});

test("the kept dish ids come from dish paths only, unescaped, in order", () => {
  const items = [dishPath("d2"), "/data/freezer/f1", dishPath("a b"), "/data/dishes/x/y"];
  assert.deepEqual(keptDishIds(items), ["d2", "a b"]);
});

test("a malformed escape is skipped, not thrown", () => {
  assert.deepEqual(keptDishIds(["/data/dishes/%E0%A4%A", dishPath("ok")]), ["ok"]);
});

test("the toggle is hidden while per-recipe keeping is not live, and with keep everything on", () => {
  const settings = { all: false, items: [dishPath("d1")] };
  assert.equal(keepStateOf(settings, "d1", false), "hidden");
  assert.equal(keepStateOf({ all: true, items: [] }, "d1", true), "all");
  assert.equal(keepStateOf(settings, "d1", true), "kept");
  assert.equal(keepStateOf(settings, "d2", true), "not-kept");
});

test("the count is every recipe of every kept dish the kitchen still holds", () => {
  const kitchen = {
    dishes: [
      { id: "d1", recipes: [{ id: "r1" }, { id: "r2" }] },
      { id: "d2", recipes: [{ id: "r3" }] },
      { id: "d3" },
    ],
  };
  assert.deepEqual(keptCount([dishPath("d1"), dishPath("d3"), dishPath("gone")], kitchen), { recipes: 2, dishes: 2 });
  assert.deepEqual(keptCount([], kitchen), { recipes: 0, dishes: 0 });
});

test("the partial kitchen holds the kept dishes and lookups, every other list empty", () => {
  const k = partialKitchen({ dishes: [{ id: "d1", recipes: [] }], ingredients: [{ id: "i1" }], settings: { timer_sound: "chime" } });
  assert.equal(k.partial, true);
  assert.deepEqual(k.dishes, [{ id: "d1", recipes: [] }]);
  assert.deepEqual(k.ingredients, [{ id: "i1" }]);
  assert.deepEqual(k.settings, { timer_sound: "chime" });
  for (const list of ["recipes", "freezer", "shelf", "log", "resting", "dish_categories", "ingredient_categories"]) assert.deepEqual(k[list], [], list);
});

test("the route table keeps only the whole kitchen until per-recipe keeping is live", () => {
  assert.equal(PER_RECIPE_KEEP, false, "flip together with the kit bump row in docs/OPEN.md");
  assert.deepEqual(offlineRoutes(false), [KITCHEN_PATH]);
  assert.deepEqual(offlineRoutes(true), [KITCHEN_PATH, DISH_ROUTE, ...LOOKUP_PATHS]);
  assert.equal(DISH_ROUTE, "/data/dishes/:id");
});
