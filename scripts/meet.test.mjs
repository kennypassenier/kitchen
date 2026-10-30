// node --test scripts/meet.test.mjs: the meeting lane follows the steps before it (web/js/recipe/meet.js, Kenny, 30/10/2026).
import test from "node:test";
import assert from "node:assert/strict";
import { layout } from "../web/js/recipe/schedule.js";
import { settle } from "../web/js/recipe/meet.js";

const tracks = [{ id: "p", name: "Pasta" }, { id: "s", name: "Sauce" }];
const step = (id, track, mins, extra = {}) => ({ id, track, mins, active: false, ...extra });
const startOf = (steps, id) => layout(steps, tracks).steps.find((p) => p.id === id).start;

test("a step before it getting 5 min longer moves the meeting step 5 min", () => {
  // The meeting step was dropped at 20 (the end of the sauce); the sauce is then made 5 min longer.
  const before = [step("a", "p", 10), step("b", "s", 20), step("m", null, 3, { start: 20 })];
  const longer = before.map((s) => (s.id === "b" ? { ...s, mins: 25 } : s));
  assert.equal(startOf(settle(longer, tracks), "m"), 25);
  assert.equal(layout(settle(longer, tracks), tracks).total, 28);
});

test("a meeting step pinned later than the flow keeps its later start", () => {
  const steps = [step("a", "p", 10), step("b", "s", 20), step("m", null, 3, { start: 30 })];
  const out = settle(steps, tracks);
  assert.equal(out, steps);
  assert.equal(startOf(out, "m"), 30);
});

test("shrinking a step before it does not pull a pinned meeting step back, a flowing one follows", () => {
  const pinned = [step("a", "p", 10), step("b", "s", 12), step("m", null, 3, { start: 20 })];
  assert.equal(startOf(settle(pinned, tracks), "m"), 20);
  const flowing = [step("a", "p", 10), step("b", "s", 12), step("m", null, 3)];
  assert.equal(startOf(settle(flowing, tracks), "m"), 12);
});

test("steps after a moved meeting step follow it, and a recipe without tracks is left alone", () => {
  const steps = [step("a", "p", 25), step("m", null, 3, { start: 10 }), step("z", null, 2)];
  const out = settle(steps, tracks);
  assert.equal(startOf(out, "m"), 25);
  assert.equal(startOf(out, "z"), 28);
  const plain = [step("a", null, 5), step("b", null, 5, { start: 2 })];
  assert.equal(settle(plain, []), plain);
});
