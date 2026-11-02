// node --test scripts/cook-stage.test.mjs: what the full-viewport cook stage shows per state (web/js/pages/cook/stage-state.js,
// Kenny 01/11/2026 "Volledig scherm").
import test from "node:test";
import assert from "node:assert/strict";
import { stageParts, sheetTarget, miseState } from "../web/js/pages/cook/stage-state.js";

test("before Begin: the step, the gather button, no timers bar, no dinner card", () => {
  assert.deepEqual(stageParts({ started: false, finished: false, timers: [] }), { steps: true, timers: false, gather: true, done: false, running: 0 });
});

test("a running, paused or rung timer pins the bar; the step stays", () => {
  for (const state of ["running", "paused", "done"]) {
    const p = stageParts({ started: true, finished: false, timers: [{ state }] });
    assert.equal(p.timers, true, state);
    assert.equal(p.steps, true);
    assert.equal(p.running, 1);
  }
});

test("a stopped or unknown timer does not pin the bar", () => {
  const p = stageParts({ started: true, finished: false, timers: [{ state: "stopped" }, {}, /** @type {any} */ (null)] });
  assert.equal(p.timers, false);
  assert.equal(p.running, 0);
});

test("after Begin the gather button leaves", () => {
  assert.equal(stageParts({ started: true, finished: false, timers: [] }).gather, false);
});

test("the last step done: the dinner card shows, gather never does", () => {
  const p = stageParts({ started: false, finished: true, timers: [{ state: "running" }, { state: "done" }] });
  assert.equal(p.done, true);
  assert.equal(p.gather, false);
  assert.equal(p.running, 2);
});

test("the sheet opens on a known section, else at its top", () => {
  const ids = ["ck-begin", "ck-timeline", "ck-calm"];
  assert.equal(sheetTarget("ck-timeline", ids), "ck-timeline");
  assert.equal(sheetTarget("nope", ids), "ck-begin");
  assert.equal(sheetTarget(null, ids), "ck-begin");
  assert.equal(sheetTarget(null, []), null);
});

test("Start cooking: on once every item is out, and at once when there is nothing to take out", () => {
  assert.deepEqual(miseState([]), { ready: true, left: 0, total: 0 });
  assert.deepEqual(miseState([{ checked: true }, { checked: false }]), { ready: false, left: 1, total: 2 });
  assert.deepEqual(miseState([{ checked: true }, { checked: true }]), { ready: true, left: 0, total: 2 });
});
