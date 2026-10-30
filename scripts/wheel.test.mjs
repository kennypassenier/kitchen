// node --test scripts/wheel.test.mjs: the pure logic of the wheel page (web/js/pages/wheel/logic.js): which dishes fit the
// filters, the odds (slice sizes), what holds dishes back and which to let go first, resting dishes and the freezer's portions,
// the chips the data makes, when to start and the date text (Kenny, 24/10/2026 09:17-09:27).
import test from "node:test";
import assert from "node:assert/strict";
import * as L from "../web/js/pages/wheel/logic.js";

const dish = (id, extra = {}) => ({ id, label: id, short: id, meals: ["dinner"], minutes: 30, ing: [], days: 5, safe: false, freezer: 0, prep: "full", recipe: true, cookId: id, others: [], category: null, sides: [], ...extra });
const words = {
  meal: (v) => `M:${v}`, time: (v) => `T:${v}`, cat: (v) => `C:${v}`, dish: (id) => `D:${id}`, kind: (k) => `K:${k}`,
  with: (n) => `with ${n}`, without: (n) => `without ${n}`, not: (n) => `not ${n}`, resting: (n) => `resting ${n}`,
  notCounting: (n) => `no ${n.toLowerCase()}`, noEnergy: "no energy",
};
const labels = (m) => L.constraintsOf(m, words).map((c) => c.label);

test("time bands: up to 20 quick, up to 45 mid, longer long", () => {
  assert.deepEqual([0, 20, 21, 45, 46].map(L.band), ["quick", "quick", "mid", "mid", "long"]);
});

test("a dish with no recipe (0 minutes, no meals) is left out only by a filter that asks for those", () => {
  const bare = dish("b", { meals: [], minutes: 0, ing: [], recipe: false });
  const m = L.newModel();
  assert.equal(L.fits(bare, m), true);
  m.meal.include = ["dinner"];
  assert.equal(L.fits(bare, m), false);
  const m2 = L.newModel();
  m2.time.exclude = ["long"];
  assert.equal(L.fits(bare, m2), true); // 0 minutes is quick
});

test("meal and time filters include (any) and exclude", () => {
  const m = L.newModel();
  m.meal.include = ["lunch", "dinner"];
  assert.equal(L.fits(dish("a", { meals: ["dinner"] }), m), true);
  assert.equal(L.fits(dish("a", { meals: ["breakfast"] }), m), false);
  m.meal.exclude = ["dinner"];
  assert.equal(L.fits(dish("a", { meals: ["lunch", "dinner"] }), m), false);
  const t = L.newModel();
  t.time.include = ["quick"];
  assert.equal(L.fits(dish("q", { minutes: 15 }), t), true);
  assert.equal(L.fits(dish("l", { minutes: 50 }), t), false);
});

test("ingredients must all be present when included, none when excluded", () => {
  const m = L.newModel();
  m.ing.include = ["egg", "cheese"];
  assert.equal(L.fits(dish("a", { ing: ["egg", "cheese", "ham"] }), m), true);
  assert.equal(L.fits(dish("a", { ing: ["egg"] }), m), false);
  m.ing = { include: [], exclude: ["ham"] };
  assert.equal(L.fits(dish("a", { ing: ["ham"] }), m), false);
});

test("category filters match the dish's category", () => {
  const m = L.newModel();
  m.cat.include = ["c1"];
  assert.equal(L.fits(dish("a", { category: "c1" }), m), true);
  assert.equal(L.fits(dish("a", { category: null }), m), false);
  m.cat = { include: [], exclude: ["c1"] };
  assert.equal(L.fits(dish("a", { category: "c1" }), m), false);
});

