// node --test scripts/timing-clock.test.mjs: the wall clock of "When do I start?" (web/js/pages/timing/clock.js).
// A dinner time is today's, unless today's passed more than 12 hours ago: then it is tomorrow's, so a dinner just after
// midnight is not counted as 24 hours late (hunt 02/11/2026: "Eat at 00:22 instead" stayed "24 h past the start").
import test from "node:test";
import assert from "node:assert/strict";
import { at, hm } from "../web/js/pages/timing/clock.js";

const iso = (ms) => new Date(ms).toISOString();

test("a dinner later today is today's", () => {
  const now = Date.parse("2026-11-02T02:12:00Z"); // 03:12 in Brussels
  assert.equal(iso(at("19:00", now)), "2026-11-02T18:00:00.000Z");
});

test("a dinner that passed a few hours ago stays today's (late, not tomorrow)", () => {
  const now = Date.parse("2026-11-02T22:40:00Z"); // 23:40
  assert.equal(iso(at("19:00", now)), "2026-11-02T18:00:00.000Z");
});

test("a dinner just after midnight, seen late in the evening, is tomorrow's", () => {
  const now = Date.parse("2026-11-02T22:40:00Z"); // 23:40
  assert.equal(iso(at("00:22", now)), "2026-11-02T23:22:00.000Z");
  assert.equal(hm(at("00:22", now)), "00:22");
});

test("tomorrow's time follows a daylight-saving change", () => {
  const now = Date.parse("2026-03-28T22:30:00Z"); // 23:30 CET; the clocks go forward on 29/03
  assert.equal(iso(at("06:00", now)), "2026-03-29T04:00:00.000Z"); // 06:00 CEST
});
