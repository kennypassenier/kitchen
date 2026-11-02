// node --test scripts/offline-kept.test.mjs: the recipes kept one by one (feat-offline-recipe, Kenny 02/11/2026 17:25
// and 19:12): which dishes the kit keeps (web/js/offline/kept.js), what the recipe page's toggle shows, the settings
// count, the partial kitchen read without a connection, and the route table (web/js/offline/config.js).
// Written on 02/11/2026, not run (Kenny's test rule): a release check in docs/OPEN.md.
import test from "node:test";
import assert from "node:assert/strict";
import { dishIngredientIds, ingredientPlan, keepStateOf, keptCount, keptDishIds, keptRefreshPlan, partialKitchen } from "../web/js/offline/kept.js";
import { DISH_ROUTE, INGREDIENTS_PATH, INGREDIENT_ROUTE, KITCHEN_PATH, OFFLINE_ROUTES, dishPath, ingredientPath } from "../web/js/offline/config.js";

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

test("the toggle is hidden with keep everything on, else says whether the dish is kept", () => {
  const settings = { all: false, items: [dishPath("d1")] };
  assert.equal(keepStateOf({ all: true, items: [dishPath("d1")] }, "d1"), "all");
  assert.equal(keepStateOf(settings, "d1"), "kept");
  assert.equal(keepStateOf(settings, "d2"), "not-kept");
});

const dishes = [
  { id: "d1", recipes: [{ ingredients: [{ ingredient: "salt" }, { ingredient: "beef" }] }, { ingredients: [{ ingredient: "beer" }, { ingredient: "" }, {}] }] },
  { id: "d2", recipes: [{ ingredients: [{ ingredient: "salt" }] }] },
  { id: "d3" },
];

test("a dish's ingredients are every recipe's lines, once each, blanks skipped", () => {
  assert.deepEqual(dishIngredientIds(dishes[0]), ["salt", "beef", "beer"]);
  assert.deepEqual(dishIngredientIds(dishes[2]), []);
  assert.deepEqual(dishIngredientIds(undefined), []);
});

test("keeping a dish keeps all its ingredients; letting go keeps the ones another kept dish uses", () => {
  assert.deepEqual(ingredientPlan(dishes, [], "d1", true), ["salt", "beef", "beer"].map(ingredientPath));
  const items = [dishPath("d1"), dishPath("d2")];
  assert.deepEqual(ingredientPlan(dishes, items, "d1", false), ["beef", "beer"].map(ingredientPath));
  assert.deepEqual(ingredientPlan(dishes, [dishPath("d1")], "d1", false), ["salt", "beef", "beer"].map(ingredientPath));
  assert.deepEqual(ingredientPlan(dishes, items, "gone", true), []);
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

test("the partial kitchen holds the kept dishes and ingredients, every other list and the settings empty", () => {
  const k = partialKitchen({ dishes: [{ id: "d1", recipes: [] }], ingredients: [{ id: "i1" }] });
  assert.equal(k.partial, true);
  assert.deepEqual(k.dishes, [{ id: "d1", recipes: [] }]);
  assert.deepEqual(k.ingredients, [{ id: "i1" }]);
  assert.deepEqual(k.settings, {});
  for (const list of ["recipes", "freezer", "shelf", "log", "resting", "dish_categories", "ingredient_categories"]) assert.deepEqual(k[list], [], list);
});

test("the route table: the kitchen has no item route below it, dishes and ingredients do", () => {
  assert.deepEqual([...OFFLINE_ROUTES], [KITCHEN_PATH, DISH_ROUTE, INGREDIENTS_PATH, INGREDIENT_ROUTE]);
  assert.equal(DISH_ROUTE, "/data/dishes/:id");
  assert.equal(INGREDIENT_ROUTE, `${INGREDIENTS_PATH}/:id`, "the kit pairs a list with the item route one /:param below");
  assert.ok(!OFFLINE_ROUTES.some((r) => r.startsWith(`${KITCHEN_PATH}/`)), "no item route below /data/kitchen: it is kept only by keep everything");
});

// fix-offline-master-2: after an online kitchen read the kept copies follow the server's answer.
const withLines = (id, ...ingredients) => ({ id, recipes: [{ id: `${id}-r`, ingredients: ingredients.map((ingredient) => ({ ingredient })) }] });

test("every kept dish the server still lists is read again; others and unkept dishes are not", () => {
  const items = [dishPath("a"), dishPath("gone"), ingredientPath("i1")];
  const plan = keptRefreshPlan([withLines("a", "i1"), withLines("b", "i2")], items);
  assert.deepEqual(plan.dishIds, ["a"]);
});

test("an ingredient a kept dish names since is kept; one none names is let go only when every kept dish is listed", () => {
  const items = [dishPath("a"), ingredientPath("old")];
  const plan = keptRefreshPlan([withLines("a", "new")], items);
  assert.deepEqual(plan.keep, [ingredientPath("new")]);
  assert.deepEqual(plan.release, [ingredientPath("old")]);
  const missing = keptRefreshPlan([withLines("a", "new")], [...items, dishPath("unchecked")]);
  assert.deepEqual(missing.release, [], "a kept dish missing from the answer may still use it: nothing is let go");
  assert.deepEqual(missing.keep, [ingredientPath("new")]);
});

test("nothing kept, nothing to refresh", () => {
  assert.deepEqual(keptRefreshPlan([withLines("a", "i1")], []), { dishIds: [], keep: [], release: [] });
});
