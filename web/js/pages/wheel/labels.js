// The words of the wheel page that name things: meals, time bands, easy kinds, the constraints and minutes.

import { t } from "../../i18n/index.js";
import { minutesWords } from "../../i18n/minutes.js";

export const mealLabels = () => /** @type {Record<string, string>} */ ({ breakfast: t("wheel.mealBreakfast"), lunch: t("wheel.mealLunch"), dinner: t("wheel.mealDinner") });
export const bandLabels = () => /** @type {Record<string, string>} */ ({ quick: t("wheel.bandQuick"), mid: t("wheel.bandMid"), long: t("wheel.bandLong") });
export const kindLabels = () => /** @type {Record<string, string>} */ ({ safe: t("wheel.kindSafe"), freezer: t("wheel.kindFreezer"), noprep: t("wheel.kindNoprep") });
export const loadingWords = () => t("wheel.loading");

/** @param {number} m */
export const minutesText = (m) => minutesWords(m, "wheel.hm", "wheel.min");

/** The words the constraints are named with. @param {(id: string) => string | undefined} dishLabel @param {(v: string) => string} catName @returns {import("./logic.js").Words} */
export const constraintWords = (dishLabel, catName) => ({
  meal: (v) => mealLabels()[v] ?? v,
  time: (v) => bandLabels()[v] ?? v,
  cat: catName,
  dish: (id) => dishLabel(id) ?? t("wheel.aDish"),
  kind: (k) => kindLabels()[k],
  with: (n) => t("wheel.with", n),
  without: (n) => t("wheel.without", n),
  not: (n) => t("wheel.not", n),
  resting: (n) => t("wheel.restingLabel", n),
  notCounting: (n) => t("wheel.notCounting", n.toLowerCase()),
  noEnergy: t("wheel.noEnergyLabel"),
});
