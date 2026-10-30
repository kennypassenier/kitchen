// node --test scripts/cook.test.mjs: the pure logic of cook mode (web/js/pages/cook/logic.js): which steps the cook sees, what
// the focus-steps component is given, where a finished timer leads, the real start/end of each step, the plan counted on from
// the real clock, the fixed start offsets with their planned waits, and the "n of m done" counts (Kenny, 24/10/2026 and 29/10/2026).
import test from "node:test";
import assert from "node:assert/strict";
import { MIN, stepsOf, focusStepsOf, nextAfter, markSteps, firstOf, plannedStart, planStep, planRuns, laneCounts, clockAt } from "../web/js/pages/cook/logic.js";

const step = (id, extra = {}) => ({ id, text: `Do ${id}`, say: "", mins: 5, active: false, track: null, ...extra });
const text = {
  how: (mins, active) => `${mins}${active ? "a" : "p"}`,
  done: (how) => `done ${how}`,
  onIt: (how) => `on ${how}`,
  todo: (how) => `todo ${how}`,
  todoAt: (how, at, waits) => `todo ${how} at ${at} wait ${waits}`,
};
const NOW = Date.UTC(2026, 9, 30, 12, 0, 0);

test("the mini version shows only the mini steps", () => {
  const r = { steps: [step("a", { mini: true }), step("b"), step("c", { mini: true })] };
  assert.deepEqual(stepsOf(r, true).map((s) => s.id), ["a", "c"]);
  assert.equal(stepsOf(r, false).length, 3);
});

test("focus steps carry the title, the track name, the timer and the warning tone", () => {
  const r = { tracks: [{ id: "p", name: "Pasta" }] };
  const [a, b] = focusStepsOf(r, [step("a", { say: "boil water", track: "p", timer: { seconds: 60, name: "Water" }, note: "careful", note_tone: "warning", uses: [{ amount: 2, name: "salt" }] }), step("b", { track: "gone" })]);
  assert.equal(a.title, "Boil water");
  assert.equal(a.track, "Pasta");
  assert.deepEqual(a.timer, { seconds: 60, name: "Water" });
  assert.equal(a.noteTone, "warning");
  assert.deepEqual(a.ingredients, [{ amount: 2, name: "salt" }]);
  assert.equal(b.title, undefined);
  assert.equal(b.track, "gone"); // an unknown track falls back to its id
  assert.equal(b.timer, undefined);
});

test("a finished timer leads to the next step on the same track, numbered inside that track", () => {
  const shown = [step("a", { track: "p" }), step("b", { track: "s" }), step("c", { track: "p" }), step("d", { track: "s" })];
  assert.deepEqual(nextAfter(shown, { id: "a" }), { index: 2, number: 2, text: "Do c" });
  assert.deepEqual(nextAfter(shown, { id: "b" }), { index: 3, number: 2, text: "Do d" });
  assert.equal(nextAfter(shown, { id: "c" }), null); // last of its track
  assert.equal(nextAfter(shown, { id: "zzz" }), null);
});

test("without tracks the next step is simply the next one", () => {
  const shown = [step("a"), step("b"), step("c")];
  assert.deepEqual(nextAfter(shown, { id: "a" }), { index: 1, number: 2, text: "Do b" });
  assert.equal(nextAfter(shown, { id: "c" }), null);
});

test("a step in hand gets a start, a passed one an end, and a step taken back loses its end", () => {
  const shown = [step("a"), step("b"), step("c")];
  const marks = { c: { start: 1, end: 2 } };
  markSteps(marks, shown, 1, new Set([0]), NOW);
  assert.deepEqual(marks.a, { start: undefined, end: NOW });
  assert.deepEqual(marks.b, { start: NOW });
  assert.equal(marks.c, undefined);
  markSteps(marks, shown, 1, new Set([0]), NOW + 5000); // a second look changes nothing that is set
  assert.equal(marks.a.end, NOW);
  assert.equal(marks.b.start, NOW);
});

test("cooking began at the earliest real start, never later than now", () => {
  assert.equal(firstOf({}, NOW), NOW);
  assert.equal(firstOf({ a: { start: NOW - 3 * MIN }, b: { start: NOW - MIN }, c: { end: NOW } }, NOW), NOW - 3 * MIN);
});

