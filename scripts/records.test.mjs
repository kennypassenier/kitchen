// node --test scripts/records.test.mjs: the pure rules behind delete-with-Undo and the category order
// (web/js/records/undo-logic.js, web/js/records/order.js), without the DOM or the server.
import test from "node:test";
import assert from "node:assert/strict";
import { recipeBack, placeOf } from "../web/js/records/undo-logic.js";
import { closeUp, makeRoom, reordered, nextOrder, byOrder } from "../web/js/records/order.js";

const cats = (...orders) => orders.map((order, i) => ({ id: `c${i + 1}`, order }));
const orders = (items) => Object.fromEntries(items.map((x) => [x.id, x.order]));

test("closeUp closes the gap a deleted category left, and changes nothing when there is none", () => {
  assert.deepEqual(orders(closeUp([{ id: "a", order: 1 }, { id: "c", order: 3 }, { id: "d", order: 4 }])), { c: 2, d: 3 });
  assert.deepEqual(closeUp(cats(1, 2, 3)), []);
  assert.deepEqual(closeUp([]), []);
});

test("makeRoom puts a restored category back at its old place and moves the rest one down", () => {
  const after = [{ id: "a", order: 1 }, { id: "c", order: 2 }, { id: "d", order: 3 }];
  const back = { id: "b", order: 2 };
  assert.deepEqual(orders(makeRoom([...after, back], back)), { c: 3, d: 4 });
  // The restored one counts once, whether the list already holds it or not.
  assert.deepEqual(orders(makeRoom(after, back)), { c: 3, d: 4 });
});

test("makeRoom clamps a place past the end, and a missing order goes last", () => {
  const list = [{ id: "a", order: 1 }];
  assert.deepEqual(orders(makeRoom(list, { id: "z", order: 9 })), { z: 2 });
  assert.deepEqual(orders(makeRoom(list, { id: "z" })), { z: 2 });
  assert.deepEqual(orders(makeRoom(list, { id: "z", order: 0 })), { z: 1, a: 2 });
});

test("reordered reads a dragged order back into 1, 2, 3 and keeps unknown keys out", () => {
  const list = cats(1, 2, 3);
  assert.deepEqual(orders(reordered(list, ["c3", "c1", "c2"])), { c3: 1, c1: 2, c2: 3 });
  assert.deepEqual(reordered(list, ["c1", "c2", "c3"]), []);
  // A key the table shows but the kitchen no longer has is ignored; a category the table missed stays after the others.
  assert.deepEqual(orders(reordered(list, ["gone", "c2", "c1"])), { c2: 1, c1: 2 });
});

test("nextOrder puts a new category after the last one", () => {
  assert.equal(nextOrder([]), 1);
  assert.equal(nextOrder(cats(1, 4, 2)), 5);
  assert.equal(nextOrder([{ id: "x" }]), 1);
});

test("byOrder keeps the list's own order for ties and puts unnumbered items last", () => {
  assert.deepEqual(byOrder([{ id: "u" }, { id: "b", order: 2 }, { id: "a", order: 1 }, { id: "b2", order: 2 }]).map((x) => x.id), ["a", "b", "b2", "u"]);
});

test("recipeBack returns a recipe to its place; a default takes the mark back from its stand-in", () => {
  const was = { id: "r1", default: true };
  const now = [{ id: "r2", default: true }, { id: "r3" }];
  assert.deepEqual(recipeBack(now, was, 0), [was, { id: "r2", default: false }, { id: "r3" }]);
  const plain = { id: "r9" };
  assert.deepEqual(recipeBack(now, plain, 1), [{ id: "r2", default: true }, plain, { id: "r3" }]);
  assert.deepEqual(recipeBack(now, plain, 99).at(-1), plain);
  // Already back (a double Undo): unchanged.
  assert.equal(recipeBack([was], was, 0).length, 1);
});

test("placeOf finds where an item stood, -1 when absent", () => {
  assert.equal(placeOf(cats(1, 2), "c2"), 1);
  assert.equal(placeOf([], "x"), -1);
});
