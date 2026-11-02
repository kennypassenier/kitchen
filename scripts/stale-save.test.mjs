// node --test scripts/stale-save.test.mjs: a recipe saved elsewhere since the editor opened it comes back as the stale
// result the page turns into its alert (web/js/recipe/editor/stale.js, fix-stale-save-1).
import test from "node:test";
import assert from "node:assert/strict";
import { isStale, staleResult } from "../web/js/recipe/editor/stale.js";

const t = (/** @type {string} */ key) => `<${key}>`;

test("the server's 409 with code stale becomes the editor's stale result", () => {
  const e = Object.assign(new Error("changed elsewhere"), { status: 409, code: "stale" });
  assert.equal(isStale(e), true);
  assert.deepEqual(staleResult(e, t), { ok: false, stale: true, section: "dish", message: "<ep.staleTitle>" });
});

test("any other refusal is left to the editor's usual message", () => {
  for (const e of [
    Object.assign(new Error("already back"), { status: 409, code: "" }),
    Object.assign(new Error("too long"), { status: 400, code: "stale" }),
    new Error("offline"),
    null,
    "stale",
  ]) {
    assert.equal(isStale(e), false);
    assert.equal(staleResult(e, t), null);
  }
});
