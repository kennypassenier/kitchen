// The page frame: every card in its loading state from the first frame, the sections around them and the recipe picker.

import { h, $ } from "../../dom.js";
import { setCardState, attachCardStates, attachComboboxes } from "/static/kp/dist/kp-themes.min.js";
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
    pickCard: card({ id: "tm-pick-card", title: t("timing.pickTitle"), text: t("timing.pickText"), loading: t("timing.loadingRecipes"), mod: "pick" }),
    sentenceCard: card({ id: "tm-sentence-card", title: t("timing.sentenceTitle"), text: "", loading: t("timing.loadingSteps"), mod: "sentence" }),
    planCard: card({ id: "tm-plan-card", title: t("timing.planTitle"), text: "", loading: t("timing.loadingPlan"), mod: "plan" }),
    timerCard: card({ id: "tm-timer-card", title: t("timing.timerTitle"), text: "", loading: t("timing.loadingTimer"), mod: "timer" }),
    nudgeCard: card({ id: "tm-nudge-card", title: t("timing.nudgeTitle"), text: "", loading: t("timing.loadingNudge"), mod: "nudge" }),
    nonePlate: card({ id: "tm-none-card", title: t("timing.pickRecipe"), text: t("timing.noneText"), loading: t("timing.loadingRecipes"), mod: "none" }),
  };
}

/** The sections: the intro, the picker, then the recipe's four cards or the plate that asks for a recipe. @param {ReturnType<typeof buildCards>} c @param {string | null} recipeId */
function sectionsOf(c, recipeId) {
  const sections = [
    h("header", { class: "tm-intro" }, h("h1", null, t("timing.title")), h("p", null, t("timing.intro"))),
    section("tm-pick", t("timing.secPick"), t("timing.secPickText"), c.pickCard),
  ];
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

/** The recipe picker's form row. */
function pickerRow() {
  return h(
    "div",
    { class: "kp-formgrid", "data-kp-formgrid-lines": "lines" },
    h(
      "div",
      { class: "kp-formgrid__row" },
      h("label", { class: "kp-formgrid__label", for: "tm-recipe" }, t("timing.recipe")),
      h(
        "div",
        { class: "kp-formgrid__control" },
        h(
          "div",
          { class: "kp-combobox", "data-kp-combobox": "", "data-kp-match": "substring" },
          h("input", { class: "kp-combobox__input", type: "text", role: "combobox", id: "tm-recipe", "aria-expanded": "false", "aria-controls": "tm-recipe-list", placeholder: t("timing.searchRecipes") }),
          h("ul", { class: "kp-combobox__list", id: "tm-recipe-list", role: "listbox", hidden: true }),
          h("p", { class: "kp-combobox__status", "data-kp-combobox-status": "", role: "status", "aria-live": "polite" }),
        ),
      ),
      h("p", { class: "kp-formgrid__value", id: "tm-pick-said", role: "status" }, t("timing.loadingRecipesDot")),
      h("div", { class: "kp-formgrid__actions", id: "tm-pick-actions" }),
    ),
  );
}

/** The page frame: every card in its loading state from the first frame, and the picker (always there). @param {{ root: HTMLElement, recipeId: string | null, cleanups: (() => void)[] }} ctx */
export function buildFrame({ root, recipeId, cleanups }) {
  const cards = buildCards();
  root.replaceChildren(...sectionsOf(cards, recipeId));
  for (const c of root.querySelectorAll(".kp-card")) setCardState(/** @type {HTMLElement} */ (c), "loading");
  cleanups.push(attachCardStates(root));
  const pickData = /** @type {HTMLElement} */ ($("#tm-pick-card-data", root));
  pickData.append(pickerRow());
  const box = /** @type {HTMLElement} */ ($(".kp-combobox", pickData));
  cleanups.push(attachComboboxes(pickData));
  return { ...cards, box };
}
