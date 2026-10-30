// The nudge: the attention band that says when to start, what to do when the start has passed, and "not yet".

import { h, $ } from "../../dom.js";
import { setAttention, attachAttention } from "/static/kp/js/attention.js";
import { attachSnoozes, setSnoozedUntil } from "/static/kp/js/snooze.js";
import { t } from "../../i18n/index.js";
import { ZONE } from "../../format.js";
import { button } from "../../ui/cards.js";
import { MIN, hm, at, planFor } from "./plan.js";
import { words, startsInWords } from "./text.js";

/** @typedef {import("../../api.js").Item} Item */

/** A track's name for the sentences. @param {import("./index.js").TimingCtx} ctx @param {string} id */
const trackName = (ctx, id) => /** @type {Item[]} */ (ctx.recipe?.tracks ?? []).find((tr) => tr.id === id)?.name ?? id;

/** Open the cook mode of the recipe. @param {import("./index.js").TimingCtx} ctx */
const cookIt = (ctx) => () => ctx.navigate(`/cook?id=${encodeURIComponent(String(ctx.recipe?.id))}`);

/** The tracks left out, with the button that puts them back. @param {import("./index.js").TimingCtx} ctx @returns {import("/static/kp/js/attention.js").AttentionItem[]} */
function droppedItems(ctx) {
  const { state } = ctx;
  if (state.dropped.size === 0) return [];
  return [
    {
      key: "dropped",
      severity: "info",
      title: t("timing.leftOut", [...state.dropped].map((id) => trackName(ctx, id)).join(", ")),
      text: t("timing.countsWithout", state.eat),
      action: button(t("timing.putBack"), "kp-button--sm", () => {
        state.dropped.clear();
        ctx.view.draw();
      }),
    },
  ];
}

/** Within ten minutes of the start. @param {import("./index.js").TimingCtx} ctx @param {import("./plan.js").Plan} p @param {number} toStart */
const soonItem = (ctx, p, toStart) => ({
  key: "soon",
  severity: /** @type {const} */ ("info"),
  title: t("timing.startIn", words(Math.max(1, Math.ceil(toStart / MIN)))),
  text: t("timing.soonText", p.first),
  action: button(t("timing.iAmStarting"), "kp-button--primary kp-button--sm", cookIt(ctx)),
});

/** The start is now (less than two minutes ago). @param {import("./index.js").TimingCtx} ctx @param {import("./plan.js").Plan} p */
const nowItem = (ctx, p) => ({
  key: "now",
  severity: /** @type {const} */ ("warning"),
  title: t("timing.timeToStart", hm(p.start)),
  text: startsInWords(p),
  action: button(t("timing.startNowBtn"), "kp-button--primary kp-button--sm", cookIt(ctx)),
});

/** The tracks that, left out, would still make dinner (the first two are offered). @param {import("./index.js").TimingCtx} ctx @param {import("./plan.js").Plan} p @param {number} now */
function trackFixers(ctx, p, now) {
  const { state } = ctx;
  /** @type {string[]} */
  const fixers = [];
  if (!ctx.recipe || p.lanes.length <= 1) return fixers;
  for (const lane of p.lanes) {
    const without = planFor(ctx.recipe, { serve: at(state.eat), spare: state.spare, pace: ctx.paceFactor(), dropped: new Set([...state.dropped, lane.id]) });
    if (without && without.lanes.length < p.lanes.length && without.start >= now) fixers.push(lane.id);
  }
  return fixers;
}

/** Past the start: never a reproach, a new dinner time, or one track left out when that is enough. @param {import("./index.js").TimingCtx} ctx @param {import("./plan.js").Plan} p @param {number} now */
function lateItem(ctx, p, now) {
  const { state } = ctx;
  const toStart = p.start - now;
  const newServe = now + p.total + state.spare * MIN;
  const actions = h("span", { class: "tm-band-actions" }, button(t("timing.eatAt", hm(newServe)), "kp-button--primary kp-button--sm", () => ctx.moveDinner(newServe)));
  const fixers = trackFixers(ctx, p, now);
  for (const id of fixers.slice(0, 2)) {
    actions.append(
      button(t("timing.keepWithout", state.eat, trackName(ctx, id)), "kp-button--sm", () => {
        state.dropped.add(id);
        ctx.view.draw();
      }),
    );
  }
  return {
    key: "late",
    severity: /** @type {const} */ ("warning"),
    title: t("timing.pastStart", hm(now), words(Math.round(-toStart / MIN))),
    text: `${t("timing.startNowAt", hm(newServe))}${fixers.length ? ` ${t("timing.orKeep", state.eat)}` : ""}`,
    action: actions,
  };
}