test("the clock is Brussels time", () => {
  assert.equal(clockAt(Date.UTC(2026, 9, 30, 12, 5)), "13:05"); // CET in late October
  assert.equal(clockAt(Date.UTC(2026, 6, 1, 12, 5)), "14:05"); // CEST in July
});

test("a step with no fixed start begins when its rows are free, but never before now", () => {
  assert.deepEqual(plannedStart({}, { now: NOW, ahead: NOW + 4 * MIN, first: NOW }), { start: NOW + 4 * MIN, waits: 0 });
  assert.deepEqual(plannedStart({}, { now: NOW, ahead: NOW - 4 * MIN, first: NOW }), { start: NOW, waits: 0 });
});

test("a step that runs alongside another is planned from that one", () => {
  assert.equal(plannedStart({}, { now: NOW, ahead: NOW + 9 * MIN, first: NOW, partner: NOW + 2 * MIN }).start, NOW + 2 * MIN);
  assert.equal(plannedStart({}, { now: NOW, ahead: 0, first: NOW, partner: NOW - MIN }).start, NOW);
});

test("a fixed start is counted from the moment cooking began and the gap is a planned wait", () => {
  const p = plannedStart({ start: 30 }, { now: NOW, ahead: NOW + 10 * MIN, first: NOW - 5 * MIN });
  assert.deepEqual(p, { start: NOW + 25 * MIN, waits: 15 });
  // a fixed start already in the past begins now and waits for nothing
  assert.deepEqual(plannedStart({ start: 2 }, { now: NOW, ahead: NOW - MIN, first: NOW - 10 * MIN }), { start: NOW, waits: 0 });
  // a gap of half a minute or less is not announced as a wait
  assert.equal(plannedStart({ start: 10.4 }, { now: NOW, ahead: NOW + 10 * MIN, first: NOW }).waits, 0);
  // invalid offsets are ignored
  assert.equal(plannedStart({ start: -3 }, { now: NOW, ahead: NOW + MIN, first: NOW }).start, NOW + MIN);
  assert.equal(plannedStart({ start: "10" }, { now: NOW, ahead: NOW + MIN, first: NOW }).start, NOW + MIN);
});

test("start 0 is a fixed start at the moment cooking began", () => {
  assert.equal(plannedStart({ start: 0 }, { now: NOW, ahead: NOW, first: NOW - MIN }).start, NOW);
});

test("a passed step is drawn where it really was, at least 30 s long and never in the future", () => {
  const { part, next } = planStep("done", { mins: 5, mark: { start: NOW - 8 * MIN, end: NOW - 2 * MIN }, now: NOW, ahead: 0, first: NOW, step: {}, how: "5p" }, text);
  assert.deepEqual([part.start, part.end, part.state, part.words, next], [NOW - 8 * MIN, NOW - 2 * MIN, "ok", "done 5p", NOW - 2 * MIN]);
  const quick = planStep("done", { mins: 5, mark: { start: NOW - 1000, end: NOW - 1000 }, now: NOW, ahead: 0, first: NOW, step: {}, how: "x" }, text);
  assert.equal(quick.part.end - quick.part.start, 30000);
});

test("a passed step with no marks is placed from its rows' free time", () => {
  const { part } = planStep("done", { mins: 5, now: NOW, ahead: NOW - 20 * MIN, first: NOW, step: {}, how: "x" }, text);
  assert.equal(part.start, NOW - 20 * MIN);
  assert.equal(part.end, NOW - 15 * MIN);
});

test("the step in hand grows to now and keeps its planned end; past its time the rest starts from now", () => {
  const early = planStep("active", { mins: 10, mark: { start: NOW - 4 * MIN }, now: NOW, ahead: 0, first: NOW, step: {}, how: "x" }, text);
  assert.deepEqual([early.part.start, early.part.end, early.part.plannedEnd, early.next, early.part.state], [NOW - 4 * MIN, NOW, NOW + 6 * MIN, NOW + 6 * MIN, "running"]);
  const late = planStep("active", { mins: 3, mark: { start: NOW - 9 * MIN }, now: NOW, ahead: 0, first: NOW, step: {}, how: "x" }, text);
  assert.equal(late.next, NOW);
});