test("a resting dish is out unless resting is skipped; no-energy keeps only the kinds that count", () => {
  const m = L.newModel();
  m.resting = new Set(["r"]);
  assert.equal(L.fits(dish("r"), m), false);
  assert.equal(L.fits(dish("r"), m, { resting: true }), true);
  const e = L.newModel();
  e.easy = true;
  assert.equal(L.fits(dish("plain"), e), false);
  assert.equal(L.fits(dish("s", { safe: true }), e), true);
  assert.equal(L.fits(dish("f", { freezer: 2 }), e), true);
  assert.equal(L.fits(dish("n", { prep: "none" }), e), true);
  e.kinds.delete("safe");
  assert.equal(L.fits(dish("s", { safe: true }), e), false);
  assert.equal(L.fits(dish("plain"), e, { easy: true }), true);
});

test("equal odds give every dish the same slice", () => {
  assert.equal(L.weightOf(dish("a", { days: 100 }), "equal"), 1);
});

test("recency odds grow with the days since cooked, between 0.6 and 5; never cooked is the biggest", () => {
  assert.equal(L.weightOf(dish("a", { days: 0 }), "recency"), 0.6);
  assert.equal(L.weightOf(dish("a", { days: 8 }), "recency"), 1.6);
  assert.equal(L.weightOf(dish("a", { days: 80 }), "recency"), 5);
  assert.equal(L.weightOf(dish("a", { days: Infinity }), "recency"), 5);
});

test("freezer odds triple the slice of a dish with portions", () => {
  assert.equal(L.weightOf(dish("a", { days: 8, freezer: 1 }), "freezer"), 4.8);
  assert.equal(L.weightOf(dish("a", { days: 8, freezer: 0 }), "freezer"), 1.6);
});

test("a bigger slice is only for long-not-eaten dishes and never with equal odds", () => {
  assert.equal(L.isBigger(dish("a", { days: 21 }), "recency"), true);
  assert.equal(L.isBigger(dish("a", { days: 20 }), "recency"), false);
  assert.equal(L.isBigger(dish("a", { days: 90 }), "equal"), false);
  assert.equal(L.isBigger(dish("a", { days: Infinity }), "freezer"), true);
});

test("resting items count until the day after their last day", () => {
  const now = new Date(2026, 9, 30, 12);
  const m = L.restingByDish([{ dish_id: "a", until: "2026-10-30" }, { dish_id: "b", until: "2026-10-29" }, { dish_id: null, until: "2026-12-01" }, { dish_id: "c", until: "2026-11-02" }], now);
  assert.deepEqual([...m.keys()], ["a", "c"]);
});

test("a dish set aside rests for a week", () => {
  assert.equal(L.restUntil(new Date(2026, 9, 28, 12)).getDate(), 4);
  assert.equal(L.restUntil(new Date(2026, 9, 28, 12)).getMonth(), 10);
});

test("the freezer counts by id or by a name in either language, ignoring case and spaces", () => {
  const d = { id: "d1", name: { nl: "Soep", en: "Soup" } };
  const freezer = [{ dish_id: "d1", portions: 2 }, { dish_id: null, dish: { nl: " soep ", en: "" }, portions: 1 }, { dish_id: null, dish: "SOUP", portions: 4 }, { dish_id: "other", dish: { nl: "Stoofvlees", en: "Stew" }, portions: 9 }];
  assert.equal(L.freezerPortions(d, freezer), 7);
  assert.equal(L.freezerPortions({ id: "x", name: {} }, [{ dish_id: null, dish: { nl: "", en: "" }, portions: 3 }]), 0);
});

test("a dish takes its figures from the default recipe, and has none without one", () => {
  const stored = { id: "d", name: { nl: "A", en: "A" }, recipes: [{ id: "r1" }, { id: "r2" }, { id: "r3" }], category: "c", sides: [1] };
  const extra = { label: "A", days: 4, freezer: [], recipeLabelOf: (r, i) => `${r.id}#${i}` };
  const full = L.dishFrom(stored, { id: "r2", meals: ["lunch"], minutes: "25", ing: ["egg"], safe: 1, prep: "none" }, extra);
  assert.deepEqual([full.meals, full.minutes, full.ing, full.safe, full.prep, full.recipe, full.cookId], [["lunch"], 25, ["egg"], true, "none", true, "r2"]);
  assert.deepEqual(full.others, [{ id: "r1", label: "r1#0" }, { id: "r3", label: "r3#2" }]);
  const bare = L.dishFrom({ id: "d", name: {} }, undefined, extra);
  assert.deepEqual([bare.meals, bare.minutes, bare.ing, bare.prep, bare.recipe, bare.cookId, bare.category, bare.sides], [[], 0, [], "full", false, null, null, []]);
});

