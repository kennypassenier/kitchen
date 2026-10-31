// Begin: the card with the recipe's facts, the mise-en-place checklist it opens and the two ways on (everything is out, or
// skip it). Markup first, then the behaviour.

import { h, $ } from "../../dom.js";
import { getChecklistItems, motionAllowed } from "/static/kp/dist/kp-themes.min.js";
import { t } from "../../i18n/index.js";
import { actionRow } from "../../ui/cards.js";
import { section } from "./parts.js";

/** The checklist and the buttons under it. */
function buildMise() {
  const mise = h("div", {
    class: "kp-checklist",
    id: "ck-mise",
    "data-kp-checklist": "",
    "aria-label": t("cook.miseLabel"),
    "data-kp-state": "loading",
    "data-kp-checklist-empty": t("cook.miseEmpty"),
    style: "--kp-checklist-min-rows: 10",
  });
  const startBtn = h("button", { type: "button", class: "kp-button kp-button--primary kp-button--lg", "aria-disabled": "true" }, t("cook.startCooking"));
  const skipBtn = h("button", { type: "button", class: "kp-button kp-button--lg" }, t("cook.skip"));
  const readout = h("p", { class: "kp-formgrid__value", role: "status" }, t("cook.takeOut"));
  const miseOpen = h(
    "div",
    { class: "ck-mise", hidden: true },
    mise,
    h("div", { class: "kp-formgrid" }, actionRow(t("cook.allOut"), [startBtn], readout), actionRow(t("cook.missing"), [skipBtn], t("cook.missingSays"))),
  );
  return { mise, startBtn, skipBtn, readout, miseOpen };
}

/** The Begin card, loading from the first frame, with placeholder rows so it holds its filled height. */
function buildCard() {
  const beginTitle = h("h3", { class: "kp-card__title" }, t("cook.yourRecipe"));
  const facts = h(
    "dl",
    { class: "kp-kv" },
    ...[t("cook.serves"), t("cook.time"), t("cook.dirties")].map((k) => h("div", { class: "kp-kv__row" }, h("dt", null, k), h("dd", null, "—"))),
  );
  const beginBtn = h("button", { type: "button", class: "kp-button kp-button--primary kp-button--lg" }, t("cook.begin"));
  const beginCard = h(
    "article",
    { class: "kp-card ck-begin__card", "data-kp-state": "loading", "aria-labelledby": "ck-begin-t", "data-kp-loading-words": t("cook.loading") },
    h("div", { class: "kp-card__header" }, beginTitle),
    h(
      "div",
      { class: "kp-card__stage" },
      h("div", { class: "kp-card__data" }, h("div", { class: "kp-formgrid" }, facts, actionRow(t("cook.startHere"), [beginBtn], t("cook.startHereSays")))),
    ),
  );
  beginTitle.id = "ck-begin-t";
  return { beginTitle, facts, beginBtn, beginCard };
}

export function buildBegin() {
  const card = buildCard();
  const mise = buildMise();
  const beginSection = section("ck-begin", t("cook.secBegin"), t("cook.secBeginText"), h("div", { class: "ck-begin" }, card.beginCard, mise.miseOpen));
  return { ...card, ...mise, beginSection };
}

/** @param {import("./index.js").CookCtx} ctx */
export function wireBegin(ctx) {
  const { mise, miseOpen, startBtn, skipBtn, beginBtn, readout, cook, steps } = ctx.el;
  const paintStart = () => {
    const items = getChecklistItems(mise);
    const left = items.filter((i) => !i.checked).length;
    const all = items.length > 0 && left === 0;
    startBtn.setAttribute("aria-disabled", String(!all));
    readout.textContent = !items.length ? t("cook.nothingOut") : all ? t("cook.everythingOut") : t("cook.stillOut", left, items.length);
  };
  const openMise = () => {
    if (!miseOpen.hidden || !ctx.recipe) return;
    miseOpen.hidden = false;
    paintStart();
    $(".kp-checklist__check", mise)?.focus();
  };
  beginBtn.addEventListener("click", openMise);
  for (const type of ["kp-checklist-change", "kp-checklist-undo", "kp-checklist-clear", "kp-checklist-render"]) mise.addEventListener(type, paintStart);

  const begin = () => {
    ctx.memo.started = true;
    ctx.keep();
    cook.scrollIntoView({ block: "start", behavior: motionAllowed(cook) ? "smooth" : "auto" });
    steps.focus({ preventScroll: true });
  };
  startBtn.addEventListener("click", () => {
    if (startBtn.getAttribute("aria-disabled") !== "true") begin();
  });
  skipBtn.addEventListener("click", begin);
  ctx.view.paintStart = paintStart;
}