/** @param {import("./index.js").TimingCtx} ctx */
export function createNudge(ctx) {
  const { root, recipeId, cleanups, state, current } = ctx;
  /** @type {(() => void) | null} */
  let snoozeDetach = null;
  // ---- the nudge's frame ----------------------------------------------------------------------------------------
  const band = h("div", { class: "kp-attention", id: "tm-band", "aria-label": t("timing.needsYou") });
  const quiet = h("p", { class: "tm-readout", id: "tm-nudge-quiet", role: "status" });
  const snoozeSlot = h("div", { id: "tm-snooze-slot" });
  const snoozeBox = h("div", { class: "tm-nudge-snooze" }, h("p", { class: "tm-label", id: "tm-snooze-label" }, t("timing.remindIn")), snoozeSlot);
  if (recipeId) {
    /** @type {HTMLElement} */ ($("#tm-nudge-card-data", root)).append(band, quiet, snoozeBox);
    cleanups.push(attachAttention(root));
  }

  /** @returns {import("/static/kp/js/attention.js").AttentionItem[]} */
  function nudgeItems() {
    const p = current();
    if (!p || !ctx.recipe) return [];
    const now = Date.now();
    const toStart = p.start - now;
    const items = droppedItems(ctx);
    if (ctx.snoozedUntil !== null) return [...items, { key: "snoozed", severity: "info", title: t("timing.remindAt", hm(ctx.snoozedUntil)), text: t("timing.untilThen", hm(p.start)) }];
    if (toStart > 10 * MIN) return items;
    if (toStart > 0) return [...items, soonItem(ctx, p, toStart)];
    if (-toStart < 2 * MIN) return [...items, nowItem(ctx, p)];
    return [...items, lateItem(ctx, p, now)];
  }

  function drawNudge() {
    const p = current();
    if (!p) return;
    if (ctx.snoozedUntil !== null && Date.now() >= ctx.snoozedUntil) ctx.snoozedUntil = null;
    /** @type {HTMLElement} */ ($("#tm-nudge-card-t", root)).textContent = t("timing.nudgeHead", ctx.recipe?.name, state.eat);
    /** @type {HTMLElement} */ ($("#tm-nudge-card-body", root)).textContent = t("timing.startIsNow", hm(p.start), hm(Date.now()));
    const list = nudgeItems();
    setAttention(band, list);
    const early = p.start - Date.now() > 10 * MIN;
    quiet.textContent = list.length === 0 ? t("timing.nothingYet", hm(p.start)) : "";
    // Not yet is for a nudge that can wait: not past the start, and only while there is a nudge to put off.
    const waitable = !early && p.start - Date.now() > -2 * MIN && list.some((i) => i.key === "soon" || i.key === "now" || i.key === "snoozed");
    snoozeBox.hidden = !waitable;
    if (waitable && !snoozeDetach) buildSnooze();
    if (!waitable && snoozeDetach) {
      snoozeDetach();
      snoozeDetach = null;
      snoozeSlot.replaceChildren();
    }
  }

  function buildSnooze() {
    snoozeSlot.innerHTML = `<div class="kp-snooze" data-kp-snooze data-kp-snooze-choices="5m 10m pick" data-kp-snooze-max="1h" data-kp-look="chips" data-kp-time-zone="${ZONE}"></div>`;
    snoozeDetach = attachSnoozes(snoozeSlot);
    const el = /** @type {HTMLElement} */ (snoozeSlot.firstElementChild);
    el.addEventListener("kp-snooze", (event) => {
      ctx.snoozedUntil = new Date(/** @type {CustomEvent} */ (event).detail.until).getTime();
      ctx.view.drawNudge();
    });
    el.addEventListener("kp-snooze-end", () => {
      ctx.snoozedUntil = null;
      ctx.view.drawNudge();
    });
    if (ctx.snoozedUntil !== null) setSnoozedUntil(el, new Date(ctx.snoozedUntil).toISOString());
  }
  return { draw: drawNudge, detach: () => snoozeDetach?.() };
}
