// node --test scripts/timeline-fit.test.mjs: how a recipe timeline is told to meet its width (web/js/recipe/timeline-fit.js):
// cook mode asks for "fit", which is the kit's own fit mode from FIT_FROM on and "scroll off" before it.
import test from "node:test";
import assert from "node:assert/strict";
import { ganttFitAttrs, ganttFitMarkup, atLeast, FIT_FROM } from "../web/js/recipe/timeline-fit.js";

test("versions compare by major, minor, patch; unreadable counts as older", () => {
  assert.equal(atLeast("12.2.0", "12.2.0"), true);
  assert.equal(atLeast("12.10.0", "12.2.0"), true);
  assert.equal(atLeast("13.0.0", "12.2.0"), true);
  assert.equal(atLeast("12.1.9", "12.2.0"), false);
  assert.equal(atLeast("12.0.0", "12.2.0"), false);
  assert.equal(atLeast("", "12.2.0"), false);
  assert.equal(atLeast("dev", "12.2.0"), false);
});

test("fit on today's kit (12.0.0): the plot takes its width, never the kit's scrolled default", () => {
  assert.deepEqual(ganttFitAttrs("fit", "12.0.0"), { "data-kp-gantt-scroll": "off" });
  assert.deepEqual(ganttFitAttrs("fit", ""), { "data-kp-gantt-scroll": "off" });
});

test("fit on a kit that has it: the kit's own fit mode", () => {
  assert.deepEqual(ganttFitAttrs("fit", FIT_FROM), { "data-kp-gantt-scroll": "fit" });
  assert.deepEqual(ganttFitAttrs("fit", "13.1.0"), { "data-kp-gantt-scroll": "fit" });
});

test("scroll and anything unknown keep the kit's readable plot that scrolls, on every kit", () => {
  for (const v of ["scroll", undefined, "", "nope"]) {
    assert.deepEqual(ganttFitAttrs(v, "12.0.0"), { "data-kp-gantt-scroll": "auto" });
    assert.deepEqual(ganttFitAttrs(v, "99.0.0"), { "data-kp-gantt-scroll": "auto" });
  }
});

test("the markup carries the same attributes", () => {
  assert.equal(ganttFitMarkup("fit", "12.0.0"), 'data-kp-gantt-scroll="off"');
  assert.equal(ganttFitMarkup("fit", "12.2.0"), 'data-kp-gantt-scroll="fit"');
  assert.equal(ganttFitMarkup("scroll", "12.2.0"), 'data-kp-gantt-scroll="auto"');
});
