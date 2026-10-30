// The cook mode, timeline and timer-disc sections: the markup only, loading from the first frame. The behaviour is in
// timers.js (band, discs), timeline.js and fill.js.

import { h } from "../../dom.js";
import { t } from "../../i18n/index.js";
import { section } from "./parts.js";
import { DIAL_MINUTES } from "./timers.js";

/** The steps, their photos, the running timers and the band that says a timer ended. @param {import("./index.js").CookCtx} ctx */
function buildCookSection(ctx) {
  const band = h("div", { class: "kp-attention", "aria-label": t("cook.needsYou") });
  const steps = h("div", {
    class: "kp-focus-steps",
    id: "ck-steps",
    "data-kp-focus-steps": "",
    "data-kp-focus-steps-timers": "ck-timers",
    "data-kp-focus-steps-wake": "true",
    "data-kp-track-attention": "off",
    "data-kp-state": "loading",
    "data-kp-focus-steps-empty": t("cook.noSteps"),
    "data-kp-focus-steps-empty-action": t("timing.openRecipe"),
    "data-kp-remember": ctx.storeKey,
    "aria-label": t("cook.steps"),
  });
  // The photos of the step in hand, large (Kenny, 24/10/2026 05:23); empty and hidden for a step without any.
  const stepPhotos = h("div", { class: "ck-photos", hidden: true });
  const timers = h("div", {
    class: "kp-timers",
    id: "ck-timers",
    "data-kp-timers": "",
    "data-kp-timers-ring": "60",
    "data-kp-timers-sound": "chime",
    "data-kp-timers-empty": t("cook.noTimer"),
    "aria-label": t("cook.kitchenTimers"),
  });
  // The screen (Kenny, 29/10/2026): the package's steps hold a Screen Wake Lock for the whole of cook mode (asked when the
  // steps are given, asked again when the tab is visible again, let go when the page is left). This badge says so, and only
  // while it holds; the package's own screen line is hidden in favour of it (cook.css).
  const wakeBadge = h("span", { class: "kp-badge kp-badge--success ck-wake", role: "status", hidden: true }, t("cook.screenOn"));
  steps.addEventListener("kp-focus-steps-wake", (e) => {
    wakeBadge.hidden = /** @type {CustomEvent} */ (e).detail?.state !== "on";
  });
  const cook = section(
    "ck-cook",
    t("cook.secCook"),
    t("cook.secCookText"),
    h(
      "div",
      { class: "ck-cook" },
      h("div", { class: "ck-cook__main" }, h("div", { class: "ck-part-row" }, h("h3", { class: "ck-part" }, t("cook.steps")), wakeBadge), band, steps, stepPhotos),
      h("div", { class: "ck-cook__side" }, h("h3", { class: "ck-part" }, t("cook.timersRunning")), h("p", { class: "ck-part-note" }, t("cook.timersNote")), timers),
    ),
  );
  return { band, steps, stepPhotos, timers, cook };
}

/** The timeline's slot, which the timeline fills once it is attached. */
function buildTimelineSection() {
  const timelineSlot = h("div", { class: "ck-timeline__slot", id: "ck-timeline-slot" });
  const timelineCard = h(
    "article",
    { class: "kp-card ck-timelinecard", "data-kp-state": "ready", "aria-label": t("cook.timeline") },
    h("div", { class: "kp-card__stage" }, h("div", { class: "kp-card__data" }, timelineSlot)),
  );
  return { timelineSlot, timelineSection: section("ck-timeline", t("cook.timeline"), t("cook.timelineText"), timelineCard) };
}

/** The timer discs, one per running timer. */
function buildDiscSection() {
  const discs = h("div", { class: "ck-discs" });
  const discCard = h(
    "article",
    { class: "kp-card ck-disccard", "data-kp-state": "loading", "aria-label": t("cook.discsLabel"), "data-kp-loading-words": t("cook.loadingTimers") },
    h("div", { class: "kp-card__stage" }, h("div", { class: "kp-card__data" }, discs)),
  );
  return { discs, discCard, discSection: section("ck-discs", t("cook.secDiscs"), t("cook.secDiscsText", DIAL_MINUTES), discCard) };
}

/** @param {import("./index.js").CookCtx} ctx */
export const buildStage = (ctx) => ({ ...buildCookSection(ctx), ...buildTimelineSection(), ...buildDiscSection() });
