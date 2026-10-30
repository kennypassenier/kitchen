// The form under the freezer: a real freezer gets filled. Both names, which dish it is, how many portions, which day.

import { toast } from "/static/kp/js/overlays.js";
import { datePicker } from "/static/kp/js/datepicker.js";
import { attachForms, VALID_EVENT } from "/static/kp/js/forms.js";
import { drawnSelect } from "/static/kp/js/combobox.js";
import { create, kitchenNow, onKitchen, reason } from "../../api.js";
import { h, $ } from "../../dom.js";
import { t, nameOf, textOf } from "../../i18n/index.js";
import { dmy, today } from "../../format.js";
import { DAY } from "./helpers.js";

/** @param {import("./index.js").BadDaysCtx} ctx */
export function wireFreezerForm(ctx) {
  const { page, stops } = ctx;
  // The add form: a real freezer gets filled.
  const form = /** @type {HTMLFormElement} */ ($("[data-bd-add-form]", page));
  const dishField = /** @type {HTMLInputElement} */ ($("#bd-add-dish", page));
  // Both names (Kenny, 24/10/2026 10:04): the Dutch field above, the English one here.
  const dishEnField = /** @type {HTMLInputElement} */ ($("#bd-add-dish-en", page));
  const dishEnRow = /** @type {HTMLElement} */ ($("[data-bd-dish-en-row]", page));
  const dishEnNote = /** @type {HTMLElement} */ ($("[data-bd-dish-en-note]", page));
  // Which of Kenny's dishes it is (Kenny, 24/10/2026 09:17): the wheel counts its portions for that dish. Picking one
  // with the name field still empty fills it in.
  const fromField = /** @type {HTMLSelectElement} */ ($("[data-bd-from]", page));
  const fillDishes = () => {
    const was = fromField.value;
    fromField.replaceChildren(
      h("option", { value: "" }, t("rec.noDish")),
      ...[...(kitchenNow()?.dishes ?? [])].map((d) => [d.id, nameOf(d).text]).sort((a, b) => a[1].localeCompare(b[1])).map(([id, n]) => h("option", { value: id }, n)),
    );
    fromField.value = was;
    drawnSelect(fromField)?.refresh();
  };
  fromField.addEventListener("change", () => {
    const d = kitchenNow()?.dishes.find((x) => x.id === fromField.value);
    if (d && !dishField.value.trim()) dishField.value = String(d.name?.nl ?? "");
    if (d && !dishEnField.value.trim()) dishEnField.value = String(d.name?.en ?? "");
  });
  stops.push(onKitchen(() => ctx.alive && fillDishes()));
  fillDishes();
  const dishRow = /** @type {HTMLElement} */ ($("[data-bd-dish-row]", page));
  const dishNote = /** @type {HTMLElement} */ ($("[data-bd-dish-note]", page));
  const dateInput = /** @type {HTMLInputElement} */ ($("#bd-add-date", page));
  const dateRow = /** @type {HTMLElement} */ ($("[data-bd-date-row]", page));
  const dateNote = /** @type {HTMLElement} */ ($("[data-bd-date-note]", page));
  const portionsInput = /** @type {HTMLInputElement} */ ($("#bd-add-portions", page));
  const picker = /** @type {HTMLElement} */ ($("[data-bd-date]", page));
  const todayIso = today();
  picker.setAttribute("data-kp-max", todayIso);
  const setToday = () => datePicker(picker)?.set(todayIso);
  setToday();
  if (!dateInput.value) dateInput.value = dmy(todayIso);

  /** @param {HTMLElement} row @param {HTMLElement} note @param {string | null} message @param {string} plain */
  const mark = (row, note, message, plain) => {
    if (message) row.setAttribute("data-kp-state", "error");
    else row.removeAttribute("data-kp-state");
    note.textContent = message ?? plain;
  };
  dishField.addEventListener("input", () => {
    dishField.removeAttribute("aria-invalid");
    mark(dishRow, dishNote, null, t("bad.dishHint"));
  });
  dateInput.addEventListener("input", () => {
    dateInput.removeAttribute("aria-invalid");
    mark(dateRow, dateNote, null, t("bad.dateHint"));
  });
  // The package form owns the submit: it checks validity, lists what is wrong in its summary, makes the button busy and
  // fires VALID_EVENT. This listener runs first and turns the page's own rules into the browser's validity.
  const DISH_WRONG = t("bad.dishWrong");
  const DATE_WRONG = t("bad.dateWrong");
  form.addEventListener("submit", (event) => {
    // (kp-themes 11.3.0 stops the browser's own submit of a valid form itself; Kitchen's own preventDefault that stood here
    // since 24/10/2026, when the page reloaded before the save went out, is gone with it.)
    const dish = dishField.value.trim();
    const dishEn = dishEnField.value.trim();
    const picked = datePicker(picker)?.get() ?? null;
    dishField.setCustomValidity(dish ? "" : DISH_WRONG);
    dishEnField.setCustomValidity(dishEn ? "" : DISH_WRONG);
    mark(dishEnRow, dishEnNote, dishEn ? null : DISH_WRONG, t("bad.dishEnHint"));
    dateInput.setCustomValidity(picked && picked.getTime() <= Date.now() + DAY ? "" : DATE_WRONG);
    mark(dishRow, dishNote, dish ? null : DISH_WRONG, t("bad.dishHint"));
    mark(dateRow, dateNote, dateInput.validationMessage || null, t("bad.dateHint"));
  });
  dishField.addEventListener("input", () => dishField.setCustomValidity(""));
  dishEnField.addEventListener("input", () => {
    dishEnField.setCustomValidity("");
    mark(dishEnRow, dishEnNote, null, t("bad.dishEnHint"));
  });
  dateInput.addEventListener("input", () => dateInput.setCustomValidity(""));
  const stopForms = attachForms(page, { wrapper: ".kp-formgrid__row", validateOn: "submit", revalidateOn: "none" });
  stops.push(stopForms);
  form.addEventListener(VALID_EVENT, async (event) => {
    const { done } = /** @type {CustomEvent<{ done: () => void }>} */ (event).detail;
    const name = { nl: dishField.value.trim(), en: dishEnField.value.trim() };
    const dish = textOf(name);
    const portions = Math.round(Number(portionsInput.value.replace(",", ".")));
    const picked = /** @type {Date} */ (datePicker(picker)?.get());
    const sameDay = picked.toLocaleDateString("en-CA") === new Date().toLocaleDateString("en-CA");
    const when = sameDay ? new Date() : new Date(picked.getFullYear(), picked.getMonth(), picked.getDate(), 12, 0, 0);
    try {
      await create("freezer", {
        dish: name,
        dish_id: fromField.value || null,
        portions: Math.max(1, Number.isFinite(portions) ? portions : 1),
        frozen_on: when.toISOString(),
      });
      toast(t("bad.added", dish), { ms: 4000 });
      dishField.value = "";
      dishEnField.value = "";
      setToday();
      dishField.focus();
    } catch (e) {
      toast(t("bad.addFailed", dish, reason(e)), { live: "assertive", sticky: true });
    } finally {
      done();
    }
  });
}
