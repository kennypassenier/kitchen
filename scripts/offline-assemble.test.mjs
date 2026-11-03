// node --test scripts/offline-assemble.test.mjs: the kitchen built from the kit's local database (feat-db-pages-1,
// web/js/offline/assemble.js): every list in made order, the settings item as `settings` + `settings_rev` (a key the
// kit's overlay left at null removed), the look of a waiting freezer take (the kit lays it over, chassis-rs 4.6.0),
// `partial` with "keep everything" off, and the service's kitchen with the kept items' waiting edits.
import test from "node:test";
import assert from "node:assert/strict";
import { assemble, byCreated, overServer, settingsOf, takeLook } from "../web/js/offline/assemble.js";
import { LISTS, collectionOfPath, itemPath, takePath } from "../web/js/offline/config.js";

test("every list comes out in the order its items were made, seeded ones first, id breaking ties", () => {
  const rows = [{ id: "b", created: "2026-10-02" }, { id: "s" }, { id: "a", created: "2026-10-02" }, { id: "c", created: "2026-10-01" }];
  assert.deepEqual([...rows].sort(byCreated).map((x) => x.id), ["s", "c", "a", "b"]);
  const k = assemble({ shelf: rows }, null);
  assert.deepEqual(k.shelf.map((x) => x.id), ["s", "c", "a", "b"]);
  for (const name of LISTS) assert.ok(Array.isArray(k[name]), `${name} is a list even when the collection is empty`);
  assert.equal(k.format, 5);
  assert.deepEqual(k.recipes, [], "api.js fills the recipe view");
});

test("the kit's pending mark never reaches a screen", () => {
  const k = assemble({ dishes: [{ id: "d1", pending: true, name: { nl: "a", en: "a" } }] }, null);
  assert.deepEqual(k.dishes[0], { id: "d1", name: { nl: "a", en: "a" } });
});

test("the settings item becomes settings + settings_rev; a null left by a queued merge is removed", () => {
  assert.deepEqual(settingsOf({ id: "kitchen", rev: 4, pace: "slow", sound: null, pending: true }), { settings: { pace: "slow" }, settings_rev: 4 });
  assert.deepEqual(settingsOf(null), { settings: {}, settings_rev: 0 });
  assert.equal(settingsOf({ id: "kitchen", rev: -1 }).settings_rev, 0, "a revision the server never writes counts as 0");
  const k = assemble({}, { id: "kitchen", rev: 2, pace: "normal" });
  assert.deepEqual([k.settings, k.settings_rev], [{ pace: "normal" }, 2]);
});

test("a waiting take's look takes portions off, never below zero; a negative take puts back", () => {
  assert.deepEqual(takeLook({ id: "f1", portions: 3 }, { portions: 1 }), { id: "f1", portions: 2 });
  assert.equal(takeLook({ id: "f2", portions: 1 }, { portions: 5 }).portions, 0);
  assert.equal(takeLook({ id: "f3", portions: 1 }, { portions: -2 }).portions, 3);
  assert.equal(takeLook({ id: "f4", portions: 2 }, {}).portions, 1, "no count is one portion, as the server reads it");
  assert.equal(takePath("a b"), "/data/freezer/a%20b/take", "the route the kit's act POSTs to");
});

test("keep everything off: the kitchen is marked partial", () => {
  assert.equal(assemble({}, null, { partial: true }).partial, true);
  assert.equal("partial" in assemble({}, null), false);
});

test("keep everything off, online: the service's kitchen, with only the kept items that wait to be sent laid over", () => {
  const server = { format: 5, dishes: [{ id: "d1", rev: 3, n: "server" }, { id: "d2", rev: 1, n: "server" }], freezer: [{ id: "f1", portions: 2 }], settings: { pace: "normal" }, settings_rev: 5 };
  const lists = { dishes: [{ id: "d1", rev: 2, n: "mine", pending: true }, { id: "d2", rev: 0, n: "old copy" }], freezer: [{ id: "f1", portions: 1, pending: true }] };
  const k = overServer(server, lists, { id: "kitchen", rev: 5, pace: "slow", pending: true });
  assert.deepEqual(k.dishes.map((d) => d.n), ["mine", "server"], "a waiting edit shows; a kept copy never beats the server");
  assert.equal(k.freezer[0].portions, 1);
  assert.deepEqual([k.settings, k.settings_rev], [{ pace: "slow" }, 5]);
  assert.deepEqual(overServer(server, {}, { id: "kitchen", rev: 5, pace: "slow" }).settings, { pace: "normal" }, "settings without a waiting merge are the server's");
});

test("a write path names the collection to pull after it", () => {
  assert.equal(collectionOfPath(itemPath("dishes", "a b")), "dishes");
  assert.equal(collectionOfPath(takePath("f1")), "freezer");
  assert.equal(collectionOfPath("/data/settings/kitchen"), "settings");
  assert.equal(collectionOfPath("/data/restore/shelf/x"), null);
  assert.equal(collectionOfPath("/data/kitchen"), null);
});
