// Import a recipe (Kenny, 29/10/2026 14:27): a drawer on `.kp-formgrid` that takes a web address, or pasted text, asks the
// kitchen to read it (POST /data/import, src/import.rs) and opens the ordinary recipe editor on what came back, as an
// UNSAVED draft: the dish stays empty (or is the dish the import was started from) and required, nothing is stored
// until Save, and Cancel clears the draft like any other. The reading of lines (amount, unit, name, minutes) is in
// import-lines.js; the cover photo is offered in the editor (cover.js).

import { closeDialog, attachAutosize, attachCardStates, setCardState } from "/static/kp/dist/kp-themes.min.js";
import { h } from "../dom.js";
import { importRecipe, kitchenNow, readDraft, saveDraft, ApiError } from "../api.js";
import { openEditor } from "./editor/index.js";
import { newId } from "./editor/ids.js";
import { row, input, area } from "../ui/form-parts.js";
import { parseIngredientLine, firstMinutes, matchIngredient } from "./import-lines.js";
import { importReason } from "./cover.js";
import { externalLink, hostOf } from "../links.js";
import { t } from "../i18n/index.js";

/** What the server found, as the editor's form state. @typedef {{ name: string, portions: number | null, ingredients: string[], steps: string[], minutes: { prep: number | null, cook: number | null, total: number | null }, image_url: string | null, source_url: string | null }} Imported */

/** Error codes after which pasting the text is the way on. */
const PASTE_INSTEAD = new Set(["no_recipe", "http_status", "not_html", "unreachable", "timeout", "too_large", "too_many_redirects"]);

/**
 * The editor's form state for an imported recipe: label from the name, portions, one step per instruction with the first
 * duration it names as its minutes, the page's total as the override only when the page gives one and no step has minutes,
 * and one ingredient line per line (a remark in brackets becomes its note), matched to the catalogue or kept as a proposal that must be resolved before Save, and the page's address as the recipe's source.
 * @param {Imported} imp @param {string | null} dishId @param {{ id: string, name?: { nl?: string, en?: string } }[]} catalogue
 */
