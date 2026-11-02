// node --test scripts/cook-memo.test.mjs: what cook mode keeps per recipe in sessionStorage (web/js/pages/cook/memo.js), here the
// finished state [fix-cook-finished-1]: a reload after the last step comes back on the finished stage with the dinner card, and
// a logged dinner stays logged, until cooking starts fresh.
import test from "node:test";
import assert from "node:assert/strict";
import { openMemo, storeKeyOf, startAt, markFinished, markLogged } from "../web/js/pages/cook/memo.js";

/** A sessionStorage stand-in for node. */
function fakeStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}
globalThis.sessionStorage = /** @type {any} */ (fakeStorage());

test("not finished: the steps open where the package remembered (start 0)", () => {
  assert.equal(startAt({}, 5), 0);
  assert.equal(startAt({ started: true }, 5), 0);
});

test("finished: the steps open on the last one; no steps opens at 0", () => {
  assert.equal(startAt({ finished: true }, 5), 4);
  assert.equal(startAt({ finished: true }, 0), 0);
});

test("finished and logged survive a reload of the same recipe, per recipe and version", () => {
  const key = storeKeyOf("r1", false);
  const first = openMemo(key, false);
  markFinished(first.memo);
  markLogged(first.memo);
  first.keep();
  const again = openMemo(key, false).memo;
  assert.equal(again.finished, true);
  assert.equal(again.logged, true);
  assert.equal(openMemo(storeKeyOf("r1", true), false).memo.finished, undefined);
  assert.equal(openMemo(storeKeyOf("r2", false), false).memo.finished, undefined);
});

test("fresh=1 forgets the finished state", () => {
  const key = storeKeyOf("r3", false);
  const first = openMemo(key, false);
  markFinished(first.memo);
  first.keep();
  const fresh = openMemo(key, true).memo;
  assert.equal(fresh.finished, undefined);
  assert.equal(fresh.logged, undefined);
  assert.equal(startAt(fresh, 5), 0);
});
