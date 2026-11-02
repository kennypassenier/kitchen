// node --test scripts/draft-notice.test.mjs: the "Draft not saved" notice shows once until a save succeeds again
// (web/js/recipe/editor/draft-notice.js, fix-draft-toast-1).
import test from "node:test";
import assert from "node:assert/strict";
import { createDraftNotice } from "../web/js/recipe/editor/draft-notice.js";

const setup = () => {
  const seen = { shown: 0, warned: /** @type {string[]} */ ([]) };
  const notice = createDraftNotice({ show: () => seen.shown++, warn: (m) => seen.warned.push(m) });
  return { seen, notice };
};

test("failures in a row show the notice once and log every one", () => {
  const { seen, notice } = setup();
  for (let i = 0; i < 5; i++) notice.failed("r1", new Error("offline"));
  assert.equal(seen.shown, 1);
  assert.equal(seen.warned.length, 5);
  assert.equal(seen.warned[0], "the draft r1 was not saved");
});

test("a success in between makes the next failure show again", () => {
  const { seen, notice } = setup();
  notice.failed("r1", null);
  notice.succeeded();
  assert.equal(notice.shown, false);
  notice.failed("r1", null);
  notice.failed("r1", null);
  assert.equal(seen.shown, 2);
});

test("successes alone never show it", () => {
  const { seen, notice } = setup();
  notice.succeeded();
  notice.succeeded();
  assert.equal(seen.shown, 0);
  assert.equal(seen.warned.length, 0);
});