test("what holds dishes back is named in the order meal, time, ingredient, category, resting, easy kinds", () => {
  const m = L.newModel();
  m.meal.include = ["lunch"]; m.time.exclude = ["long"]; m.ing = { include: ["egg"], exclude: ["ham"] }; m.cat.include = ["c1"]; m.resting = new Set(["r"]);
  assert.deepEqual(labels(m), ["M:lunch", "not T:long", "with egg", "without ham", "C:c1", "resting D:r"]);
  m.easy = true; m.kinds.delete("freezer");
  assert.equal(labels(m).at(-1), "no k:freezer");
});

test("the easy switch alone is the only thing holding back when nothing else does", () => {
  const m = L.newModel();
  assert.deepEqual(labels(m), []);
  m.easy = true;
  assert.deepEqual(labels(m), ["no energy"]);
  L.constraintsOf(m, words)[0].release();
  assert.equal(m.easy, false);
});

test("releasing a constraint takes it off the model it was made on", () => {
  const m = L.newModel();
  m.meal.include = ["lunch", "dinner"];
  L.constraintsOf(m, words).find((c) => c.key === "meal:lunch").release();
  assert.deepEqual(m.meal.include, ["dinner"]);
});

test("the constraint to let go first is the one that frees the most dishes, the later on a tie", () => {
  const dishes = [dish("a", { meals: ["lunch"] }), dish("b", { meals: ["lunch"] }), dish("c", { meals: ["dinner"], ing: ["egg"] })];
  const m = L.newModel();
  m.meal.include = ["breakfast"]; // frees all three
  m.ing.include = ["egg"]; // letting go the ingredient alone frees nothing
  assert.equal(L.pickToLoosen(m, words, dishes).key, "meal:breakfast");
  assert.equal(L.pickToLoosen(L.newModel(), words, dishes), null);
  const tie = L.newModel();
  tie.meal.include = ["breakfast"]; tie.time.include = ["quick"]; // letting go either one still leaves nothing
  assert.equal(L.pickToLoosen(tie, words, dishes).key, "time:quick");
});

test("loosening works on a copy, the model keeps its constraints", () => {
  const m = L.newModel();
  m.meal.include = ["breakfast"];
  L.pickToLoosen(m, words, [dish("a")]);
  assert.deepEqual(m.meal.include, ["breakfast"]);
  const c = L.copyOf(m);
  c.meal.include.push("lunch"); c.kinds.delete("safe");
  assert.deepEqual(m.meal.include, ["breakfast"]);
  assert.equal(m.kinds.has("safe"), true);
});

test("constraint order: a new one goes last, a released one leaves", () => {
  let order = L.tracked([], "meal:a", true);
  order = L.tracked(order, "time:b", true);
  order = L.tracked(order, "meal:a", true);
  assert.deepEqual(order, ["time:b", "meal:a"]);
  assert.deepEqual(L.tracked(order, "time:b", false), ["meal:a"]);
});

test("a chip group that changed updates the order: added values last, values gone from both states out", () => {
  const prev = { include: ["a"], exclude: ["b"] };
  const now = { include: ["a", "c"], exclude: [] };
  assert.deepEqual(L.orderAfterChips(["meal:a", "meal:b", "time:x"], "meal", prev, now), ["meal:a", "time:x", "meal:c"]);
  // a value that moved from include to exclude stays tracked where it was, it only goes last again
  assert.deepEqual(L.orderAfterChips(["meal:a", "meal:z"], "meal", { include: ["a"], exclude: [] }, { include: [], exclude: ["a"] }), ["meal:z", "meal:a"]);
});

