// node --test scripts/offline-apply.test.mjs: the kit's waiting edits laid over a kitchen (web/js/offline/apply.js,
// feat-offline-kitchen). A page reloaded without a connection must show what the person changed: list PUT and DELETE,
// the settings PATCH, a recipe saved as its dish, and nothing of an edit the kitchen refused.
import test from "node:test";
import assert from "node:assert/strict";
import { applyEdit, applyQueued, itemPath, mergeSettings, queuedDeleteOf, shapeOf } from "../web/js/offline/apply.js";

const kitchen = () => ({
  format: 5,
  dishes: [
    { id: "d1", rev: 2, name: { nl: "Stoofvlees", en: "Beef stew" }, recipes: [{ id: "r1", default: true, steps: [] }] },
    { id: "d2", rev: 0, name: { nl: "Soep", en: "Soup" }, recipes: [] },
  ],
  shelf: [{ id: "s1", name: { nl: "Brood", en: "Bread" } }],
  freezer: [{ id: "f1", portions: 3 }],
  settings: { lang: "nl", pace: "slow" },
});

test("the paths api.js writes are read back as the edit they are", () => {
  assert.deepEqual(shapeOf({ method: "PUT", path: "/data/dishes/d1" }), { kind: "replace", list: "dishes", id: "d1" });
  assert.deepEqual(shapeOf({ method: "DELETE", path: itemPath("shelf", "a b/c") }), { kind: "delete", list: "shelf", id: "a b/c" });
  assert.deepEqual(shapeOf({ method: "PATCH", path: "/data/settings" }), { kind: "settings" });
  for (const edit of [
    { method: "POST", path: "/data/dishes" },
    { method: "PATCH", path: "/data/dishes/d1" },
    { method: "PUT", path: "/data/restore/dishes/d1" },
    { method: "PUT", path: "/data/dishes/%E0%A4%A" },
  ]) assert.equal(shapeOf(edit), null, `${edit.method} ${edit.path}`);
});

test("a queued PUT replaces the item whole, a recipe saved as its dish included", () => {
  const k = kitchen();
  const edited = { ...k.dishes[0], recipes: [{ id: "r1", default: true, steps: [{ text: "stir" }] }] };
  const out = applyEdit(k, { method: "PUT", path: "/data/dishes/d1", body: edited });
  assert.deepEqual(out?.dishes[0].recipes[0].steps, [{ text: "stir" }]);
  assert.equal(out?.dishes[0].rev, 2, "the revision stays the one it was read at, which the queued edit names");
  assert.equal(k.dishes[0].recipes[0].steps.length, 0, "the kitchen it was laid over is not changed");
  assert.equal(out?.shelf, k.shelf, "untouched lists are shared, not copied");
});

test("the body's id never moves an edit to another item", () => {
  const out = applyEdit(kitchen(), { method: "PUT", path: "/data/dishes/d2", body: { id: "d1", name: { nl: "x", en: "x" } } });
  assert.equal(out?.dishes.find((d) => d.id === "d2")?.name.nl, "x");
  assert.equal(out?.dishes.find((d) => d.id === "d1")?.name.nl, "Stoofvlees");
});

test("a queued DELETE removes the item", () => {
  const out = applyEdit(kitchen(), { method: "DELETE", path: "/data/shelf/s1" });
  assert.deepEqual(out?.shelf, []);
});

test("the settings PATCH merges as the server does: null removes a key", () => {
  assert.deepEqual(mergeSettings({ lang: "nl", pace: "slow" }, { pace: null, spare: 10 }), { lang: "nl", spare: 10 });
  const out = applyEdit(kitchen(), { method: "PATCH", path: "/data/settings", body: { lang: "en" } });
  assert.deepEqual(out?.settings, { lang: "en", pace: "slow" });
});

test("edits are laid over in queue order, and a refused (failed) edit is skipped", () => {
  const edits = [
    { method: "PUT", path: "/data/dishes/d2", body: { id: "d2", name: { nl: "A", en: "A" } }, state: "queued" },
    { method: "PUT", path: "/data/dishes/d2", body: { id: "d2", name: { nl: "B", en: "B" } }, state: "failed" },
    { method: "PUT", path: "/data/dishes/d2", body: { id: "d2", name: { nl: "C", en: "C" } }, state: "queued" },
    { method: "DELETE", path: "/data/shelf/s1", state: "held" },
  ];
  const { kitchen: out, unknown } = applyQueued(kitchen(), edits);
  assert.equal(out.dishes.find((d) => d.id === "d2").name.nl, "C");
  assert.deepEqual(out.shelf, [], "a held edit still waits to be sent, so the page shows it");
  assert.deepEqual(unknown, []);
});

test("an edit that does not fit the kitchen is handed back, not guessed at", () => {
  const odd = [
    { method: "PUT", path: "/data/nolist/x", body: { a: 1 }, state: "queued" },
    { method: "PUT", path: "/data/dishes/d1", state: "queued" },
    { method: "POST", path: "/data/dishes", body: {}, state: "queued" },
  ];
  const { kitchen: out, unknown } = applyQueued(kitchen(), odd);
  assert.equal(unknown.length, 3);
  assert.deepEqual(out, kitchen());
});

test("Undo finds only a delete that still waits to be sent", () => {
  const edits = [
    { id: 1, method: "PUT", path: "/data/shelf/s1", state: "queued" },
    { id: 2, method: "DELETE", path: "/data/shelf/s1", state: "failed" },
    { id: 3, method: "DELETE", path: "/data/shelf/s1", state: "queued" },
  ];
  assert.equal(queuedDeleteOf(edits, "shelf", "s1")?.id, 3);
  assert.equal(queuedDeleteOf(edits, "shelf", "nope"), null);
  assert.equal(queuedDeleteOf(edits.slice(0, 2), "shelf", "s1"), null);
});
