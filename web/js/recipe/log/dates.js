// Day arithmetic of the log's weeks (calendar days as ISO strings, noon UTC so no hour of the year shifts them).

/** @param {string} iso @param {number} by */
export const plus = (iso, by) => new Date(Date.parse(`${iso}T12:00:00Z`) + by * 86_400_000).toISOString().slice(0, 10);

/** The Monday of the week a day is in. @param {string} iso */
export const mondayOf = (iso) => plus(iso, -((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7));

/** The weeks shown, oldest first, each by its Monday. */
export const WEEKS = 4;

/** The Mondays of the weeks shown, ending with this week's. @param {string} now */
export const shownMondays = (now) => {
  const thisMonday = mondayOf(now);
  return Array.from({ length: WEEKS }, (_, i) => plus(thisMonday, (i - WEEKS + 1) * 7));
};
