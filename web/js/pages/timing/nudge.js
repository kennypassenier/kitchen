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

/** @param {import("./index.js").TimingCtx} ctx */
export function createNudge(ctx) {
  const { root, recipeId, navigate, cleanups, state, current } = ctx;
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
    /** @type {import("/static/kp/js/attention.js").AttentionItem[]} */
    const items = [];
    const cook = () => navigate(`/cook?id=${encodeURIComponent(String(ctx.recipe?.id))}`);
    const names = (/** @type {string} */ id) => /** @type {Item[]} */ (ctx.recipe?.tracks ?? []).find((tr) => tr.id === id)?.name ?? id;
    if (state.dropped.size > 0) {
      items.push({
        key: "dropped",
        severity: "info",
        title: t("timing.leftOut", [...state.dropped].map(names).join(", ")),
        text: t("timing.countsWithout", state.eat),
        action: button(t("timing.putBack"), "kp-button--sm", () => {
          state.dropped.clear();
          ctx.view.draw();
        }),
      });
    }
    if (ctx.snoozedUntil !== null) {
      items.push({ key: "snoozed", severity: "info", title: t("timing.remindAt", hm(ctx.snoozedUntil)), text: t("timing.untilThen", hm(p.start)) });
      return items;
    }
    if (toStart > 10 * MIN) return items;
    if (toStart > 0) {
      items.push({
        key: "soon",
        severity: "info",
        title: t("timing.startIn", words(Math.max(1, Math.ceil(toStart / MIN)))),
        text: t("timing.soonText", p.first),
        action: button(t("timing.iAmStarting"), "kp-button--primary kp-button--sm", cook),
      });
      return items;
    }
    if (-toStart < 2 * MIN) {
      items.push({
        key: "now",
        severity: "warning",
        title: t("timing.timeToStart", hm(p.start)),
        text: startsInWords(p),
        action: button(t("timing.startNowBtn"), "kp-button--primary kp-button--sm", cook),
      });
      return items;
    }
    // Past the start: never a reproach, a new dinner time, or one track left out when that is enough.
    const newServe = now + p.total + state.spare * MIN;
    const actions = h("span", { class: "tm-band-actions" }, button(t("timing.eatAt", hm(newServe)), "kp-button--primary kp-button--sm", () => ctx.moveDinner(newServe)));
    /** @type {string[]} */
    const fixers = [];
    if (ctx.recipe && p.lanes.length > 1) {
      for (const lane of p.lanes) {
        const without = planFor(ctx.recipe, { serve: at(state.eat), spare: state.spare, pace: ctx.paceFactor(), dropped: new Set([...state.dropped, lane.id]) });
        if (without && without.lanes.length < p.lanes.length && without.start >= now) fixers.push(lane.id);
      }
    }
    for (const id of fixers.slice(0, 2)) {
      actions.append(
        button(t("timing.keepWithout", state.eat, names(id)), "kp-button--sm", () => {
          state.dropped.add(id);
          ctx.view.draw();
        }),
      );
    }
    items.push({
      key: "late",
      severity: "warning",
      title: t("timing.pastStart", hm(now), words(Math.round(-toStart / MIN))),
      text: `${t("timing.startNowAt", hm(newServe))}${fixers.length ? ` ${t("timing.orKeep", state.eat)}` : ""}`,
      action: actions,
    });
    return items;
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
