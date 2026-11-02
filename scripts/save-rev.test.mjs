// node --test scripts/save-rev.test.mjs: the revision check every save goes through (web/js/api/save.js,
// fix-quick-rev-1, refactor-rev-kit-1). A quick action names the revision it read (the kit's client sends it as
// If-Match), and the kit's 409 "stale" (chassis-rs `Conflict`, the body the kit's error carries) becomes the
// stale refusal the pages recognise.
import test from "node:test";
import assert from "node:assert/strict";
import { deleteRevFor, failureOf, headersFor, ifMatchFor, isStale, revOf, settingsRevFor } from "../web/js/api/save.js";

const t = (/** @type {string} */ key) => `<${key}>`;

test("a quick action on a recipe sends its dish's revision as read", () => {
  // The safe toggle spreads the recipe it read: `{ ...r, safe: false }`.
  const r = { id: "r1", dish_id: "d", dish_rev: 4, rev: 9, safe: true };
  assert.equal(ifMatchFor("recipes", { ...r, safe: false }), 4);
  // The header itself is the kit's now (window.chassisData quotes it); a POST's headers never carry one.
  assert.deepEqual(headersFor({ ...r, safe: false }), { "Content-Type": "application/json" });
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

test("a POST without a body sends no headers, and no If-Match ever comes from Kitchen's own headers", () => {
  assert.deepEqual(headersFor(undefined), {});
  assert.equal("If-Match" in headersFor({ a: 1 }), false);
});

test("the kit's 409 body (error, remedy, code, rev) still maps to the stale refusal", () => {
  const kit = { error: "this item was changed since you read it", remedy: "reload the item ...", code: "stale", rev: 5 };
  assert.deepEqual(failureOf(409, kit, t), { words: "<api.stale>", limit: null, code: "stale" });
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

// fix-offline-master-5 (Kenny 02/11/2026 19:43, "de server is altijd de master"): a delete and a settings PATCH name
// the revision the page read, so a stale one queued offline is refused on replay instead of silently winning.
test("a delete names the revision of the item as the page holds it; none held names none", () => {
  assert.equal(deleteRevFor({ id: "d", rev: 5 }), 5);
  assert.equal(deleteRevFor({ id: "d" }), 0, "never saved counts as 0, so a delete over a later save is refused");
  assert.equal(deleteRevFor(undefined), undefined, "the kit then sends the revision of its own copy, if any");
});

test("a settings PATCH names the settings' revision from the kitchen read", () => {
  assert.equal(settingsRevFor({ settings_rev: 3 }), 3);
  assert.equal(settingsRevFor({}), 0, "an answer from a server without settings_rev: 0");
  assert.equal(settingsRevFor(null), undefined);
});

test("a stale delete or settings PATCH is the kit's 409 the pages recognise", () => {
  const body = { error: "x", remedy: "y", code: "stale", rev: 2, current: { pace: "calm" } };
  assert.equal(failureOf(409, body, t).code, "stale");
  assert.equal(failureOf(409, body, t).words, "<api.stale>");
  assert.ok(isStale({ status: 409, code: "stale" }));
});