test("a step still to do says when it waits", () => {
  const plain = planStep("todo", { mins: 5, now: NOW, ahead: NOW + MIN, first: NOW, step: {}, how: "5p" }, text);
  assert.equal(plain.part.words, "todo 5p");
  const waits = planStep("todo", { mins: 5, now: NOW, ahead: NOW, first: NOW, step: { start: 20 }, how: "5p" }, text);
  assert.equal(waits.part.words, `todo 5p at ${clockAt(NOW + 20 * MIN)} wait 20`);
  assert.equal(waits.next, NOW + 25 * MIN);
});

test("a partner step does not push its rows back", () => {
  const { next } = planStep("todo", { mins: 2, now: NOW, ahead: NOW + 10 * MIN, first: NOW, partner: NOW, step: {}, how: "x" }, text);
  assert.equal(next, NOW + 10 * MIN); // ahead wins over its own short end
});

const lanes = [{ id: "p", series: 1 }, { id: "s", series: 2 }];
const rowsByTrack = (s) => (s.track ? [s.track] : ["p", "s"]);

test("the plan runs one step after another on a row, from now", () => {
  const shown = [step("a", { track: "p" }), step("b", { track: "p" }), step("c", { track: "s" })];
  const { runs, last } = planRuns({ shown, lanes, rowsOf: rowsByTrack, marks: {}, active: 0, done: new Set(), now: NOW, first: NOW }, text);
  const by = (id) => runs.find((r) => r.id.endsWith(`:${id}`));
  assert.equal(by("a").state, "running");
  assert.equal(by("b").start, NOW + 5 * MIN);
  assert.equal(by("c").start, NOW); // the other row is free
  assert.equal(last, NOW + 10 * MIN);
});

test("a meeting step (no track) sits in every row and waits for the longest", () => {
  const shown = [step("a", { track: "p", mins: 10 }), step("b", { track: "s", mins: 4 }), step("m")];
  const { runs } = planRuns({ shown, lanes, rowsOf: rowsByTrack, marks: {}, active: 0, done: new Set(), now: NOW, first: NOW }, text);
  const m = runs.filter((r) => r.id.endsWith(":m"));
  assert.deepEqual(m.map((r) => r.lane).sort(), ["p", "s"]);
  assert.ok(m.every((r) => r.start === NOW + 10 * MIN));
});

test("steps passed early shift the rest of the plan forward", () => {
  const shown = [step("a", { mins: 10 }), step("b", { mins: 10 })];
  const one = [{ id: "all" }];
  const rowsOf = () => ["all"];
  const slow = planRuns({ shown, lanes: one, rowsOf, marks: { a: { start: NOW, end: NOW + 10 * MIN } }, active: 1, done: new Set([0]), now: NOW + 10 * MIN, first: NOW }, text);
  const quick = planRuns({ shown, lanes: one, rowsOf, marks: { a: { start: NOW, end: NOW + 3 * MIN } }, active: 1, done: new Set([0]), now: NOW + 3 * MIN, first: NOW }, text);
  assert.equal(slow.last - quick.last, 7 * MIN);
});

test("a partner step starts with the step it runs beside, with a detail line for the cook", () => {
  const shown = [step("a", { track: "p", mins: 10 }), step("b", { track: "s", mins: 4, with: "a" })];
  const { runs } = planRuns({ shown, lanes, rowsOf: rowsByTrack, marks: {}, active: -1, done: new Set(), now: NOW, first: NOW }, text);
  const a = runs.find((r) => r.id === "p:a");
  const b = runs.find((r) => r.id === "s:b");
  assert.equal(a.start, b.start);
  assert.equal(b.detail, "Do b, todo 4p");
  assert.equal(b.series, 2);
});

test("a step without a name is labelled by its text, capitalised", () => {
  const { runs } = planRuns({ shown: [step("a", { say: "stir", text: "x" }), step("b", { text: "plain text" })], lanes: [{ id: "all" }], rowsOf: () => ["all"], marks: {}, active: -1, done: new Set(), now: NOW, first: NOW }, text);
  assert.deepEqual(runs.map((r) => r.label), ["Stir", "Plain text"]);
});

test("a row counts its done steps and all its steps", () => {
  const shown = [step("a", { track: "p" }), step("b", { track: "p" }), step("c", { track: "s" }), step("m")];
  assert.deepEqual(laneCounts(shown, rowsByTrack, "p", new Set([0, 3])), [2, 3]);
  assert.deepEqual(laneCounts(shown, rowsByTrack, "s", new Set()), [0, 2]);
});
