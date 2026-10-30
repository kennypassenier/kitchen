// node --test scripts/log.test.mjs: the week arithmetic of the cooking log (web/js/recipe/log/dates.js), pure and without the DOM.
import test from "node:test";
import assert from "node:assert/strict";
import { plus, mondayOf, shownMondays, WEEKS } from "../web/js/recipe/log/dates.js";

test("plus moves a calendar day across month and year ends", () => {
  assert.equal(plus("2026-10-30", 1), "2026-10-31");
  assert.equal(plus("2026-10-31", 1), "2026-11-01");
  assert.equal(plus("2026-12-31", 1), "2027-01-01");
  assert.equal(plus("2026-03-01", -1), "2026-02-28");
  assert.equal(plus("2028-03-01", -1), "2028-02-29");
  assert.equal(plus("2026-10-30", 0), "2026-10-30");
});

test("plus is not moved by the clock change at the end of October", () => {
  assert.equal(plus("2026-10-24", 2), "2026-10-26");
  assert.equal(plus("2026-10-26", -2), "2026-10-24");
  assert.equal(plus("2026-03-28", 2), "2026-03-30");
});

test("mondayOf is the Monday of the week, a Sunday counts to the week before", () => {
  assert.equal(mondayOf("2026-10-26"), "2026-10-26"); // a Monday
  assert.equal(mondayOf("2026-10-30"), "2026-10-26"); // the Friday of that week
  assert.equal(mondayOf("2026-11-01"), "2026-10-26"); // its Sunday
  assert.equal(mondayOf("2026-11-02"), "2026-11-02");
  assert.equal(mondayOf("2027-01-01"), "2026-12-28"); // across a year end
});

test("shownMondays lists the last four weeks, oldest first, ending with this week's Monday", () => {
  const weeks = shownMondays("2026-10-30");
  assert.equal(WEEKS, 4);
  assert.deepEqual(weeks, ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
  assert.deepEqual(shownMondays("2026-11-01"), weeks);
  assert.deepEqual(shownMondays("2026-11-02").at(-1), "2026-11-02");
});

test("every shown Monday is a Monday and a week apart", () => {
  for (const day of ["2026-01-01", "2026-03-29", "2026-10-25", "2028-02-29"]) {
    const weeks = shownMondays(day);
    weeks.forEach((w, i) => {
      assert.equal(mondayOf(w), w);
      if (i) assert.equal(plus(weeks[i - 1], 7), w);
    });
  }
});
