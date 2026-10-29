// node --test scripts/schedule.test.mjs: the schedule of web/js/recipe/schedule.js (Kenny, 29/10/2026).
import test from "node:test";
import assert from "node:assert/strict";
import { layout, effective, paced, lanesOf } from "../web/js/recipe/schedule.js";

const tracks = [{ id: "p", name: "Pasta" }, { id: "s", name: "Sauce" }];
const step = (id, track, mins, extra = {}) => ({ id, track, mins, active: false, ...extra });
const at = (sch, id) => sch.steps.find((p) => p.id === id);

test("one track is a sequence", () => {
  const s = layout([step("a", null, 5), step("b", null, 10)], []);
  assert.deepEqual([at(s, "a").start, at(s, "a").end, at(s, "b").start, at(s, "b").end, s.total], [0, 5, 5, 15, 15]);
  assert.equal(s.lanes.length, 1);
});

test("tracks run side by side, a meeting step waits for all of them", () => {
  const s = layout([step("a", "p", 10), step("b", "s", 20), step("c", "p", 5), step("m", null, 3)], tracks);
  assert.equal(at(s, "c").start, 10);
  assert.equal(at(s, "m").start, 20); // after the longest track so far
  assert.equal(s.total, 23);
  assert.deepEqual(at(s, "m").rows, ["p", "s"]);
});

test("start places a step by hand and the next one follows it", () => {
  const s = layout([step("a", null, 5), step("b", null, 5, { start: 20 }), step("c", null, 5)], []);
  assert.deepEqual([at(s, "b").start, at(s, "c").start, s.total], [20, 25, 30]);
});

test("with starts together with that step and does not push its track", () => {
  const s = layout([step("a", "p", 10), step("b", "s", 4, { with: "a" }), step("c", "s", 2), step("d", "p", 1)], tracks);
  assert.equal(at(s, "b").start, 0);
  assert.equal(at(s, "c").start, 4);
  assert.equal(at(s, "d").start, 10);
  const same = layout([step("a", "p", 10), step("b", "p", 4, { with: "a" }), step("c", "p", 2)], tracks);
  assert.equal(at(same, "c").start, 10); // the alongside step did not move the track's next step back
});

test("a with that points at nothing is a plain step", () => {
  const s = layout([step("a", null, 5), step("b", null, 5, { with: "zzz" })], []);
  assert.equal(at(s, "b").start, 5);
});

test("hands-on is the union of the active intervals", () => {
  const s = layout([step("a", "p", 10, { active: true }), step("b", "s", 6, { active: true, with: "a" }), step("c", "s", 5), step("d", "s", 4, { active: true })], tracks);
  assert.equal(s.handsOn, 14); // a 0-10 with b 0-6 counts once; c 6-11 is walk-away; d 11-15
  assert.equal(s.total, 15);
});

test("stretch makes hands-on steps longer on a slow day", () => {
  const s = layout([step("a", null, 10, { active: true }), step("b", null, 10)], [], { stretch: paced(1.25) });
  assert.equal(s.total, 23); // ceil(12.5) + 10
});

test("counting back starts each track just in time", () => {
  const s = layout([step("a", "p", 10), step("b", "s", 25), step("m", null, 5)], tracks, { align: "end" });
  assert.equal(s.total, 30);
  assert.equal(at(s, "a").start, 15); // the pasta waits: 15 to 25
  assert.equal(at(s, "a").end, 25);
  assert.equal(at(s, "b").start, 0);
  assert.equal(at(s, "m").start, 25);
});

test("effective: computed, override and kept figures", () => {
  const r = { steps: [step("a", null, 10, { active: true }), step("b", null, 20)], tracks: [], minutes: 99, hands_on: 99 };
  assert.deepEqual([effective(r).minutes, effective(r).hands_on, effective(r).minutes_override], [30, 10, null]);
  assert.equal(effective({ ...r, minutes_override: 45 }).minutes, 45);
  assert.equal(effective({ steps: [], minutes: 25, hands_on: 5 }).minutes, 25); // no step minutes: the stored figures stay
  assert.equal(effective(r, { steps: [], hands_on_override: 7 }).hands_on, 7);
});

test("lanesOf ignores tracks that have no step and treats an unknown track as a meeting", () => {
  const { lanes, rowsOf } = lanesOf([step("a", "p", 1), step("b", "gone", 1)], tracks);
  assert.deepEqual(lanes.map((l) => l.id), ["p"]);
  assert.deepEqual(rowsOf(step("b", "gone", 1)), ["p"]);
});
