// node --test scripts/editor-leave.test.mjs: closing the recipe editor (web/js/recipe/editor/leave.js).
import test from "node:test";
import assert from "node:assert/strict";
import { KEEP, DISCARD, isChanged, onClose, outcomeOf } from "../web/js/recipe/editor/leave.js";

test("an unchanged form closes without a question", () => {
  assert.equal(isChanged('{"a":1}', '{"a":1}'), false);
  assert.equal(onClose(false), "close");
});

test("a changed form asks", () => {
  assert.equal(isChanged('{"a":1}', '{"a":2}'), true);
  assert.equal(onClose(true), "ask");
});

test("Keep as draft writes the draft and drops nothing", () => {
  assert.deepEqual(outcomeOf(KEEP), { saveDraft: true, dropDraft: false, dropPhotos: false });
});

test("Discard drops the draft and this session's photos", () => {
  assert.deepEqual(outcomeOf(DISCARD), { saveDraft: false, dropDraft: true, dropPhotos: true });
});

test("any other answer (Escape on the question, empty) keeps the work", () => {
  for (const choice of [undefined, "", "cancel", "x"]) assert.equal(outcomeOf(choice).dropDraft, false);
});
