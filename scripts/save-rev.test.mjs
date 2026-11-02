// node --test scripts/save-rev.test.mjs: the revision check every save goes through (web/js/api/save.js,
// fix-quick-rev-1). A quick action sends the revision it read as If-Match, and the server's 409 "stale" becomes the
// stale refusal the pages recognise.
import test from "node:test";
import assert from "node:assert/strict";
import { failureOf, headersFor, ifMatchFor, isStale, revOf } from "../web/js/api/save.js";

const t = (/** @type {string} */ key) => `<${key}>`;

test("a quick action on a recipe sends its dish's revision as read", () => {
  // The safe toggle spreads the recipe it read: `{ ...r, safe: false }`.
  const r = { id: "r1", dish_id: "d", dish_rev: 4, rev: 9, safe: true };
  assert.equal(ifMatchFor("recipes", { ...r, safe: false }), 4);
  assert.deepEqual(headersFor({ ...r, safe: false }, ifMatchFor("recipes", r)), { "Content-Type": "application/json", "If-Match": "4" });
});

test("any other list sends the item's own revision; never saved counts as 0", () => {
  assert.equal(ifMatchFor("dish_categories", { id: "c", order: 2, rev: 7 }), 7);
  assert.equal(ifMatchFor("dishes", { id: "d" }), 0);
  assert.equal(ifMatchFor("recipes", { id: "r" }), 0);
});

test("the caller's own revision wins over the body's", () => {
  assert.equal(ifMatchFor("dishes", { id: "d", rev: 3 }, { explicit: 2 }), 2);
  assert.equal(ifMatchFor("recipes", { id: "r", dish_rev: 3 }, { explicit: 0 }), 0);
});

test("a body without a revision falls back to the item as this page read it", () => {
  assert.equal(ifMatchFor("dishes", { id: "d", name: "x" }, { held: { id: "d", rev: 6 } }), 6);
  // A recipe's held item is its dish.
  assert.equal(ifMatchFor("recipes", { id: "r", safe: true }, { held: { id: "d", rev: 2 } }), 2);
  // The body's own revision, even 0, is what was read: the held copy may have moved on since.
  assert.equal(ifMatchFor("dishes", { id: "d", rev: 0 }, { held: { id: "d", rev: 6 } }), 0);
});

test("a revision that is no whole number counts as 0, so the save is still checked", () => {
  for (const rev of [-1, 1.5, "3", null, NaN, Infinity]) assert.equal(revOf({ rev }), 0, String(rev));
});

test("a call without a body or revision sends no such headers", () => {
  assert.deepEqual(headersFor(undefined), {});
  assert.deepEqual(headersFor(undefined, 0), { "If-Match": "0" });
});

test("409 with code stale maps to the stale refusal in the page's words", () => {
  const f = failureOf(409, { error: "changed since", code: "stale", rev: 5 }, t);
  assert.deepEqual(f, { words: "<api.stale>", limit: null, code: "stale" });
  assert.equal(isStale({ status: 409, code: f.code }), true);
});

test("other refusals keep their own words and are not stale", () => {
  assert.deepEqual(failureOf(409, { error: "already back" }, t), { words: "already back", limit: null, code: "" });
  assert.deepEqual(failureOf(400, { error: "bad If-Match", code: "stale" }, t), { words: "bad If-Match", limit: null, code: "stale" });
  assert.equal(failureOf(500, null, t).words, "The kitchen answered 500.");
  for (const e of [{ status: 409, code: "" }, { status: 400, code: "stale" }, new Error("offline"), null, "stale"]) assert.equal(isStale(e), false);
});
