// The cooking log of one recipe: a heat grid of weeks, and the form that adds
// a day to it. A quiet day is a pale plate and nothing else (heat's calm
// tones): no count, no streak, never "missed".

import { setHeat, attachHeats } from "/static/kp/js/heat.js";
import { attachSegmented, getSegmentedValues, setSegmentedValues } from "/static/kp/js/segmented.js";
import { attachFlashButtons, runFlashButton } from "/static/kp/js/flash.js";
import { undoToast } from "/static/kp/js/undo-toast.js";
import { setCardState } from "/static/kp/js/card-state.js";
import { create, remove, replace, reason } from "../api.js";
import { today, dmy } from "../format.js";
import { h } from "../dom.js";

/** @param {string} iso @param {number} by */
const plus = (iso, by) => new Date(Date.parse(`${iso}T12:00:00Z`) + by * 86_400_000).toISOString().slice(0, 10);

/** The Monday of the week a day is in. @param {string} iso */
const mondayOf = (iso) => plus(iso, -((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7));

/** The weeks shown, oldest first, each by its Monday. */
const WEEKS = 4;

/** @param {unknown} error @param {import("./words.js").Words} words */
const refusal = (error, words) => ({
  error: reason(error),
  word: words.notSaved,
});

/**
 * Build the log into its card (a `.kp-card[data-kp-state]` with a stage).
 * @param {HTMLElement} card
 * @param {{ recipeId: string, retry: () => void }} options
 */
export function createLog(card, { recipeId, retry }) {
  const data = /** @type {HTMLElement} */ (card.querySelector(".kp-card__data"));
  const narrow = matchMedia("(max-width: 36rem)");
  /** @type {import("./words.js").Words | null} */
  let words = null;
  /** @type {import("../api.js").Kitchen | null} */
  let kitchen = null;
  const view = { day: today(), started: false };
  let feeling = "none";
  /** Entries of this recipe by day. @type {Map<string, Record<string, any>>} */
  let entries = new Map();

  const grid = h("div", { class: "kp-heat rp-log__grid", "data-kp-heat": true, "data-kp-tones": "calm", "aria-label": "" });
  const note = h("p", { class: "rp-log__note" });
  const heading = h("h3", { class: "kp-fw-semibold", id: "rp-log-day" });
  const sentence = h("p", { class: "rp-log__hint" });
  const feelingLabel = h("span", { class: "kp-formgrid__label", id: "rp-log-feeling-label" });
  const feel = h("div", { class: "kp-segmented", "data-kp-segmented": "single", role: "radiogroup", "aria-labelledby": "rp-log-feeling-label" });
  const add = h("button", { type: "button", class: "kp-button kp-button--primary", "data-kp-flash-button": true });
  const change = h("button", { type: "button", class: "kp-button", "data-kp-flash-button": true });
  const drop = h("button", { type: "button", class: "kp-button kp-button--ghost" });

  data.replaceChildren(
    h(
      "div",
      { class: "rp-log" },
      h(
        "div",
        { class: "rp-log__add" },
        heading,
        sentence,
        h(
          "div",
          { class: "kp-formgrid", "aria-labelledby": "rp-log-day" },
          h("div", { class: "kp-formgrid__row" }, feelingLabel, h("div", { class: "kp-formgrid__control" }, feel)),
          h("div", { class: "kp-formgrid__row kp-formgrid__row--buttons" }, h("div", { class: "kp-formgrid__control" }, h("div", { class: "kp-formgrid__buttons" }, add, change, drop))),
        ),
      ),
      grid,
      note,
    ),
  );
  attachHeats(data);

  /** The long date of a day, in the language of the page. @param {string} iso */
  const longDate = (iso) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(words?.loc ?? "en-GB", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

  const drawFeelings = () => {
    if (!words) return;
    feel.replaceChildren(
      ...words.feelings.map(([value, label]) =>
        h("button", { type: "button", class: "kp-segmented__item", "data-value": value, role: "radio", "aria-checked": String(value === feeling) }, h("span", { class: "kp-segmented__label" }, label)),
      ),
    );
    attachSegmented(feel);
  };

  const paint = () => {
    if (!words || !kitchen) return;
    const today = today();
    const thisMonday = mondayOf(today);
    const mondays = Array.from({ length: WEEKS }, (_, i) => plus(thisMonday, (i - WEEKS + 1) * 7));
    grid.setAttribute("aria-label", words.logTitle);
    setHeat(grid, {
      columns: words.days.map((label, i) => ({ key: String(i), label: narrow.matches ? label.slice(0, 2) : label })),
      every: 1,
      rows: mondays.map((monday, r) => ({
        key: monday,
        label: words?.weekRows[r],
        cells: words?.days.map((_, i) => {
          const iso = plus(monday, i);
          const entry = entries.get(iso);
          if (iso > today) return { tone: /** @type {const} */ ("future"), label: words?.notYet };
          if (entry) {
            const felt = entry.feeling ? /** @type {Record<string, string>} */ (words?.felt)[entry.feeling] : "";
            return {
              tone: /** @type {const} */ ("logged"),
              label: [words?.cooked, felt].filter(Boolean).join(", "),
              tip: `${dmy(iso)}: ${[words?.cooked, felt].filter(Boolean).join(" · ")}`,
            };
          }
          return { tone: /** @type {const} */ ("quiet"), label: words?.notLogged, tip: `${dmy(iso)}, ${words?.notLogged}` };
        }) ?? [],
      })),
    });
    note.textContent = entries.size === 0 ? words.quiet : words.legendLine;
    heading.textContent = view.day === today ? words.logToday(longDate(view.day)) : words.logDay(longDate(view.day));
    sentence.textContent = words.logOptional;
    feelingLabel.textContent = words.feelingLabel;
    const entry = entries.get(view.day);
    add.hidden = Boolean(entry);
    change.hidden = drop.hidden = !entry;
    feel.setAttribute("aria-label", words.feelingLabel);
    if (feel.childElementCount === 0) drawFeelings();
    const shown = entry?.feeling ?? "none";
    if (entry && feeling !== shown) {
      feeling = shown;
      setSegmentedValues(feel, [shown]);
    }
  };

  /** Word the flash buttons once; they keep these faces. */
  const wireWords = () => {
    if (!words) return;
    for (const [button, label, done] of /** @type {const} */ ([[add, words.add, words.added], [change, words.change, words.changed]])) {
      if (button.dataset.kpFlashWired) continue;
      button.dataset.kpFlashWired = "1";
      button.setAttribute("data-kp-flash-words", done);
      button.textContent = label;
    }
    drop.textContent = words.removeEntry;
    attachFlashButtons(data);
  };

  feel.addEventListener("kp-segmented-change", (event) => {
    feeling = /** @type {CustomEvent} */ (event).detail.value ?? getSegmentedValues(feel)[0] ?? "none";
  });
  grid.addEventListener("kp-heat-pick", (event) => {
    const { rowKey, colKey, picked } = /** @type {CustomEvent} */ (event).detail;
    const day = plus(String(rowKey), Number(colKey));
    view.day = picked && day <= today() ? day : today();
    paint();
  });
  narrow.addEventListener("change", paint);

  const item = () => ({ dish_id: kitchen?.recipes.find((r) => r.id === recipeId)?.dish_id ?? null, recipe_id: recipeId, date: view.day, feeling: feeling === "none" ? null : feeling, note: "" });
  add.addEventListener("click", () => {
    void runFlashButton(add, async () => {
      try {
        await create("log", item());
        return words?.added;
      } catch (e) {
        return refusal(e, /** @type {import("./words.js").Words} */ (words));
      }
    });
  });
  change.addEventListener("click", () => {
    const entry = entries.get(view.day);
    if (!entry) return;
    void runFlashButton(change, async () => {
      try {
        await replace("log", { ...entry, feeling: feeling === "none" ? null : feeling });
        return words?.changed;
      } catch (e) {
        return refusal(e, /** @type {import("./words.js").Words} */ (words));
      }
    });
  });
  drop.addEventListener("click", () => {
    const entry = entries.get(view.day);
    if (!entry) return;
    void remove("log", entry.id).then(
      (gone) => {
        undoToast(words?.entryRemoved ?? "", {
          mode: "revert",
          undo: async () => {
            const { id: _old, ...rest } = gone;
            await create("log", rest);
          },
        });
      },
      (e) => undoToast(`${words?.notSaved}: ${e instanceof Error ? e.message : e}`, { ms: 0 }),
    );
  });
  card.addEventListener("kp-card-retry", retry);

  return {
    /** Loading, from the first frame. @param {import("./words.js").Words} w */
    loading(w) {
      words = w;
      setCardState(card, "loading", { words: w.logLoading });
      grid.hidden = false;
      // The grid itself loads with the package's busy card over its weeks, not as a blank (kp measure-states, 24/10/2026).
      setHeat(grid, { state: "loading", message: w.logLoading, skeleton: { rows: WEEKS, columns: 7 } });
    },
    /** @param {import("./words.js").Words} w @param {string} why */
    failed(w, why) {
      words = w;
      setCardState(card, "error", { title: w.logFailedTitle, text: w.logFailedText(why) });
    },
    /** Draw the entries of this recipe. @param {import("../api.js").Kitchen} k @param {import("./words.js").Words} w */
    show(k, w) {
      const first = words !== w;
      words = w;
      kitchen = k;
      entries = new Map();
      for (const e of k.log) if (e.recipe_id === recipeId && !entries.has(e.date)) entries.set(e.date, e);
      wireWords();
      if (first) drawFeelings();
      if (entries.size === 0 && !view.started) {
        const start = h("button", { type: "button", class: "kp-button kp-button--primary" }, w.logStart);
        start.addEventListener("click", () => {
          view.started = true;
          this.show(k, w);
        });
        // Under the card's empty plate the grid is not drawn at all: a grid kept behind the plate could be put in a state
        // (loading, by a measure) that nobody can see.
        grid.hidden = true;
        setCardState(card, "empty", { title: w.logEmptyTitle, text: w.logEmptyText, action: start });
        return;
      }
      view.started = true;
      grid.hidden = false;
      paint();
      setCardState(card, "ready");
    },
  };
}
