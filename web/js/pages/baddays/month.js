// Part 5: when things went in, the freezer's days on the package's calendar.

import { setCalendarState, setCalendarDays, setCalendarLegend, calendarMonth, dayKey } from "/static/kp/js/calendar.js";
import { $ } from "../../dom.js";
import { t, textOf } from "../../i18n/index.js";
import { frozenAt } from "./helpers.js";

/** @typedef {import("../../api.js").Kitchen} Kitchen */

const LEGEND = [
  { tone: "logged", label: t("bad.legendLogged") },
  { tone: "quiet", label: t("bad.legendQuiet") },
  { tone: "paused", label: t("bad.legendAway") },
];

/** The days things went into the freezer, with what went in. @param {Kitchen} k */
function monthDays(k) {
  /** @type {Record<string, { dishes: string[] }>} */
  const byDay = {};
  for (const f of k.freezer) {
    const key = dayKey(frozenAt(f));
    (byDay[key] ??= { dishes: [] }).dishes.push(textOf(f.dish));
  }
  /** @type {Record<string, import("/static/kp/js/calendar.js").CalendarDay>} */
  const out = {};
  for (const [key, { dishes }] of Object.entries(byDay)) {
    out[key] = {
      tone: "logged",
      count: String(dishes.length),
      label: t("bad.wentIn", dishes.length, dishes.join(", ")),
    };
  }
  return out;
}

/** @typedef {{ ctx: import("./index.js").BadDaysCtx, cal: HTMLElement, latest: Kitchen | null, shown: string }} MonthState shown is the month on show as "YYYY-MM". */

/** Empty says so when the month on show has nothing in it. @param {MonthState} m */
function paintMonth(m) {
  if (!m.latest) return;
  const days = monthDays(m.latest);
  const any = Object.keys(days).some((d) => d.startsWith(m.shown));
  setCalendarDays(m.cal, days);
  if (any) setCalendarState(m.cal, "ready");
  else setCalendarState(m.cal, "empty", t("bad.monthEmpty"));
}

/** @param {MonthState} m @param {Kitchen} k */
function renderMonth(m, k) {
  const { drawn } = m.ctx;
  const signature = JSON.stringify(k.freezer.map((f) => [f.id, textOf(f.dish), f.frozen_on]));
  if (signature === drawn.month) return;
  const first = drawn.month === null;
  drawn.month = signature;
  m.latest = k;
  if (first) {
    const [year, month] = dayKey(Date.now()).split("-").map(Number);
    calendarMonth(m.cal, { year, month });
    setCalendarLegend(m.cal, /** @type {any} */ (LEGEND));
  }
  paintMonth(m);
}

/** @param {import("./index.js").BadDaysCtx} ctx */
export function createMonth(ctx) {
  /** @type {MonthState} */
  const m = { ctx, cal: /** @type {HTMLElement} */ ($("#bd-cal", ctx.page)), latest: null, shown: dayKey(Date.now()).slice(0, 7) };
  m.cal.addEventListener("kp-calendar-month", (event) => {
    const { year, month } = /** @type {CustomEvent} */ (event).detail;
    m.shown = `${year}-${String(month).padStart(2, "0")}`;
    paintMonth(m);
  });
  m.cal.addEventListener("kp-calendar-retry", ctx.reload);
  return {
    render: (/** @type {Kitchen} */ k) => renderMonth(m, k),
    loading: () => setCalendarState(m.cal, "loading", t("bad.loadingMonth")),
    failed: () => setCalendarState(m.cal, "error", `${t("bad.monthFailed")} ${t("bad.nothingChanged")}`),
  };
}
