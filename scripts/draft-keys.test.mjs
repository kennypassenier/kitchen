// node --test scripts/draft-keys.test.mjs: the keys of the editor's drafts (fix-draft-key-1).
import test from "node:test";
import assert from "node:assert/strict";
import { newKey, importKey, copyKey, ownKey, keyKind, offeredForNew, offeredFor } from "../web/js/recipe/draft-keys.js";

const U1 = "0b6c1f0e-1d2a-4c3b-9e8f-112233445566";
const U2 = "9a8b7c6d-5e4f-4a3b-8c2d-665544332211";

test("an import and a copy never share the key of a blank new recipe in the same dish", () => {
  assert.equal(newKey("d1"), "new:d1");
  assert.equal(newKey(null), "new:");
  assert.notEqual(importKey("d1", U1), newKey("d1"));
  assert.notEqual(copyKey("r1", U1), newKey("d1"));
  assert.notEqual(importKey("d1", U1), importKey("d1", U2));
  assert.equal(importKey(null, U1), `import::${U1}`);
  assert.equal(copyKey("r1", U2), `copy:r1:${U2}`);
});

test("only an import's or a copy's own key is read from an address", () => {
  assert.equal(ownKey(importKey("d1", U1)), importKey("d1", U1));
  assert.equal(ownKey(importKey(null, U1)), importKey(null, U1));
  assert.equal(ownKey(copyKey("r-1_x", U2)), copyKey("r-1_x", U2));
  for (const bad of [null, "", "new:d1", "r1", `import:d1:${U1}x`, `import:d/1:${U1}`, `copy:r1:not-a-uuid`, `evil:d1:${U1}`]) assert.equal(ownKey(bad), null, String(bad));
});

test("a key says what it belongs to", () => {
  assert.equal(keyKind("new:d1"), "new");
  assert.equal(keyKind(importKey("d1", U1)), "import");
  assert.equal(keyKind(copyKey("r1", U1)), "copy");
  assert.equal(keyKind("8b0f0e2a-recipe"), "recipe");
});

test("a blank new recipe offers its own draft first, else the newest import's or copy's left in that dish", () => {
  const drafts = [
    { key: "new:d1", data: { dish_id: "d1" }, saved: "2026-11-01T10:00:00Z" },
    { key: importKey("d1", U1), data: { dish_id: "d1" }, saved: "2026-11-02T09:00:00Z" },
    { key: copyKey("r9", U2), data: { dish_id: "d2" }, saved: "2026-11-02T11:00:00Z" },
    { key: "r5", data: { dish_id: "d1" }, saved: "2026-11-02T12:00:00Z" },
  ];
  assert.equal(offeredForNew(drafts, "d1")?.key, "new:d1");
  assert.equal(offeredForNew(drafts.slice(1), "d1")?.key, importKey("d1", U1));
  const later = { key: importKey("d1", U2), data: { dish_id: "d1" }, saved: "2026-11-02T10:00:00Z" };
  assert.equal(offeredForNew([...drafts.slice(1), later], "d1")?.key, importKey("d1", U2));
  assert.equal(offeredForNew(drafts, "d2")?.key, copyKey("r9", U2));
  assert.equal(offeredForNew(drafts, "d3"), null);
  assert.equal(offeredForNew([{ key: importKey(null, U1), data: { dish_id: null } }], null)?.key, importKey(null, U1));
  assert.equal(offeredForNew([{ key: "new:d1" }, null, { nokey: 1 }], "d1")?.key, "new:d1");
});

test("a saved recipe, an import and a copy offer only the draft under their own key", () => {
  const drafts = [{ key: "r1", data: {} }, { key: importKey("d1", U1), data: { dish_id: "d1" } }, { key: "new:d1", data: { dish_id: "d1" } }];
  assert.equal(offeredFor(drafts, "r1", "d1")?.key, "r1");
  assert.equal(offeredFor(drafts, importKey("d1", U2), "d1"), null);
  assert.equal(offeredFor(drafts, importKey("d1", U1), "d1")?.key, importKey("d1", U1));
  assert.equal(offeredFor(drafts, "new:d1", "d1")?.data?.dish_id, "d1");
});
