// The end: when the last step is done, the offer to log tonight's dinner.

import { h } from "../../dom.js";
import { create } from "../../api.js";
import { statePlate, motionAllowed } from "/static/kp/dist/kp-themes.min.js";
import { t } from "../../i18n/index.js";
import { today } from "../../format.js";
import { actionRow } from "../../ui/cards.js";
import { section } from "./parts.js";

export function buildDone() {
  const doneBtn = h("button", { type: "button", class: "kp-button kp-button--primary kp-button--lg" }, t("cook.logDinner"));
  const doneSays = h("p", { class: "kp-formgrid__value" }, t("cook.logSays"));
  const doneFail = h("div", { class: "kp-alert kp-alert--destructive", role: "alert", hidden: true });
  const doneCard = h("article", { class: "kp-card ck-donecard" }, h("div", { class: "kp-card__body" }, doneFail, h("div", { class: "kp-formgrid" }, actionRow(t("cook.dinnerOut"), [doneBtn], doneSays))));
  const doneSection = section("ck-done", t("cook.secDone"), t("cook.secDoneText"), doneCard);
  doneSection.hidden = true;
  return { doneBtn, doneFail, doneCard, doneSection };
}

/** Log tonight's dinner; a refusal is shown with Try again. @param {import("./index.js").CookCtx} ctx */
async function logDinner(ctx) {
  const { doneBtn, doneFail, doneCard } = ctx.el;
  const recipe = ctx.recipe;
  if (ctx.logging || !recipe) return;
  ctx.logging = true;
  doneBtn.setAttribute("aria-disabled", "true");
  doneFail.hidden = true;
  try {
    await create("log", { dish_id: recipe.dish_id ?? null, recipe_id: recipe.id, date: today(), feeling: null, note: "" });
    if (!ctx.alive) return;
    doneCard.replaceChildren(
      statePlate(document, { kind: "empty", title: t("cook.logged"), text: t("cook.loggedText"), actionLabel: t("shell.openWheel"), onAction: () => ctx.navigate("/") }),
    );
  } catch (e) {
    doneFail.replaceChildren(h("strong", null, t("cook.logFailed")), h("p", null, e instanceof Error ? e.message : String(e)));
    doneFail.hidden = false;
    doneBtn.textContent = t("common.tryAgain");
  } finally {
    ctx.logging = false;
    doneBtn.removeAttribute("aria-disabled");
  }
}

/** @param {import("./index.js").CookCtx} ctx */
export function wireDone(ctx) {
  const { steps, doneSection, doneBtn } = ctx.el;
  steps.addEventListener("kp-focus-steps-empty-action", () => ctx.navigate(`/recipe?id=${encodeURIComponent(ctx.recipeId)}`));
  steps.addEventListener("kp-focus-steps-done", () => {
    doneSection.hidden = false;
    doneSection.scrollIntoView({ block: "nearest", behavior: motionAllowed(doneSection) ? "smooth" : "auto" });
    doneBtn.focus({ preventScroll: true });
  });
  doneBtn.addEventListener("click", () => void logDinner(ctx));
}
