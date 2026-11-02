// Tonight's own dinner time on "When do I start?" (Kenny, 02/11/2026 03:43, feat-timing-today-1): a dinner time
// changed on this page ("Eat at 00:22 instead", a typed dinner or start time) is for today only. The default stays in
// the settings (Calm settings is where it changes); the page never saves a dinner time there any more.
//
// The wheel shows the same dinner time (pages/wheel/model.js).
// One record in this browser's localStorage under one key, so nothing piles up day after day: the time, the Brussels
// day it was set on and the moment it names. It holds on that day, and after midnight until the dinner it names has
// come (00:22 set at 23:40 still holds at 00:10); after that the default is back. The rules are pure
// (scripts/dinner-today.test.mjs); the storage calls never throw (private mode, quota) and say why in the console.

import { today } from "./format.js";
import { at } from "./pages/timing/clock.js";

export const DINNER_TODAY_KEY = "kitchen:dinner-today";

const HH_MM = /^\d{2}:\d{2}$/;

/** @typedef {{ day: string, eat: string, serve: number }} DinnerToday */

/** What is kept for a dinner time set at `now`. @param {string} eat `HH:MM` @param {number} now epoch ms @returns {DinnerToday} */
export function dinnerTodayOf(eat, now) {
  return { day: today(new Date(now)), eat, serve: at(eat, now) };
}

/** The dinner time kept for today, or null when none is kept, it is an earlier day's or it is unreadable. @param {string | null} raw @param {number} now epoch ms @returns {string | null} */
export function dinnerToday(raw, now) {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (!d || typeof d !== "object" || typeof d.eat !== "string" || !HH_MM.test(d.eat)) return null;
    const sameDay = d.day === today(new Date(now));
    const notYet = Number.isFinite(d.serve) && now < d.serve;
    return sameDay || notYet ? d.eat : null;
  } catch {
    return null;
  }
}

/** Keep `eat` as today's dinner time. @param {string} eat `HH:MM` */
export function keepDinnerToday(eat) {
  try {
    localStorage.setItem(DINNER_TODAY_KEY, JSON.stringify(dinnerTodayOf(eat, Date.now())));
  } catch (e) {
    console.warn("Kitchen: today's dinner time could not be kept", e);
  }
}

/** Today's dinner time, or null for the default. */
export function readDinnerToday() {
  try {
    return dinnerToday(localStorage.getItem(DINNER_TODAY_KEY), Date.now());
  } catch (e) {
    console.warn("Kitchen: today's dinner time could not be read", e);
    return null;
  }
}
