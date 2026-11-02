// The import field at the top of the Recipes page (Kenny, 01/11/2026, "Veld bovenaan"): "Paste a link" and an Import button
// on one row of the kit's form grid, the pasted-text fallback in a fold under it, and the way to the sources list beside the
// field. The result opens the editor page as an unsaved draft (recipe/import.js). The sources page and a dish's page come
// here with `?import=1` (recipe/import-plan.js `importHref`): the field is focused, and the hint names the site or the dish.

import { attachCardStates, setCardState } from "/static/kp/dist/js/card-state.js";
import { attachForms, VALID_EVENT } from "/static/kp/dist/js/forms.js";
import { h } from "../../dom.js";
import { ApiError } from "../../api.js";
import { t, nameOf } from "../../i18n/index.js";
import { externalLink, hostOf } from "../../links.js";
import { input, area, uid } from "../../ui/form-parts.js";
import { importInput, shouldOfferPaste, failureOf } from "../../recipe/import-plan.js";
import { importReason } from "../../recipe/cover.js";
import { runImport } from "../../recipe/import.js";

/** One row of the form grid whose value track holds markup. @param {string} label @param {HTMLElement} control @param {HTMLElement} value */
function formRow(label, control, value) {
  const first = control.querySelector("input, textarea") ?? control;
  return h("div", { class: "kp-formgrid__row" }, h("label", { class: "kp-formgrid__label", for: first.id }, label), h("div", { class: "kp-formgrid__control" }, control), value);
}

/** @param {{ dishId: string | null }} o */
export function buildImportField({ dishId }) {
  const url = input("", "text", { autocomplete: "off", inputmode: "url", placeholder: t("imp.urlPh"), spellcheck: "false" });
  const text = area("", 8, null);
  text.setAttribute("placeholder", t("imp.textPh"));
  const go = h("button", { type: "submit", class: "kp-button kp-button--primary", "data-kp-submit": true }, t("imp.go"));
  const hint = h("p", { class: "kp-formgrid__value ri-hint" }, t("imp.urlHint"), " ", h("a", { class: "ri-sites__link", href: "/sources", title: t("imp.whichHint") }, t("imp.which")));
  const context = h("p", { class: "kp-lede ri-context", role: "status", hidden: true });
  const alert = h("div", { class: "kp-alert kp-alert--destructive", role: "alert", hidden: true });
  const fold = h("details", { class: "ri-fold" }, h("summary", null, t("imp.pasteSummary")), h("div", { class: "ri-fold__body" }, h("p", { class: "rl-formsec__text" }, t("imp.secTextText")), h("div", { class: "kp-formgrid" }, formRow(t("imp.textLabel"), text, h("p", { class: "kp-formgrid__value" }, t("imp.textHint"))))));
  const summary = h("div", { class: "kp-form__summary", "data-kp-form-summary": true, tabindex: "-1", hidden: true });
  const form = h("form", { class: "rl-import__form", id: uid("ri-form"), "data-kp-form": true, novalidate: true }, summary, alert, h("div", { class: "kp-formgrid" }, formRow(t("imp.linkLabel"), h("div", { class: "ri-control" }, h("div", { class: "rl-many" }, url, go), h("span", { class: "kp-field__error", "data-kp-field-error": true, hidden: true })), hint)), context, fold);
  // A visible heading and one sentence, like every other card on the page (Kenny, 02/11/2026 03:43).
  const titleId = uid("ri-title");
  const card = h(
    "section",
    { class: "kp-card rl-import", "data-kp-state": "ready", "aria-labelledby": titleId, "data-kp-loading-words": t("imp.reading") },
    h("div", { class: "kp-card__header" }, h("h2", { class: "kp-card__title", id: titleId }, t("imp.title"))),
    h("p", { class: "kp-lede" }, t("imp.lede")),
    h("div", { class: "kp-card__stage" }, h("div", { class: "kp-card__data" }, form)),
  );
  return { card, form, url, text, go, fold, alert, context, hint };
}

/** @typedef {ReturnType<typeof buildImportField>} ImportField */

/** Show why the import failed. @param {ImportField} f @param {string} body */
function fail(f, body) {
  f.alert.replaceChildren(h("div", { class: "kp-alert__body" }, h("strong", null, t("imp.errTitle")), " ", body));
  f.alert.hidden = false;
}

/** A failed import says why, and opens the pasted text when that is the way on. @param {ImportField} f @param {unknown} e @param {boolean} usedPaste */
function showFailure(f, e, usedPaste) {
  const code = e instanceof ApiError ? e.message : "";
  setCardState(f.card, "ready");
  const said = failureOf({ fromKitchen: e instanceof ApiError, code, status: e instanceof ApiError ? e.status : 0, usedPaste });
  fail(f, "key" in said ? t(said.key) : importReason(said.code));
  if (shouldOfferPaste(code, usedPaste)) {
    f.fold.open = true;
    f.text.focus();
  }
}

/**
 * Wire the field. The package's form checks it on submit (nothing typed is a message in its summary, focus moves there);
 * a valid submit reads the page and opens the editor page, and the submit button shows it is working until it is done.
 * @param {ImportField} f @param {string | null} dishId @returns {() => void} detach
 */
export function wireImportField(f, dishId) {
  const stopCards = attachCardStates(f.card);
  const typed = () => importInput({ address: f.url.value, pasted: f.text.value, pasteOpen: f.fold.open });
  // Before the form checks itself: the link is required unless the pasted text is used.
  f.form.addEventListener("submit", () => f.url.setCustomValidity(typed().ok ? "" : t("imp.needInput")));
  const stopForms = attachForms(f.card, { wrapper: ".kp-formgrid__row", validateOn: "submit", revalidateOn: "none" });
  f.form.addEventListener(VALID_EVENT, async (event) => {
    const { done } = /** @type {CustomEvent<{ done: () => void }>} */ (event).detail;
    const ask = typed();
    if (!ask.ok) return done();
    f.alert.hidden = true;
    setCardState(f.card, "loading", { words: t("imp.reading") });
    try {
      await runImport(ask.body, dishId);
    } catch (e) {
      showFailure(f, e, ask.usePaste);
    } finally {
      done();
    }
  });
  return () => {
    stopForms();
    stopCards();
  };
}

/**
 * Say where the result goes: into the dish the import started from, or beside the site it points at.
 * @param {ImportField} f @param {{ dish: Record<string, any> | null, site: Record<string, any> | null }} where
 */
export function paintContext(f, { dish, site }) {
  const parts = [];
  if (dish) parts.push(t("imp.intoDish", nameOf(dish).text));
  if (site?.url) parts.push(externalLink(site.url, t("src.openSite", site.name || hostOf(site.url))), ` ${t("imp.siteHint")}`);
  f.context.replaceChildren(...parts);
  f.context.hidden = parts.length === 0;
}