test("a chip whose value is gone drops its constraints from the order", () => {
  assert.deepEqual(L.dropGone(["ing:egg", "ing:ham", "meal:egg", "ing:fish"], "ing", ["egg", "fish"]), ["ing:egg", "meal:egg", "ing:fish"]);
});

test("filter keys are the chips only", () => {
  assert.deepEqual(["meal:a", "time:b", "ing:c", "cat:d", "rest:e", "kind:f", "easy"].map(L.isFilterKey), [true, true, true, true, false, false, false]);
});

test("ingredient chips: most used first, ties by name; the first six before any dish", () => {
  const dishes = [dish("1", { ing: ["egg", "ham"] }), dish("2", { ing: ["ham", "cheese"] }), dish("3", { ing: ["ham", "egg"] })];
  assert.deepEqual(L.ingredientChips(dishes), ["ham", "egg", "cheese"]);
  assert.deepEqual(L.ingredientChips([]), L.FIRST_INGREDIENTS);
  assert.deepEqual(L.ingredientChips([dish("x")]), L.FIRST_INGREDIENTS); // no ingredients on any dish
});

test("category chips follow the categories' order and only the ones in use", () => {
  const cats = [{ id: "b", order: 2 }, { id: "a", order: 1 }, { id: "z" }, { id: "unused", order: 0 }];
  assert.deepEqual(L.categoryChips(cats, [dish("1", { category: "z" }), dish("2", { category: "a" }), dish("3", { category: "b" })]), ["a", "b", "z"]);
});

test("the counts on the chips", () => {
  const dishes = [dish("1", { meals: ["lunch"], minutes: 10, ing: ["egg"], category: "c" }), dish("2", { meals: ["lunch", "dinner"], minutes: 50, ing: ["egg", "ham"] })];
  assert.deepEqual(L.countOf(dishes, "meal", ["lunch", "dinner", "breakfast"]), { lunch: 2, dinner: 1, breakfast: 0 });
  assert.deepEqual(L.countOf(dishes, "time", ["quick", "mid", "long"]), { quick: 1, mid: 0, long: 1 });
  assert.deepEqual(L.countOf(dishes, "ing", ["egg", "ham"]), { egg: 2, ham: 1 });
  assert.deepEqual(L.countOf(dishes, "cat", ["c"]), { c: 1 });
});

test("the dinner time is read as HH:MM and falls back to 18:30", () => {
  assert.equal(L.dinnerTimeOf("7:05"), "07:05");
  assert.equal(L.dinnerTimeOf("19:00"), "19:00");
  for (const bad of [undefined, null, "", "noon", "18h30", "18:3"]) assert.equal(L.dinnerTimeOf(bad), "18:30");
});

test("start times count back from dinner; too late says when it would be ready", () => {
  assert.deepEqual(L.startPlan("18:30", 40, 17 * 60), { ok: true, start: "17:50" });
  assert.deepEqual(L.startPlan("18:30", 40, 17 * 60 + 50), { ok: true, start: "17:50" }); // right on time
  assert.deepEqual(L.startPlan("18:30", 40, 17 * 60 + 51), { ok: false, ready: "18:31" });
  assert.deepEqual(L.startPlan("00:10", 30, 23 * 60 + 50), { ok: false, ready: "00:20" }); // past midnight wraps
});

test("the last-cooked line starts with never, today, yesterday or the date", () => {
  assert.deepEqual([Infinity, 0, 1, 2, 30].map(L.lastCookedKind), ["never", "today", "yesterday", "ago", "ago"]);
  assert.equal(L.lastCookedDate(10, new Date(2026, 9, 30, 12)), "20/10/2026");
  assert.equal(L.lastCookedDate(40, new Date(2026, 9, 30, 12)), "20/09/2026");
});
