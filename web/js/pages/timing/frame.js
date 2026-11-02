// The page frame: every card in its loading state from the first frame, the sections around them, and the one recipe
// picker, which stands in the page header (Kenny, 01/11/2026 20:21, "Eén kiezer": one picker, preselected from tonight's
// wheel answer; the empty state no longer has a button of its own that only scrolled back up to it).

import { h, $ } from "../../dom.js";
import { setCardState, attachCardStates } from "/static/kp/dist/js/card-state.js";
import { attachComboboxes } from "/static/kp/dist/js/combobox.js";
import { t } from "../../i18n/index.js";
import { section as sectionOf, headedCard } from "../../ui/cards.js";

const SEC = { sec: "tm-sec", head: "tm-sec__head" };
/** A card in the shape every data card of this screen has. @param {{ id: string, title: string, text: string, loading: string, mod: string }} o */
const card = ({ id, title, text, loading, mod }) => headedCard({ id, title, text, loading, cls: `tm-card tm-card--${mod}`, dataCls: "tm-data" });
/** A top-level section: heading, one sentence, then its card. @param {string} id @param {string} title @param {string} text @param {HTMLElement} body */
const section = (id, title, text, body) => sectionOf(SEC, id, title, text, body);

/** Every card of the screen, in its loading state. */
function buildCards() {
  return {
    sentenceCard: card({ id: "tm-sentence-card", title: t("timing.sentenceTitle"), text: "", loading: t("timing.loadingSteps"), mod: "sentence" }),
    planCard: card({ id: "tm-plan-card", title: t("timing.planTitle"), text: "", loading: t("timing.loadingPlan"), mod: "plan" }),
    timerCard: card({ id: "tm-timer-card", title: t("timing.timerTitle"), text: "", loading: t("timing.loadingTimer"), mod: "timer" }),
    nudgeCard: card({ id: "tm-nudge-card", title: t("timing.nudgeTitle"), text: "", loading: t("timing.loadingNudge"), mod: "nudge" }),
    nonePlate: card({ id: "tm-none-card", title: t("timing.pickRecipe"), text: t("timing.noneText"), loading: t("timing.loadingRecipes"), mod: "none" }),
  };
}

/** The page header: the title and its sentence, and on the right the one recipe picker with the line that says what it holds. */
function headerOf() {
  return h(
    "header",
    { class: "kp-page-header tm-head" },
    h(
      "div",
      { class: "kp-page-header__inner tm-head__inner" },
      h("div", { class: "tm-head__titles" }, h("h1", { class: "kp-page-header__title" }, t("timing.title")), h("p", { class: "kp-page-header__description" }, t("timing.intro"))),
      pickerBlock(),
    ),
  );
}

/** The sections: the header with the picker, then the recipe's four cards or the plate that asks for a recipe. @param {ReturnType<typeof buildCards>} c @param {string | null} recipeId */
function sectionsOf(c, recipeId) {
  const sections = [headerOf()];
  if (recipeId) {
    sections.push(
      section("tm-sentence", t("timing.secSentence"), t("timing.secSentenceText"), c.sentenceCard),
      section("tm-plan", t("timing.secPlan"), t("timing.secPlanText"), c.planCard),
      section("tm-timer", t("timing.secTimer"), t("timing.secTimerText"), c.timerCard),
      section("tm-nudge", t("timing.secNudge"), t("timing.secNudgeText"), c.nudgeCard),
    );
  } else {
    sections.push(section("tm-none", t("timing.secNone"), t("timing.secNoneText"), c.nonePlate));
  }
  return sections;
}

/** The recipe picker: its label, the kit's combobox (disabled until the recipes are read), the line that says what it holds
 * and the link to the recipe. One grid: label over the field, the line and the link on one row under it. */
function pickerBlock() {
  return h(
    "div",
    { class: "kp-page-header__actions tm-picker" },
    h("label", { class: "tm-picker__label", for: "tm-recipe" }, t("timing.recipe")),
    h(
      "div",
      { class: "kp-combobox tm-picker__box", "data-kp-combobox": "", "data-kp-match": "substring" },
      h("input", { class: "kp-combobox__input", type: "text", role: "combobox", id: "tm-recipe", "aria-expanded": "false", "aria-controls": "tm-recipe-list", placeholder: t("timing.searchRecipes"), disabled: true, "aria-describedby": "tm-pick-said" }),
      h("ul", { class: "kp-combobox__list", id: "tm-recipe-list", role: "listbox", hidden: true }),
      h("p", { class: "kp-combobox__status", "data-kp-combobox-status": "", role: "status", "aria-live": "polite" }),
    ),
    h("p", { class: "tm-picker__said", id: "tm-pick-said", role: "status" }, t("timing.loadingRecipesDot")),
    h("div", { class: "tm-picker__actions", id: "tm-pick-actions" }),
  );
}

/** The page frame: every card in its loading state from the first frame, and the picker (always there). @param {{ root: HTMLElement, recipeId: string | null, cleanups: (() => void)[] }} ctx */
export function buildFrame({ root, recipeId, cleanups }) {
  const cards = buildCards();
  root.replaceChildren(...sectionsOf(cards, recipeId));
  for (const c of root.querySelectorAll(".kp-card")) setCardState(/** @type {HTMLElement} */ (c), "loading");
  cleanups.push(attachCardStates(root));
  const picker = /** @type {HTMLElement} */ ($(".tm-picker", root));
  const box = /** @type {HTMLElement} */ ($(".kp-combobox", picker));
  cleanups.push(attachComboboxes(picker));
  return { ...cards, box };
}
