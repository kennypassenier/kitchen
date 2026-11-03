// node --test scripts/offline-assemble.test.mjs: the kitchen built from the kit's local database (feat-db-pages-1,
// web/js/offline/assemble.js): every list in made order, the settings item as `settings` + `settings_rev` (a key the
// kit's overlay left at null removed), waiting freezer takes laid over (failed ones skipped), `partial` with
// "keep everything" off, and the service's kitchen with the kept items' waiting edits. Written 03/11/2026, NOT run
// (Kenny's test rule): docs/OPEN.md release check 16.
import test from "node:test";
import assert from "node:assert/strict";
import { applyTakes, assemble, byCreated, overServer, settingsOf, takeFrom, takeIdOf } from "../web/js/offline/assemble.js";
import { LISTS, collectionOfPath, itemPath, takePath } from "../web/js/offline/config.js";

const take = (id, portions = 1, state = "queued") => ({ method: "POST", path: takePath(id), body: { portions }, state });

test("every list comes out in the order its items were made, seeded ones first, id breaking ties", () => {
  const rows = [{ id: "b", created: "2026-10-02" }, { id: "s" }, { id: "a", created: "2026-10-02" }, { id: "c", created: "2026-10-01" }];
  assert.deepEqual([...rows].sort(byCreated).map((x) => x.id), ["s", "c", "a", "b"]);
  const k = assemble({ shelf: rows }, null, []);
  assert.deepEqual(k.shelf.map((x) => x.id), ["s", "c", "a", "b"]);
  for (const name of LISTS) assert.ok(Array.isArray(k[name]), `${name} is a list even when the collection is empty`);
  assert.equal(k.format, 5);
  assert.deepEqual(k.recipes, [], "api.js fills the recipe view");
});

test("the kit's pending mark never reaches a screen", () => {
  const k = assemble({ dishes: [{ id: "d1", pending: true, name: { nl: "a", en: "a" } }] }, null, []);
  assert.deepEqual(k.dishes[0], { id: "d1", name: { nl: "a", en: "a" } });
});

test("the settings item becomes settings + settings_rev; a null left by a queued merge is removed", () => {
  assert.deepEqual(settingsOf({ id: "kitchen", rev: 4, pace: "slow", sound: null, pending: true }), { settings: { pace: "slow" }, settings_rev: 4 });
  assert.deepEqual(settingsOf(null), { settings: {}, settings_rev: 0 });
  assert.equal(settingsOf({ id: "kitchen", rev: -1 }).settings_rev, 0, "a revision the server never writes counts as 0");
  const k = assemble({}, { id: "kitchen", rev: 2, pace: "normal" }, []);
  assert.deepEqual([k.settings, k.settings_rev], [{ pace: "normal" }, 2]);
});

test("waiting takes are laid over the freezer in queue order, never below zero; failed ones and other edits skipped", () => {
  const freezer = [{ id: "f1", portions: 3 }, { id: "f2", portions: 1 }];
  const queue = [take("f1"), take("f2", 5), take("f1", 1, "failed"), { method: "PUT", path: itemPath("freezer", "f1"), body: {}, state: "queued" }, take("nope")];
  assert.deepEqual(applyTakes(freezer, queue), [{ id: "f1", portions: 2 }, { id: "f2", portions: 0 }]);
  assert.equal(takeFrom(freezer, "x", 1), null);
  assert.equal(takeIdOf({ method: "POST", path: "/data/freezer/%E0%A4%A/take" }), null, "a path Kitchen never wrote");
  assert.equal(assemble({ freezer }, null, [take("f1", 2)]).freezer[0].portions, 1);
});

test("keep everything off: the kitchen is marked partial", () => {
  assert.equal(assemble({}, null, [], { partial: true }).partial, true);
  assert.equal("partial" in assemble({}, null, []), false);
});

test("keep everything off, online: the service's kitchen, with only the kept items that wait to be sent laid over", () => {
  const server = { format: 5, dishes: [{ id: "d1", rev: 3, n: "server" }, { id: "d2", rev: 1, n: "server" }], freezer: [{ id: "f1", portions: 2 }], settings: { pace: "normal" }, settings_rev: 5 };
  const lists = { dishes: [{ id: "d1", rev: 2, n: "mine", pending: true }, { id: "d2", rev: 0, n: "old copy" }] };
  const k = overServer(server, lists, { id: "kitchen", rev: 5, pace: "slow", pending: true }, [take("f1")]);
  assert.deepEqual(k.dishes.map((d) => d.n), ["mine", "server"], "a waiting edit shows; a kept copy never beats the server");
  assert.equal(k.freezer[0].portions, 1);
  assert.deepEqual([k.settings, k.settings_rev], [{ pace: "slow" }, 5]);
  assert.deepEqual(overServer(server, {}, { id: "kitchen", rev: 5, pace: "slow" }, []).settings, { pace: "normal" }, "settings without a waiting merge are the server's");
});

test("a write path names the collection to pull after it", () => {
  assert.equal(collectionOfPath(itemPath("dishes", "a b")), "dishes");
  assert.equal(collectionOfPath(takePath("f1")), "freezer");
  assert.equal(collectionOfPath("/data/settings/kitchen"), "settings");
  assert.equal(collectionOfPath("/data/restore/shelf/x"), null);
  assert.equal(collectionOfPath("/data/kitchen"), null);
});
