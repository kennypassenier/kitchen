// node --test scripts/timing-plates.test.mjs: the timing page's plate for a recipe it cannot count back says the link
// may be old only when a link was followed (web/js/pages/timing/plates.js, Kenny 02/11/2026 03:43, feat-stale-answer-1).
import test from "node:test";
import assert from "node:assert/strict";
import { notCountableKeys } from "../web/js/pages/timing/plates.js";
import { EN_TIMING } from "../web/js/i18n/en/timing.js";
import { NL_TIMING } from "../web/js/i18n/nl/timing.js";

test("a recipe from a link that is not in the kitchen: the link may be old", () => {
  assert.deepEqual(notCountableKeys({ found: false, fromWheel: false }), { title: "timing.notInKitchen", text: "timing.linkOld" });
});

test("tonight's wheel answer whose recipe is gone: no word about a link", () => {
  assert.deepEqual(notCountableKeys({ found: false, fromWheel: true }), { title: "timing.notInKitchen", text: "timing.wheelAnswerGone" });
});

test("a recipe that is there but has no step times asks for them, however it came", () => {
  for (const fromWheel of [false, true]) assert.deepEqual(notCountableKeys({ found: true, fromWheel }), { title: "timing.thisNoTimes", text: "timing.giveEveryStep" });
});

test("every key the plates name has words in English and Dutch", () => {
  for (const found of [false, true])
    for (const fromWheel of [false, true])
      for (const key of Object.values(notCountableKeys({ found, fromWheel }))) {
        assert.equal(typeof EN_TIMING[key], "string", `en ${key}`);
        assert.equal(typeof NL_TIMING[key], "string", `nl ${key}`);
      }
});
