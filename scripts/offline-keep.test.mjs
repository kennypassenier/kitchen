// node --test scripts/offline-keep.test.mjs: "keep everything offline" is on by default (Kenny, 02/11/2026), applied
// once per device, and a person who turned it off keeps it off (web/js/offline/keep.js); the copy is read again only
// after a replay that sent something (web/js/offline/sync.js).
import test from "node:test";
import assert from "node:assert/strict";
import { applyKeepDefault, DEFAULT_MARK, KEEP_ALL_DEFAULT, markDefault, needsDefault } from "../web/js/offline/keep.js";
import { needsReread } from "../web/js/offline/sync.js";

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};
const fakeKit = () => {
  const calls = [];
  return { calls, keepAll: async (on) => (calls.push(on), on) };
};

test("the default is on and applied on a new device", async () => {
  assert.equal(KEEP_ALL_DEFAULT, true);
  const storage = memory();
  const kit = fakeKit();
  await applyKeepDefault(kit, storage);
  assert.deepEqual(kit.calls, [true]);
  assert.equal(storage.m.get(DEFAULT_MARK), "1");
});

test("once applied, the person's own choice stands", async () => {
  const storage = memory();
  markDefault(storage);
  const kit = fakeKit();
  await applyKeepDefault(kit, storage);
  assert.deepEqual(kit.calls, [], "keepAll is not touched again, so an OFF stays off");
});

test("a storage that cannot be read or written applies the default again, and says so", async () => {
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  const warned = [];
  const warn = console.warn;
  console.warn = (...a) => warned.push(a);
  try {
    assert.equal(needsDefault(broken), true);
    assert.equal(markDefault(broken), false);
    assert.equal(needsDefault(null), true);
    assert.equal(markDefault(null), false);
  } finally {
    console.warn = warn;
  }
  assert.equal(warned.length, 2, "both failures are reported, none swallowed");
});

test("the copy is read again only after a replay that sent something", () => {
  assert.equal(needsReread({ sent: 2, remaining: 0, stopped: null }), true);
  assert.equal(needsReread({ sent: 0, remaining: 1, stopped: "unreachable" }), false);
  for (const odd of [null, undefined, {}, { sent: "2" }]) assert.equal(needsReread(odd), false);
});
