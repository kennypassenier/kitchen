// The answer column, drawn from the view's state: what the wheel is doing (loading, failed, turning, nothing chosen, a dish),
// the three buttons with the reason they are off, and the dishes that rest. The state is `vs` (the chosen dish, whether the
// wheel is turning and the dishes on it); nothing here is kept.

import { h } from "../../dom.js";
import { openRecordEditor, detailHref } from "../../records/index.js";
import { t } from "../../i18n/index.js";
import { cap, dmyDate } from "../../format.js";
import * as L from "./logic.js";
import { mealLabels, minutesText } from "./labels.js";
import { byId, bigger, dinnerTime, odds } from "./model.js";

/** @typedef {{ chosen: string | null, spinning: boolean, items: string[], part: Record<string, HTMLElement> }} AnswerState */

/** @param {string} text @param {string} [tone] */
export const badgeOf = (text, tone = "") => h("span", { class: `kp-badge${tone ? ` kp-badge--${tone}` : ""}` }, text);

/** @param {HTMLElement} button @param {boolean} off @param {string} why */
function setReason(button, off, why) {
  /** @type {HTMLButtonElement} */ (button).disabled = off;
  button.setAttribute("data-kp-disabled-reason", why);
}

/** The line that counts back from dinner. @param {import("./index.js").WheelCtx} ctx @param {L.Dish} d */
function timingOf(ctx, d) {
  const now = new Date();
  const plan = L.startPlan(dinnerTime(ctx), d.minutes, now.getHours() * 60 + now.getMinutes());
  return plan.ok ? t("wheel.startAt", plan.start, dinnerTime(ctx), minutesText(d.minutes)) : t("wheel.tooSoon", dinnerTime(ctx), plan.ready);
}

/** @param {L.Dish} d */
function lastCooked(d) {
  const kind = L.lastCookedKind(d.days);
  return kind === "never" ? t("wheel.notCooked") : t("wheel.lastCooked", kind === "today" ? t("wheel.today") : kind === "yesterday" ? t("wheel.yesterday") : t("wheel.daysAgo", L.lastCookedDate(d.days), d.days));
}

/** @param {import("./index.js").WheelCtx} ctx */
const oddsLine = (ctx) => ({ equal: t("wheel.oddsEqual"), recency: t("wheel.oddsRecency", L.LONG_DAYS), freezer: t("wheel.oddsFreezer", L.LONG_DAYS) })[/** @type {"equal"} */ (odds(ctx))] ?? "";

/** The kicker, name and facts while the dishes are not there, or the wheel is turning. @param {Record<string, HTMLElement>} part @param {string} kicker @param {string} name @param {string} why */
function paintPlain(part, kicker, name, why) {
  part.kicker.textContent = kicker;
  part.name.textContent = name;
  part.why.textContent = why;
  part.timing.textContent = "";
  part.others.replaceChildren();
}

/** @param {import("./index.js").WheelCtx} ctx @param {AnswerState} vs */
function paintNothingChosen(ctx, vs) {
  const { part, items } = vs;
  part.kicker.textContent = t("wheel.notChosen");
  part.name.textContent = items.length ? t("wheel.pressSpin") : t("wheel.nothingToSpin");
  part.facts.append(badgeOf(t("wheel.onWheel", items.length)));
  part.why.textContent = oddsLine(ctx);
  part.timing.textContent = t("wheel.timingHint");
  part.others.replaceChildren();
}

