// node --test scripts/timeline-fit.test.mjs: how a recipe timeline is told to meet its width (web/js/recipe/timeline-fit.js):
// cook mode asks for "fit", the kit's own fit mode; anything else keeps the plot that scrolls.
import test from "node:test";
import assert from "node:assert/strict";
import { ganttFitAttrs, ganttFitMarkup } from "../web/js/recipe/timeline-fit.js";

test("fit is the kit's own fit mode", () => {
  assert.deepEqual(ganttFitAttrs("fit"), { "data-kp-gantt-scroll": "fit" });
});

test("scroll and anything unknown keep the kit's readable plot that scrolls", () => {
  for (const v of ["scroll", undefined, "", "nope"]) assert.deepEqual(ganttFitAttrs(v), { "data-kp-gantt-scroll": "auto" });
});

test("the markup carries the same attributes", () => {
  assert.equal(ganttFitMarkup("fit"), 'data-kp-gantt-scroll="fit"');
  assert.equal(ganttFitMarkup("scroll"), 'data-kp-gantt-scroll="auto"');
});
