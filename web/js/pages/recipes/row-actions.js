// A recipe row's actions: Edit is the row action, Duplicate and Delete sit in a kit row menu (Kenny, 01/11/2026 20:21,
// "Rijmenu"). The menu is the kit's menu-button; the trigger is its icon button, named for the recipe. Delete is the
// shared delete-with-Undo (records/recipe-delete.js): the recipe goes at once and the kit's toast offers it back for 10 s.

import { setMenu, MENU_SELECT_EVENT } from "/static/kp/dist/js/menu-button.js";
import { h } from "../../dom.js";
import { t } from "../../i18n/index.js";
import { editHref } from "../../recipe/edit-route.js";
import { copyToEditor } from "../../recipe/edit-nav.js";
import { deleteRecipe } from "../../records/index.js";

const DOTS =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>';

/** The menu's one group. */
const entries = () => [{ items: [{ label: t("common.duplicate"), value: "duplicate" }, { label: t("common.delete"), value: "delete", danger: true }] }];

/** The row menu: Duplicate and Delete. @param {Record<string, any>} r */
function rowMenu(r) {
  const button = h("button", { type: "button", class: "kp-icon-button", "aria-label": t("recs.moreFor", r.name) });
  button.innerHTML = DOTS;
  const menu = h("div", { class: "kp-menu", role: "menu", "aria-label": t("recs.moreFor", r.name) });
  const wrapper = h("div", { class: "kp-menu-button rl-menu", "data-kp-menu-button": "" }, button, menu);
  setMenu(wrapper, entries());
  wrapper.addEventListener(MENU_SELECT_EVENT, (event) => {
    const value = /** @type {CustomEvent} */ (event).detail.value;
    if (value === "duplicate") copyToEditor(r);
    else if (value === "delete") void deleteRecipe(r.id, r.name);
  });
  return wrapper;
}

/** Edit (a link to the editor page) and the row menu. The caller attaches the kit's menu buttons to the table body. @param {Record<string, any>} r */
export function actionsOf(r) {
  const edit = h("a", { class: "kp-button kp-button--sm", href: editHref({ id: r.id }, "/recipes"), "aria-label": t("rec.editName", r.name) }, t("common.edit"));
  return h("div", { class: "rl-actions" }, edit, rowMenu(r));
}
