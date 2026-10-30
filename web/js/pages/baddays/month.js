// Part 5: when things went in, the freezer's days on the package's calendar.

import { setCalendarState, setCalendarDays, setCalendarLegend, calendarMonth, dayKey } from "/static/kp/js/calendar.js";
import { $ } from "../../dom.js";
import { t, textOf } from "../../i18n/index.js";
import { frozenAt } from "./helpers.js";

/** @typedef {import("../../api.js").Kitchen} Kitchen */

/** @param {import("./index.js").BadDaysCtx} ctx */
export function createMonth(ctx) {
  const { page, drawn } = ctx;
  const cal = /** @type {HTMLElement} */ ($("#bd-cal", page));
  /** @type {Kitchen | null} */
  let latest = null;
  const legend = [
    { tone: "logged", label: t("bad.legendLogged") },
    { tone: "quiet", label: t("bad.legendQuiet") },
    { tone: "paused", label: t("bad.legendAway") },
  ];

  /** @param {Kitchen} k */
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

  /** The month on show as "YYYY-MM". */
  let shown = dayKey(Date.now()).slice(0, 7);

  /** Empty says so when the month on show has nothing in it. */
  function paintMonth() {
    if (!latest) return;
    const days = monthDays(latest);
    const any = Object.keys(days).some((d) => d.startsWith(shown));
    setCalendarDays(cal, days);
    if (any) setCalendarState(cal, "ready");
    else setCalendarState(cal, "empty", t("bad.monthEmpty"));
  }

  /** @param {Kitchen} k */
  function renderMonth(k) {
    const signature = JSON.stringify(k.freezer.map((f) => [f.id, textOf(f.dish), f.frozen_on]));
    if (signature === drawn.month) return;
    const first = drawn.month === null;
    drawn.month = signature;
    latest = k;
    if (first) {
      const [year, month] = dayKey(Date.now()).split("-").map(Number);
      calendarMonth(cal, { year, month });
      setCalendarLegend(cal, /** @type {any} */ (legend));
    }
    paintMonth();
  }
  cal.addEventListener("kp-calendar-month", (event) => {
    const { year, month } = /** @type {CustomEvent} */ (event).detail;
    shown = `${year}-${String(month).padStart(2, "0")}`;
    paintMonth();
  });
  cal.addEventListener("kp-calendar-retry", ctx.reload);
  return {
    render: renderMonth,
    loading: () => setCalendarState(cal, "loading", t("bad.loadingMonth")),
    failed: () => setCalendarState(cal, "error", `${t("bad.monthFailed")} ${t("bad.nothingChanged")}`),
  };
}
