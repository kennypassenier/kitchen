// Drawing the log: the weeks as a heat grid, the heading of the chosen day and the buttons that fit it.

import { setHeat } from "/static/kp/js/heat.js";
import { attachSegmented, setSegmentedValues } from "/static/kp/js/segmented.js";
import { today, dmy } from "../../format.js";
import { h } from "../../dom.js";
import { plus, shownMondays } from "./dates.js";

/**
 * @typedef {object} LogState
 * @property {import("../words.js").Words | null} words
 * @property {import("../../api.js").Kitchen | null} kitchen
 * @property {{ day: string, started: boolean }} view
 * @property {string} feeling
 * @property {Map<string, Record<string, any>>} entries Entries of this recipe by day.
 * @property {ReturnType<typeof import("./frame.js").buildLogDom>} el
 * @property {MediaQueryList} narrow
 */

/** The long date of a day, in the language of the page. @param {LogState} s @param {string} iso */
const longDate = (s, iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(s.words?.loc ?? "en-GB", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

/** One day's cell: future, cooked (with the feeling) or quiet. @param {LogState} s @param {string} iso @param {string} now */
function cellOf(s, iso, now) {
  const words = /** @type {import("../words.js").Words} */ (s.words);
  const entry = s.entries.get(iso);
  if (iso > now) return { tone: /** @type {const} */ ("future"), label: words.notYet };
  if (entry) {
    const felt = entry.feeling ? /** @type {Record<string, string>} */ (words.felt)[entry.feeling] : "";
    return {
      tone: /** @type {const} */ ("logged"),
      label: [words.cooked, felt].filter(Boolean).join(", "),
      tip: `${dmy(iso)}: ${[words.cooked, felt].filter(Boolean).join(" · ")}`,
    };
  }
  return { tone: /** @type {const} */ ("quiet"), label: words.notLogged, tip: `${dmy(iso)}, ${words.notLogged}` };
}

/** The feeling choices. @param {LogState} s */
export function drawFeelings(s) {
  if (!s.words) return;
  s.el.feel.replaceChildren(
    ...s.words.feelings.map(([value, label]) =>
      h("button", { type: "button", class: "kp-segmented__item", "data-value": value, role: "radio", "aria-checked": String(value === s.feeling) }, h("span", { class: "kp-segmented__label" }, label)),
    ),
  );
  attachSegmented(s.el.feel);
}

/** The heat grid of the weeks shown. @param {LogState} s @param {string} now */
function drawGrid(s, now) {
  const words = /** @type {import("../words.js").Words} */ (s.words);
  s.el.grid.setAttribute("aria-label", words.logTitle);
  setHeat(s.el.grid, {
    columns: words.days.map((label, i) => ({ key: String(i), label: s.narrow.matches ? label.slice(0, 2) : label })),
    every: 1,
    rows: shownMondays(now).map((monday, r) => ({
      key: monday,
      label: words.weekRows[r],
      cells: words.days.map((_, i) => cellOf(s, plus(monday, i), now)),
    })),
  });
}

/** Everything the log shows for the chosen day. @param {LogState} s */
export function paint(s) {
  if (!s.words || !s.kitchen) return;
  const { words, el } = s;
  const now = today();
  drawGrid(s, now);
  el.note.textContent = s.entries.size === 0 ? words.quiet : words.legendLine;
  el.heading.textContent = s.view.day === now ? words.logToday(longDate(s, s.view.day)) : words.logDay(longDate(s, s.view.day));
  el.sentence.textContent = words.logOptional;
  el.feelingLabel.textContent = words.feelingLabel;
  const entry = s.entries.get(s.view.day);
  el.add.hidden = Boolean(entry);
  el.change.hidden = el.drop.hidden = !entry;
  el.feel.setAttribute("aria-label", words.feelingLabel);
  if (el.feel.childElementCount === 0) drawFeelings(s);
  const shown = entry?.feeling ?? "none";
  if (entry && s.feeling !== shown) {
    s.feeling = shown;
    setSegmentedValues(el.feel, [shown]);
  }
}
