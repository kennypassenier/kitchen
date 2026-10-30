// node --test scripts/sequence.test.mjs: the glue between the recipe editor's steps and the kit's sequencer
// (web/js/recipe/sequence.js, Kenny, 30/10/2026). Steps -> items, an edit's items -> steps, and the same chain the editor runs
// on a drop (editor/timeline.js applyDrop): fromItems, then meet.js `settle`, then schedule.js `layout` for the total.
// schedule.js and meet.js have their own tests; this checks only how the glue uses them.
import test from "node:test";
import assert from "node:assert/strict";
import { toItems, fromItems, MEET } from "../web/js/recipe/sequence.js";
import { layout } from "../web/js/recipe/schedule.js";
import { settle } from "../web/js/recipe/meet.js";

const tracks = [{ id: "p", name: "Pasta" }, { id: "s", name: "Sauce" }];
const step = (id, track, mins, extra = {}) => ({ id, track, mins, active: false, text: `step ${id}`, with: null, ...extra });
const words = { meet: "Meet", all: "All", unnamed: "Track", label: (s, n) => `${n}. ${s.text}` };
const itemOf = (out, id) => out.items.find((i) => i.id === id);
/** What the sequencer's change event carries for `items`: the items as they stand and `total`, the latest end (kit sequencerTotalOf). */
const detailOf = (items) => ({ items, total: Math.max(0, ...items.map((i) => i.start + i.duration)) });
/** The editor's drop chain on `steps`: the new steps and the schedule's total. */
const drop = (steps, detail) => {
  const after = settle(fromItems(steps, tracks, detail.items), tracks);
  return { after, total: layout(after, tracks).total };
};

test("toItems: lanes are the named tracks plus the meeting lane, steps map to lane, duration, with", () => {
  const steps = [step("a", "p", 10), step("b", "s", 20), step("m", null, 3), step("w", "s", 4, { with: "a" })];
  const out = toItems(steps, tracks, words);
  assert.deepEqual(out.lanes, [{ id: "p", label: "Pasta" }, { id: "s", label: "Sauce" }, { id: MEET, label: "Meet" }]);
  assert.deepEqual([itemOf(out, "a").lane, itemOf(out, "m").lane, itemOf(out, "b").duration], ["p", MEET, 20]);
  assert.equal(itemOf(out, "w").with, "a");
  assert.equal(itemOf(out, "a").with, null);
  assert.equal(itemOf(out, "a").label, "1. step a");
});

test("toItems: no tracks is one lane for all, a step on a track that is gone falls into it", () => {
  const out = toItems([step("a", null, 5), step("b", "gone", 5)], [], words);
  assert.deepEqual(out.lanes, [{ id: MEET, label: "All" }]);
  assert.deepEqual(out.items.map((i) => i.lane), [MEET, MEET]);
  assert.deepEqual(out.items.map((i) => i.start), [0, 5]);
});

test("toItems: starts are where the schedule puts them, a pin included, and each lane has its own series", () => {
  const out = toItems([step("a", "p", 10), step("b", "s", 5, { start: 7 }), step("c", "p", 5)], tracks, words);
  assert.deepEqual(out.items.map((i) => i.start), [0, 7, 10]);
  assert.deepEqual(out.items.map((i) => i.series), [1, 2, 1]);
});

test("fromItems: an untouched round trip keeps `start` empty and the list as it was", () => {
  const steps = [step("a", "p", 10), step("b", "s", 20), step("c", "p", 5), step("m", null, 3)];
  const back = fromItems(steps, tracks, toItems(steps, tracks, words).items);
  assert.deepEqual(back, steps);
  assert.ok(back.every((s) => s.start === undefined));
});

test("fromItems: lane -> track (meeting lane -> null), duration -> mins, with -> with", () => {
  const steps = [step("a", "p", 10), step("b", "s", 20)];
  const items = toItems(steps, tracks, words).items.map((i) => (i.id === "a" ? { ...i, lane: MEET, duration: 12 } : { ...i, with: "a" }));
  const back = fromItems(steps, tracks, items);
  assert.deepEqual([back[0].track, back[0].mins, back[1].with], [null, 12, "a"]);
});

test("fromItems: a step dropped away from its flow gets the start, one dropped where it flows does not", () => {
  const steps = [step("a", "p", 10), step("c", "p", 5)];
  const items = toItems(steps, tracks, words).items.map((i) => (i.id === "c" ? { ...i, start: 25 } : i));
  const back = fromItems(steps, tracks, items);
  assert.equal(back[1].start, 25);
  assert.equal(back[0].start, undefined);
  assert.equal(layout(back, tracks).steps[1].start, 25);
});

test("fromItems: within a track the list follows the starts, other tracks keep their slots", () => {
  const steps = [step("a", "p", 5), step("x", "s", 5), step("b", "p", 5)];
  const items = toItems(steps, tracks, words).items.map((i) => (i.id === "a" ? { ...i, start: 20 } : i));
  const back = fromItems(steps, tracks, items);
  assert.deepEqual(back.map((s) => s.id), ["b", "x", "a"]);
  assert.equal(layout(back, tracks).steps.find((p) => p.id === "a").start, 20);
});

test("fromItems: a step with no text (not among the items) keeps its place and fields", () => {
  const blank = { id: "z", track: "p", mins: 9, text: "" };
  const steps = [step("a", "p", 10), blank, step("c", "p", 5)];
  const items = toItems([steps[0], steps[2]], tracks, words).items;
  const back = fromItems(steps, tracks, items);
  assert.equal(back[1], blank);
});

test("drop chain: the total the editor shows is the schedule's, and equals the event's total when nothing meets", () => {
  const steps = [step("a", "p", 10), step("b", "s", 20), step("c", "p", 5)];
  const detail = detailOf(toItems(steps, tracks, words).items.map((i) => (i.id === "c" ? { ...i, start: 30 } : i)));
  const { total } = drop(steps, detail);
  assert.equal(detail.total, 35);
  assert.equal(total, detail.total);
});

test("drop chain: the meeting lane follows a step that got longer, so the total is past the event's total", () => {
  const steps = [step("a", "p", 10), step("b", "s", 20), step("m", null, 3, { start: 20 })];
  const detail = detailOf(toItems(steps, tracks, words).items.map((i) => (i.id === "b" ? { ...i, duration: 25 } : i)));
  assert.equal(detail.total, 25); // the sequencer: the meeting step still ends at 23
  const { after, total } = drop(steps, detail);
  assert.equal(layout(after, tracks).steps.find((p) => p.id === "m").start, 25);
  assert.equal(total, 28);
});

test("drop chain: dragging the meeting step earlier than its predecessors is not honoured by the schedule", () => {
  const steps = [step("a", "p", 10), step("b", "s", 20), step("m", null, 3)];
  const detail = detailOf(toItems(steps, tracks, words).items.map((i) => (i.id === "m" ? { ...i, start: 2 } : i)));
  const { after } = drop(steps, detail);
  assert.ok(layout(after, tracks).steps.find((p) => p.id === "m").start >= 20);
});
