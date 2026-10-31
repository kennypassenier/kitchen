// The form under the freezer: a real freezer gets filled. Both names, which dish it is, how many portions, which day.

import { toast, datePicker, attachForms, VALID_EVENT, drawnSelect } from "/static/kp/dist/kp-themes.min.js";
import { create, kitchenNow, onKitchen, reason } from "../../api.js";
import { h, $ } from "../../dom.js";
import { t, nameOf, textOf } from "../../i18n/index.js";
import { dmy, today } from "../../format.js";
import { DAY } from "./helpers.js";

/** @param {HTMLElement} page */
function formParts(page) {
  const q = (/** @type {string} */ sel) => $(sel, page);
  return {
    form: /** @type {HTMLFormElement} */ (q("[data-bd-add-form]")),
    dishField: /** @type {HTMLInputElement} */ (q("#bd-add-dish")),
    // Both names (Kenny, 24/10/2026 10:04): the Dutch field above, the English one here.
    dishEnField: /** @type {HTMLInputElement} */ (q("#bd-add-dish-en")),
    dishEnRow: /** @type {HTMLElement} */ (q("[data-bd-dish-en-row]")),
    dishEnNote: /** @type {HTMLElement} */ (q("[data-bd-dish-en-note]")),
    // Which of Kenny's dishes it is (Kenny, 24/10/2026 09:17): the wheel counts its portions for that dish.
    fromField: /** @type {HTMLSelectElement} */ (q("[data-bd-from]")),
    dishRow: /** @type {HTMLElement} */ (q("[data-bd-dish-row]")),
    dishNote: /** @type {HTMLElement} */ (q("[data-bd-dish-note]")),
    dateInput: /** @type {HTMLInputElement} */ (q("#bd-add-date")),
    dateRow: /** @type {HTMLElement} */ (q("[data-bd-date-row]")),
    dateNote: /** @type {HTMLElement} */ (q("[data-bd-date-note]")),
    portionsInput: /** @type {HTMLInputElement} */ (q("#bd-add-portions")),
    picker: /** @type {HTMLElement} */ (q("[data-bd-date]")),
  };
}

/** @typedef {ReturnType<typeof formParts>} FormParts */

/** The kitchen's dishes as the choices of "which dish it is"; picking one with the name field still empty fills it in. @param {import("./index.js").BadDaysCtx} ctx @param {FormParts} f */
function wireDishPicker(ctx, f) {
  const { fromField, dishField, dishEnField } = f;
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
  ctx.stops.push(onKitchen(() => ctx.alive && fillDishes()));
  fillDishes();
}

/** The date picker: nothing after today, today by default. Returns the way to set it back to today. @param {FormParts} f */
function initDate({ picker, dateInput }) {
  const todayIso = today();
  picker.setAttribute("data-kp-max", todayIso);
  const setToday = () => datePicker(picker)?.set(todayIso);
  setToday();
  if (!dateInput.value) dateInput.value = dmy(todayIso);
  return setToday;
}

/** @param {HTMLElement} row @param {HTMLElement} note @param {string | null} message @param {string} plain */
function mark(row, note, message, plain) {
  if (message) row.setAttribute("data-kp-state", "error");
  else row.removeAttribute("data-kp-state");
  note.textContent = message ?? plain;
}

/** Typing clears what the last submit said was wrong. @param {FormParts} f */
function wireHints(f) {
  const { dishField, dishEnField, dateInput } = f;
  dishField.addEventListener("input", () => {
    dishField.removeAttribute("aria-invalid");
    mark(f.dishRow, f.dishNote, null, t("bad.dishHint"));
  });
  dateInput.addEventListener("input", () => {
    dateInput.removeAttribute("aria-invalid");
    mark(f.dateRow, f.dateNote, null, t("bad.dateHint"));
  });
  dishField.addEventListener("input", () => dishField.setCustomValidity(""));
  dishEnField.addEventListener("input", () => {
    dishEnField.setCustomValidity("");
    mark(f.dishEnRow, f.dishEnNote, null, t("bad.dishEnHint"));
  });
  dateInput.addEventListener("input", () => dateInput.setCustomValidity(""));
}

/** The package form owns the submit: it checks validity, lists what is wrong in its summary, makes the button busy and fires VALID_EVENT. This listener runs first and turns the page's own rules into the browser's validity. @param {FormParts} f */
function wireChecks(f) {
  const { dishField, dishEnField, dateInput, picker } = f;
  const DISH_WRONG = t("bad.dishWrong");
  const DATE_WRONG = t("bad.dateWrong");
  f.form.addEventListener("submit", () => {
    // (kp-themes 11.3.0 stops the browser's own submit of a valid form itself; Kitchen's own preventDefault that stood here
    // since 24/10/2026, when the page reloaded before the save went out, is gone with it.)
    const dish = dishField.value.trim();
    const dishEn = dishEnField.value.trim();
    const picked = datePicker(picker)?.get() ?? null;
    dishField.setCustomValidity(dish ? "" : DISH_WRONG);
    dishEnField.setCustomValidity(dishEn ? "" : DISH_WRONG);
    mark(f.dishEnRow, f.dishEnNote, dishEn ? null : DISH_WRONG, t("bad.dishEnHint"));
    dateInput.setCustomValidity(picked && picked.getTime() <= Date.now() + DAY ? "" : DATE_WRONG);
    mark(f.dishRow, f.dishNote, dish ? null : DISH_WRONG, t("bad.dishHint"));
    mark(f.dateRow, f.dateNote, dateInput.validationMessage || null, t("bad.dateHint"));
  });
}

/** The moment the chosen day means: now for today, noon for another day. @param {HTMLElement} picker */
function whenOf(picker) {
  const picked = /** @type {Date} */ (datePicker(picker)?.get());
  const sameDay = picked.toLocaleDateString("en-CA") === new Date().toLocaleDateString("en-CA");
  return sameDay ? new Date() : new Date(picked.getFullYear(), picked.getMonth(), picked.getDate(), 12, 0, 0);
}

/** A valid submit adds the item to the freezer. @param {FormParts} f @param {() => void} setToday */
function wireSave(f, setToday) {
  f.form.addEventListener(VALID_EVENT, async (event) => {
    const { done } = /** @type {CustomEvent<{ done: () => void }>} */ (event).detail;
    const name = { nl: f.dishField.value.trim(), en: f.dishEnField.value.trim() };
    const dish = textOf(name);
    const portions = Math.round(Number(f.portionsInput.value.replace(",", ".")));
    try {
      await create("freezer", {
        dish: name,
        dish_id: f.fromField.value || null,
        portions: Math.max(1, Number.isFinite(portions) ? portions : 1),
        frozen_on: whenOf(f.picker).toISOString(),
      });
      toast(t("bad.added", dish), { ms: 4000 });
      f.dishField.value = "";
      f.dishEnField.value = "";
      setToday();
      f.dishField.focus();
    } catch (e) {
      toast(t("bad.addFailed", dish, reason(e)), { live: "assertive", sticky: true });
    } finally {
      done();
    }
  });
}

/** The form under the freezer. @param {import("./index.js").BadDaysCtx} ctx */
export function wireFreezerForm(ctx) {
  const f = formParts(ctx.page);
  wireDishPicker(ctx, f);
  const setToday = initDate(f);
  wireHints(f);
  wireChecks(f);
  ctx.stops.push(attachForms(ctx.page, { wrapper: ".kp-formgrid__row", validateOn: "submit", revalidateOn: "none" }));
  wireSave(f, setToday);
}