/** The chosen dish: its facts, why that slice, when to start and its other recipes. @param {import("./index.js").WheelCtx} ctx @param {AnswerState} vs @param {L.Dish} d */
function paintChosen(ctx, vs, d) {
  const { part, items } = vs;
  part.kicker.textContent = items.length === 1 ? t("wheel.onlyOne") : t("wheel.chose");
  part.name.textContent = d.label;
  for (const m of d.meals) part.facts.append(badgeOf(mealLabels()[m] ?? cap(m)));
  part.facts.append(badgeOf(d.recipe ? minutesText(d.minutes) : t("wheel.noRecipeBadge")));
  if (d.safe) part.facts.append(badgeOf(t("wheel.safeFavourite"), "success"));
  if (d.freezer > 0) part.facts.append(badgeOf(t("wheel.freezerPortions", d.freezer), "info"));
  if (d.prep === "none") part.facts.append(badgeOf(t("wheel.kindNoprep"), "success"));
  if (bigger(ctx, d)) part.facts.append(badgeOf(t("wheel.biggerSlice"), "warning"));
  part.why.textContent = `${lastCooked(d)} ${bigger(ctx, d) ? t("wheel.sliceBigger") : odds(ctx) === "equal" ? t("wheel.sliceSame") : t("wheel.sliceSmaller")}`;
  part.timing.textContent = d.recipe ? timingOf(ctx, d) : t("wheel.noRecipeTiming");
  // The dish's other recipes, each straight into cook mode (09:27).
  part.others.replaceChildren(...(d.others.length ? [t("wheel.otherRecipes"), " ", ...d.others.flatMap((o, i) => [i ? " · " : "", h("a", { href: `/cook?id=${encodeURIComponent(o.id)}&fresh=1` }, o.label)])] : []));
}

/** Yes, Again and Skip are on only when they can act; off, they say why. @param {import("./index.js").WheelCtx} ctx @param {AnswerState} vs @param {L.Dish | undefined} d */
function paintButtons(ctx, vs, d) {
  const { part, items, spinning } = vs;
  const loaded = ctx.status === "ready";
  const idle = loaded && !spinning && !ctx.writing;
  const why = (/** @type {string} */ idleWhy) => (!loaded ? t("wheel.dishesLoading") : spinning ? t("wheel.wheelTurning") : ctx.writing ? t("wheel.saving") : idleWhy);
  setReason(part.yes, !d || !idle, why(t("wheel.spinFirst")));
  setReason(part.again, !idle || items.length < 2, why(t("wheel.nothingToSpinWhy")));
  setReason(part.skip, !d || !idle, why(t("wheel.spinFirstSkip")));
  part["skip-says"].textContent = t("wheel.skipSays", dmyDate(L.restUntil()));
}

/** One resting dish: its page, the last day it rests, Edit and Bring back. @param {any} item @param {(item: any, name: string) => void} bringBack @param {import("./index.js").WheelCtx} ctx */
function restingRow(ctx, item, bringBack) {
  const name = byId(ctx, item.dish_id)?.label ?? t("wheel.aDishCap");
  const until = new Date(`${item.until}T12:00:00`);
  const back = h("button", { type: "button", class: "kp-button kp-button--sm", title: t("wheel.bringBackTitle"), "aria-label": t("wheel.bringBackName", name) }, t("wheel.bringBack"));
  back.addEventListener("click", () => bringBack(item, name));
  // Edit changes the last day it rests (Kenny, 24/10/2026 05:07: every item has full CRUD and its own page).
  const edit = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": t("wheel.changeRest", name) }, t("common.edit"));
  edit.addEventListener("click", () => openRecordEditor("resting", item));
  return h(
    "div",
    { class: "wl-rest" },
    h("span", { class: "wl-rest__name" }, h("a", { href: detailHref("resting", item.id) }, name)),
    h("span", { class: "wl-rest__until" }, Number.isNaN(until.getTime()) ? "" : dmyDate(until)),
    h("span", { class: "kp-row-actions" }, edit, back),
  );
}

/** @param {import("./index.js").WheelCtx} ctx @param {AnswerState} vs @param {(item: any, name: string) => void} bringBack */
export function paintAnswer(ctx, vs, bringBack) {
  const { part } = vs;
  const d = vs.chosen ? byId(ctx, vs.chosen) : undefined;
  part.facts.replaceChildren();
  if (ctx.status !== "ready") paintPlain(part, ctx.status === "error" ? t("wheel.failedTitle") : t("wheel.loading"), "", "");
  else if (vs.spinning) paintPlain(part, t("wheel.turning"), "…", t("wheel.holdOn"));
  else if (!d) paintNothingChosen(ctx, vs);
  else paintChosen(ctx, vs, d);
  paintButtons(ctx, vs, d);
  const rest = [...ctx.restItems.values()];
  part.rest.textContent = rest.length ? t("wheel.restingLabelList") : t("wheel.nothingResting");
  part.resting.replaceChildren(...rest.map((item) => restingRow(ctx, item, bringBack)));
}
