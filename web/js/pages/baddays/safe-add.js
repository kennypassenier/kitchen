// "Add a safe dish": a button whose kit menu lists the recipes that are not a safe dish yet; one click marks it safe, no
// editor (Kenny, 01/11/2026 20:21, "Keuzelijst"). Writing a new recipe stays one entry at the foot of the list.

import { attachMenuButtons, setMenu, toast, MENU_SELECT_EVENT } from "/static/kp/dist/kp-themes.min.js";
import { h } from "../../dom.js";
import { replace, reason, kitchenNow } from "../../api.js";
import { t } from "../../i18n/index.js";
import { saveFailed } from "../../api/stale-notice.js";
import { newRecipe } from "../../recipe/edit-nav.js";
import { notSafeRecipes, choiceHint } from "./safe-choices.js";

const NEW = "\u0000new";

/** The menu's groups: the recipes to mark, then the way to write a new one. @param {{ recipes: any[] }} k */
function groups(k) {
  const free = notSafeRecipes(k);
  const marks = free.length
    ? free.map((r) => ({ label: String(r.name), hint: choiceHint(r), value: r.id }))
    : [{ label: t("rec.allSafe"), disabled: t("bad.allSafeWhy") }];
  return [{ items: marks }, { items: [{ label: t("rec.writeNew"), value: NEW }] }];
}

/** Mark a recipe as safe, or open the editor for a new one. @param {string} value */
async function choose(value) {
  if (value === NEW) {
    newRecipe({ safe: true });
    return;
  }
  const r = kitchenNow()?.recipes.find((x) => x.id === value);
  if (!r) return;
  try {
    await replace("recipes", { ...r, safe: true });
    toast(t("rec.isSafe", r.name));
  } catch (e) {
    saveFailed(e, () => t("rec.notChanged", reason(e)));
  }
}

/**
 * @param {{ primary?: boolean }} [o]
 * @returns {{ el: HTMLElement, fill: (k: { recipes: any[] }) => void, stop: () => void }}
 */
export function createSafeAdd({ primary = true } = {}) {
  const button = h("button", { type: "button", class: `kp-button${primary ? " kp-button--primary" : ""}` }, t("bad.addSafe"), h("span", { "aria-hidden": "true" }, " ▾"));
  const menu = h("div", { class: "kp-menu kp-menu--rich", role: "menu", "aria-label": t("bad.safeMenu") });
  const wrapper = h("div", { class: "kp-menu-button bd-safe-add__menu", "data-kp-menu-button": "" }, button, menu);
  const el = h("span", { class: "bd-safe-add" }, wrapper);
  const stop = attachMenuButtons(el);
  wrapper.addEventListener(MENU_SELECT_EVENT, (event) => void choose(/** @type {CustomEvent} */ (event).detail.value));
  return { el, fill: (k) => setMenu(wrapper, groups(k)), stop };
}
