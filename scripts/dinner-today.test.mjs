// node --test scripts/dinner-today.test.mjs: a dinner time changed on "When do I start?" holds for today only
// (web/js/dinner-today.js, Kenny 02/11/2026 03:43, feat-timing-today-1).
import test from "node:test";
import assert from "node:assert/strict";
import { dinnerTodayOf, dinnerToday } from "../web/js/dinner-today.js";

const ms = (iso) => Date.parse(iso);
const kept = (eat, iso) => JSON.stringify(dinnerTodayOf(eat, ms(iso)));

test("a time set today holds for the rest of today", () => {
  const raw = kept("19:30", "2026-11-02T09:00:00Z"); // 10:00 in Brussels
  assert.equal(dinnerToday(raw, ms("2026-11-02T20:00:00Z")), "19:30");
});

test("the next day starts from the default again", () => {
  const raw = kept("19:30", "2026-11-02T09:00:00Z");
  assert.equal(dinnerToday(raw, ms("2026-11-03T08:00:00Z")), null);
});

test("a dinner after midnight holds until it has come, then the default is back", () => {
  const raw = kept("00:22", "2026-11-02T22:40:00Z"); // set at 23:40 for 00:22
  assert.equal(dinnerToday(raw, ms("2026-11-02T23:10:00Z")), "00:22"); // 00:10, the next Brussels day
  assert.equal(dinnerToday(raw, ms("2026-11-02T23:30:00Z")), null); // 00:30, dinner has come
});

test("the day is Brussels' day, not UTC's", () => {
  const raw = kept("18:00", "2026-11-02T23:30:00Z"); // 00:30 on 03/11 in Brussels
  assert.equal(JSON.parse(raw).day, "2026-11-03");
});

test("nothing kept, junk or a bad time gives the default", () => {
  const now = ms("2026-11-02T12:00:00Z");
  assert.equal(dinnerToday(null, now), null);
  assert.equal(dinnerToday("{not json", now), null);
  assert.equal(dinnerToday("42", now), null);
  assert.equal(dinnerToday(JSON.stringify({ day: "2026-11-02", eat: "7pm", serve: now }), now), null);
});
