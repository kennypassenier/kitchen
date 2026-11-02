// The Brussels wall clock of "When do I start?": a `HH:MM` dinner time as a moment, and a moment as `HH:MM`. Pure: no DOM,
// no words (scripts/timing-clock.test.mjs).

import { ZONE, pad } from "../../format.js";

const HOUR = 3600000;
/** A dinner time that passed longer ago than this is the next day's: 00:22 seen at 23:40 is in 42 minutes, not 23 hours late. */
const LATE_AT_MOST = 12 * HOUR;

const parts = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** @param {number} ms @returns {Record<string, number>} the Brussels wall clock at that moment */
export function wall(ms) {
  return Object.fromEntries(parts.formatToParts(new Date(ms)).filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)]));
}

/** `HH:MM` on the Brussels day of `w` (the day may run over: day + 1 is the next one). @param {Record<string, number>} w @param {number} hh @param {number} mm @param {number} plusDays */
function onDay(w, hh, mm, plusDays) {
  const guess = Date.UTC(w.year, w.month - 1, w.day + plusDays, hh, mm);
  const seen = wall(guess);
  // The guess was read as UTC: move it by what Brussels shows against what was asked.
  return guess - (Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute) - guess);
}

/** @param {string} time `HH:MM` @param {number} [now] @returns {number} that time today in Brussels (tomorrow when today's passed over 12 hours ago), epoch ms */
export function at(time, now = Date.now()) {
  const [hh, mm] = time.split(":").map(Number);
  const w = wall(now);
  const todays = onDay(w, hh, mm, 0);
  return now - todays > LATE_AT_MOST ? onDay(w, hh, mm, 1) : todays;
}

/** @param {number} ms @returns {string} `HH:MM` in Brussels */
export function hm(ms) {
  const w = wall(ms);
  return `${pad(w.hour)}:${pad(w.minute)}`;
}
