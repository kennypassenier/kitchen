// node --test scripts/edit-page.test.mjs: the recipe editor page's address, return target, handoff and changed sections.
import test from "node:test";
import assert from "node:assert/strict";
import { parseEdit, editHref, safeReturn, here, backTarget, afterSave } from "../web/js/recipe/edit-route.js";
import { putHandoff, readHandoff, clearHandoff } from "../web/js/recipe/edit-handoff.js";
import { changedSections, SECTIONS } from "../web/js/recipe/editor/sections.js";

const q = (s) => new URLSearchParams(s);

test("an id means edit, and wins over new and dish", () => {
  assert.deepEqual(parseEdit(q("id=r1&new=1&dish=d1")), { kind: "edit", id: "r1" });
});

test("new or dish means a new recipe; start and safe are read, an unknown start is ignored", () => {
  assert.deepEqual(parseEdit(q("new=1")), { kind: "new", dishId: null, safe: false, start: null, draft: null });
  assert.deepEqual(parseEdit(q("dish=d1")), { kind: "new", dishId: "d1", safe: false, start: null, draft: null });
  assert.deepEqual(parseEdit(q("new=1&safe=1&start=import")), { kind: "new", dishId: null, safe: true, start: "import", draft: null });
  assert.equal(parseEdit(q("new=1&start=evil")).start, null);
});

test("a copy or an import carries its own draft key; any other key, or one without a copy or import, is ignored", () => {
  const key = "import:d1:0b6c1f0e-1d2a-4c3b-9e8f-112233445566";
  assert.equal(parseEdit(q(`dish=d1&start=import&draft=${encodeURIComponent(key)}`)).draft, key);
  assert.equal(parseEdit(q(`dish=d1&draft=${encodeURIComponent(key)}`)).draft, null);
  assert.equal(parseEdit(q("dish=d1&start=copy&draft=new%3Ad1")).draft, null);
  assert.equal(editHref({ dish: "d1", start: "import", draft: key }), `/recipe/edit?new=1&dish=d1&start=import&draft=${encodeURIComponent(key)}`);
  assert.equal(editHref({ dish: "d1", draft: key }), "/recipe/edit?new=1&dish=d1");
});

test("an address with neither is nothing", () => {
  assert.deepEqual(parseEdit(q("")), { kind: "none" });
  assert.deepEqual(parseEdit(q("new=0")), { kind: "none" });
});

test("editHref builds each form and encodes the return path", () => {
  assert.equal(editHref({ id: "a b" }), "/recipe/edit?id=a+b");
  assert.equal(editHref({ dish: "d1", start: "copy" }, "/recipes?x=1"), "/recipe/edit?new=1&dish=d1&start=copy&from=%2Frecipes%3Fx%3D1");
  assert.equal(editHref({}), "/recipe/edit?new=1");
});

test("a return path stays inside the app and never loops into the editor", () => {
  for (const bad of [null, "", "https://evil.example/", "//evil.example", "recipes", "/\\evil", "/recipe/edit?id=1", "/recipe/edit/"]) assert.equal(safeReturn(bad), null, String(bad));
  assert.equal(safeReturn("/dishes/d1"), "/dishes/d1");
  assert.equal(here({ pathname: "/recipe/edit", search: "?id=1" }), null);
  assert.equal(here({ pathname: "/recipes", search: "" }), "/recipes");
});

test("Save and Back return to where the person came from, else the recipe page", () => {
  assert.equal(afterSave("/dishes/d1", "r9"), "/dishes/d1");
  assert.equal(afterSave(null, "r 9"), "/recipe?id=r%209");
  assert.equal(afterSave("https://evil.example", "r9"), "/recipe?id=r9");
  assert.equal(backTarget({ kind: "edit", id: "r1" }, null), "/recipe?id=r1");
  assert.equal(backTarget({ kind: "new", dishId: null, safe: false, start: null }, null), "/recipes");
  assert.equal(backTarget({ kind: "edit", id: "r1" }, "/bad-days"), "/bad-days");
});

/** @returns {Storage} */
const memory = () => {
  const m = new Map();
  return /** @type {any} */ ({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) });
};

test("a handoff is read back only by its own kind, and clears", () => {
  const s = memory();
  putHandoff(s, { kind: "import", dishId: "d1", restore: { portions: 4 }, cover: "https://x/y.jpg" });
  assert.equal(readHandoff(s, "copy"), null);
  assert.deepEqual(readHandoff(s, "import"), { kind: "import", dishId: "d1", restore: { portions: 4 }, cover: "https://x/y.jpg" });
  assert.ok(readHandoff(s, "import"), "a reload still finds it");
  clearHandoff(s);
  assert.equal(readHandoff(s, "import"), null);
});

test("an unreadable handoff is none", () => {
  const s = memory();
  s.setItem("rl-edit-handoff", "{nope");
  assert.equal(readHandoff(s, "copy"), null);
});

test("changed sections: only the section whose fields differ", () => {
  const a = { summary: "x", portions: 2, steps: [{ id: 1 }], tracks: [] };
  assert.deepEqual(changedSections(a, { ...a }), []);
  assert.deepEqual(changedSections(a, { ...a, summary: "y" }), ["dish"]);
  assert.deepEqual(changedSections(a, { ...a, portions: 3, steps: [] }), ["time", "steps"]);
  assert.deepEqual(changedSections(a, { ...a, tracks: [{ name: "oven" }] }), ["lists"]);
});

test("with nothing to compare with every section holding fields counts as changed", () => {
  assert.deepEqual(changedSections(null, {}), ["dish", "time", "notes", "lists", "steps"]);
  assert.equal(SECTIONS.find((s) => s.key === "timeline")?.fields.length, 0);
});
