// The small formatters every screen shares: Brussels time and dates, padding, capitals. One copy here
// instead of one per page (docs/agent/MODULARITY.md, 30/10/2026); pure functions, no DOM, nothing
// that needs the browser, so node tests can import it (`minutesWords`, which reads the words, is in i18n/minutes.js).

/** The kitchen's time zone: every day and clock time the app shows is Brussels time. */
export const ZONE = "Europe/Brussels";

/** @param {number} n */
export const pad = (n) => String(n).padStart(2, "0");

/** Minutes after midnight as `HH:MM`. @param {number} m */
export const hhmm = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

/** The day it is in Brussels, as YYYY-MM-DD. @param {Date} [now] */
export const today = (now = new Date()) => now.toLocaleDateString("en-CA", { timeZone: ZONE });

/** The YYYY-MM-DD in Brussels of an ISO datetime. @param {string} iso */
export const brusselsDay = (iso) => today(new Date(iso));

/** dd/mm/yyyy of an ISO date or datetime ("" for none). @param {string} iso */
export const dmy = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

/** dd/mm/yyyy of a Date, on the device's own calendar day. @param {Date} d */
export const dmyDate = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

/** YYYY-MM-DD of a Date, on the device's own calendar day. @param {Date} d */
export const localIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "put the pasta water on" becomes "Put the pasta water on" (an empty value stays as it is). @param {string} s */
export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** A stored time as the screens show it: dd/mm/yyyy HH:mm, Europe/Brussels. @param {string} iso */
export function stamp(iso) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso)).filter((x) => x.type !== "literal").map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}
