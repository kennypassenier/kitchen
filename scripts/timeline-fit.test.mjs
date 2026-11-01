// node --test scripts/timeline-fit.test.mjs: how a recipe timeline is told to meet its width (web/js/recipe/timeline-fit.js).
import test from "node:test";
import assert from "node:assert/strict";
import { ganttFitAttrs, ganttFitMarkup } from "../web/js/recipe/timeline-fit.js";

test("fit: the plot takes the width it is given (the kit's scroll off)", () => {
  assert.deepEqual(ganttFitAttrs("fit"), { "data-kp-gantt-scroll": "off" });
});

test("scroll and anything unknown keep the kit's own readable plot that scrolls", () => {
  for (const v of ["scroll", undefined, "", "nope"]) assert.deepEqual(ganttFitAttrs(v), { "data-kp-gantt-scroll": "auto" });
});

test("the markup carries the same attributes", () => {
  assert.equal(ganttFitMarkup("fit"), 'data-kp-gantt-scroll="off"');
  assert.equal(ganttFitMarkup("scroll"), 'data-kp-gantt-scroll="auto"');
});
