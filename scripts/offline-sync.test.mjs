// node --test scripts/offline-sync.test.mjs: after the kit replayed queued edits the kitchen is read again whenever the
// server answered anything, so an optimistic value (a queued freezer take's count) never outlives the server's answer
// (fix-offline-master-1, Kenny 02/11/2026 19:43 "de server is altijd de master"). web/js/offline/sync.js.
// Written on 02/11/2026, not run (Kenny's test rule): a release check in docs/OPEN.md.
import test from "node:test";
import assert from "node:assert/strict";
import { REFUSED_EVENT, SYNCED_EVENT, needsReread, refreshNeeded, wireSync } from "../web/js/offline/sync.js";

test("a replay that sent something needs a read", () => {
  assert.equal(needsReread({ sent: 1, remaining: 0, stopped: null }), true);
});

test("a replay that only refused something needs a read too", () => {
  assert.equal(needsReread({ sent: 0, remaining: 0, stopped: null }, true), true);
});

test("a replay that neither sent nor refused anything needs none", () => {
  assert.equal(needsReread({ sent: 0, remaining: 2, stopped: "unreachable" }), false);
  assert.equal(needsReread(null), false);
  assert.equal(needsReread(undefined, false), false);
});

test("a refused take (conflict, then a summary with nothing sent) reads the kitchen again, once", async () => {
  let reads = 0;
  const stop = wireSync(async () => {
    reads += 1;
  });
  try {
    dispatchEvent(new CustomEvent(REFUSED_EVENT, { detail: { entry: { method: "POST", path: "/data/freezer/a/take" } } }));
    dispatchEvent(new CustomEvent(SYNCED_EVENT, { detail: { sent: 0, remaining: 0, stopped: null } }));
    assert.equal(reads, 1);
    // The refusal is forgotten after its summary: the next empty replay reads nothing.
    dispatchEvent(new CustomEvent(SYNCED_EVENT, { detail: { sent: 0, remaining: 0, stopped: "unreachable" } }));
    assert.equal(reads, 1);
  } finally {
    stop();
  }
});

// fix-offline-master-3: a kitchen held from the device's copy is read again on a page change and when back online.
test("a kitchen read from the device's copy is read again; one from the kitchen is not", () => {
  assert.equal(refreshNeeded(true, false), true);
  assert.equal(refreshNeeded(false, false), false);
});

test("no second read while one is on its way", () => {
  assert.equal(refreshNeeded(true, true), false);
});