export function toRestore(imp, dishId, catalogue) {
  const group = t("edit.groupMain");
  const steps = imp.steps.map((text) => ({ id: newId(), text, track: null, mins: firstMinutes(text), say: "", active: true, mini: true }));
  const stepMinutes = steps.some((s) => s.mins > 0);
  const m = imp.minutes ?? { prep: null, cook: null, total: null };
  const pageTotal = m.total ?? (m.prep || m.cook ? (m.prep ?? 0) + (m.cook ?? 0) : null);
  const ingredients = imp.ingredients.map((line) => {
    const p = parseIngredientLine(line);
    const found = matchIngredient(p.name, catalogue);
    return {
      id: newId(),
      ingredient: found,
      amount: p.amount,
      unit: p.unit,
      group,
      ...(p.note ? { note: p.note } : {}),
      ...(found ? {} : { proposal: { text: p.text, name: p.name } }),
    };
  });
  const name = imp.name.trim();
  return {
    dish_id: dishId,
    new_dish: null,
    ...(name ? { label: { nl: name, en: name } } : {}),
    // Where it came from (Kenny, 29/10/2026): only a web address the server vetted, shown as a link on the recipe page.
    ...(imp.source_url && /^https?:\/\//i.test(imp.source_url) ? { source: imp.source_url } : {}),
    portions: Math.min(24, Math.max(1, imp.portions ?? 2)),
    steps,
    ingredients,
    ...(!stepMinutes && pageTotal ? { minutes: pageTotal, minutes_override: pageTotal } : {}),
  };
}

/** The address card: the package's card with its loading state while the page is read. @param {HTMLElement} url @param {{ name?: string, url?: string } | null} site */
function buildAddressCard(url, site) {
  return h(
    "section",
    { class: "kp-card ri-card", "data-kp-state": "ready", "aria-labelledby": "ri-card-t", "data-kp-loading-words": t("imp.reading") },
    h("div", { class: "kp-card__header" }, h("h3", { class: "kp-card__title", id: "ri-card-t" }, t("imp.secUrl"))),
    h("p", { class: "kp-card__body" }, t("imp.secUrlText")),
    // Where to find a recipe that reads well (Kenny, 29/10/2026 15:11): the sources page, and, when the import was started
    // from one of its rows, that site in a new tab.
    h(
      "p",
      { class: "kp-card__body ri-sites" },
      site?.url ? externalLink(site.url, t("src.openSite", site.name || hostOf(site.url))) : null,
      site?.url ? ` ${t("imp.siteHint")} ` : null,
      h("a", { class: "ri-sites__link", href: "/sources", title: t("imp.whichHint") }, t("imp.which")),
    ),
    h("div", { class: "kp-card__stage" }, h("div", { class: "kp-card__data" }, h("div", { class: "kp-formgrid" }, row(t("imp.url"), url, t("imp.urlHint"))))),
  );
}

/** The fields, buttons, alert, fold and card of the drawer. @param {{ name?: string, url?: string } | null} site */
function buildParts(site) {
  const url = input("", "text", { autocomplete: "off", inputmode: "url", placeholder: t("imp.urlPh"), spellcheck: "false" });
  const text = area("", 8);
  text.setAttribute("placeholder", t("imp.textPh"));
  const go = h("button", { type: "submit", class: "kp-button kp-button--primary", form: "ri-form" }, t("imp.go"));
  const cancel = h("button", { type: "button", class: "kp-button" }, t("common.cancel"));
  const alert = h("div", { class: "kp-alert kp-alert--destructive", role: "alert", hidden: true });
  const fold = h("details", { class: "ri-fold" }, h("summary", null, t("imp.pasteSummary")), h("div", { class: "ri-fold__body" }, h("p", { class: "rl-formsec__text" }, t("imp.secTextText")), h("div", { class: "kp-formgrid" }, row(t("imp.textLabel"), text, t("imp.textHint")))));
  const card = buildAddressCard(url, site);
  return { url, text, go, cancel, alert, fold, card };
}

/** @typedef {ReturnType<typeof buildParts>} ImportParts */

/** Put the drawer's head, form and foot into the dialog. @param {HTMLDialogElement} dialog @param {ImportParts} p */
function fillDrawer(dialog, p) {
  const form = h("form", { class: "kp-drawer__body rl-form", id: "ri-form", novalidate: true }, p.alert, p.card, p.fold);
  const line = h("p", { class: "rl-editor__line", role: "status" });
  dialog.replaceChildren(
    h(
      "header",
      { class: "kp-drawer__head" },
      h("h2", { class: "kp-dialog__title", id: "rl-editor-t" }, t("imp.title")),
      h("button", { type: "button", class: "kp-icon-button kp-dialog__close", "aria-label": t("edit.close"), "data-close": true }, "✕"),
      h("p", { class: "kp-drawer__desc" }, t("imp.text")),
    ),
    form,
    h("footer", { class: "kp-drawer__foot" }, line, p.cancel, p.go),
  );
  attachAutosize(dialog);
  return form;
}

/** Cancel, the close button, Escape and the sources link all close the drawer. @param {HTMLDialogElement} dialog @param {ImportParts} p @param {() => void} stopCards */
function wireClose(dialog, p, stopCards) {
  const close = () => {
    stopCards();
    void closeDialog(dialog);
  };
  p.cancel.addEventListener("click", close);
  // The sources page replaces this one: the drawer gives way to it.
  dialog.querySelector(".ri-sites__link")?.addEventListener("click", close);
  dialog.querySelector("[data-close]")?.addEventListener("click", close);
  // One Escape handler per opening, replaced by the editor's when it takes the dialog over (recipe/editor/index.js).
  const again = /** @type {any} */ (dialog);
  again.__rlAbort?.abort();
  again.__rlAbort = new AbortController();
  dialog.addEventListener("cancel", (e) => { e.preventDefault(); close(); }, { once: true, signal: again.__rlAbort.signal });
}

/** Show why the import failed. @param {ImportParts} p @param {string} title @param {string} body */
function fail(p, title, body) {
  p.alert.replaceChildren(h("div", { class: "kp-alert__body" }, h("strong", null, title), " ", body));
  p.alert.hidden = false;
}

/** Write the draft, then open the editor on what the kitchen read. @param {HTMLDialogElement} dialog @param {{ dishId: string | null, mainOptions: string[] }} spec @param {Imported} found @param {() => void} stopCards */
async function openOnImport(dialog, { dishId, mainOptions }, found, stopCards) {
  const restore = toRestore(found, dishId, kitchenNow()?.ingredients ?? []);
  // The draft is written first, as the editor would after the first change, but never over a draft that is already there.
  const key = `new:${dishId ?? ""}`;
  const existing = await readDraft(key).catch(() => null);
  if (!existing) await saveDraft(key, restore).catch(() => {});
  stopCards();
  openEditor(dialog, { recipe: null, mainOptions, preset: dishId ? { dish_id: dishId } : {}, restore, imported: true, cover: found.image_url });
}

/** A failed import says why, and offers the pasted text when that is the way on. @param {ImportParts} p @param {unknown} e @param {boolean} usePaste */
function showFailure(p, e, usePaste) {
  const code = e instanceof ApiError ? e.message : "";
  setCardState(p.card, "ready");
  const paste = PASTE_INSTEAD.has(code) && !usePaste;
  fail(p, t("imp.errTitle"), code === "no_recipe" ? (usePaste ? t("imp.noText") : t("imp.fallback")) : e instanceof ApiError ? importReason(code) : t("photo.dropped"));
  if (paste) {
    p.fold.open = true;
    p.text.focus();
  }
}

/** @param {HTMLDialogElement} dialog @param {ImportParts} p @param {HTMLFormElement} form @param {{ dishId: string | null, mainOptions: string[] }} spec @param {() => void} stopCards */
function wireSubmit(dialog, p, form, spec, stopCards) {
  let busy = false;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    p.alert.hidden = true;
    const pasted = p.text.value.trim();
    const address = p.url.value.trim();
    const usePaste = p.fold.open && pasted !== "";
    if (!usePaste && !address) {
      fail(p, t("imp.errTitle"), t("imp.needInput"));
      p.url.focus();
      return;
    }
    busy = true;
    p.go.setAttribute("aria-disabled", "true");
    setCardState(p.card, "loading", { words: t("imp.reading") });
    try {
      /** @type {Imported} */
      const found = await importRecipe(usePaste ? { text: pasted } : { url: address });
      await openOnImport(dialog, spec, found, stopCards);
    } catch (e) {
      showFailure(p, e, usePaste);
    } finally {
      busy = false;
      p.go.removeAttribute("aria-disabled");
    }
  });
}

/**
 * Open the import drawer in `dialog`. `dishId` is the dish the recipe goes to when the import started on a dish's page.
 * @param {HTMLDialogElement} dialog @param {{ dishId?: string | null, mainOptions: string[], site?: { name?: string, url?: string } | null }} spec
 */
export function openImport(dialog, { dishId = null, mainOptions, site = null }) {
  const p = buildParts(site);
  const stopCards = attachCardStates(p.card);
  const form = fillDrawer(dialog, p);
  wireClose(dialog, p, stopCards);
  wireSubmit(dialog, p, form, { dishId, mainOptions }, stopCards);
  if (!dialog.open) dialog.showModal();
  p.url.focus();
}
