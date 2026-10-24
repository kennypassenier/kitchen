// The dish editor and the small name editor, both in the recipe editor's drawer on `.kp-formgrid`.
//
// A dish (docs/agent/DATA.md "dishes") is what lands on a plate: a Dutch and an English name, a category, whether it
// is on the parents' wheel, an optional recipe to cook it from, and its sides (Kenny, 24/10/2026 05:03). A side is
// its own two names and a "Choice" switch: the small wheel picks one of the sides with Choice on (fries, mash, rice,
// …); the others always come with the dish. Every name has a Dutch and an English half, and a dish or side shows on
// the wheel of each language it has a name in (src/parents.rs; Kenny, 22/10/2026 23:08).
//
// The name editor edits one category: its two names and its position in the list.

import { attachSegmented } from "/static/kp/js/segmented.js";
import { attachSelects } from "/static/kp/js/combobox.js";
import { attachQuantities, getQuantity } from "/static/kp/js/quantity.js";
import { attachSwitches } from "/static/kp/js/forms.js";
import { attachFlashButtons, runFlashButton } from "/static/kp/js/flash.js";
import { closeDialog } from "/static/kp/js/motion.js";
import { toast } from "/static/kp/js/overlays.js";
import { h } from "../dom.js";
import { create, replace, ApiError } from "../api.js";
import { row, input, toggle, on, select, rows, textCell } from "../recipe/editor.js";

/** @typedef {Record<string, any>} Item */

/** Both names of an item, trimmed. @param {Item | null | undefined} item */
export const names = (item) => ({ nl: String(item?.name?.nl ?? "").trim(), en: String(item?.name?.en ?? "").trim() });
/** The name to show in Kitchen: English, else Dutch. @param {Item | null | undefined} item */
export const label = (item) => names(item).en || names(item).nl || "(no name)";
/** Which wheels a dish's names put it on: "both", "nl", "en" or "none". @param {Item} dish */
export function languages(dish) {
  const n = names(dish);
  return n.nl && n.en ? "both" : n.nl ? "nl" : n.en ? "en" : "none";
}
/** Items in their list order. @param {Item[]} list */
export const ordered = (list) => [...list].sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9));

/** A section of the drawer's form. @param {string} title @param {string} text @param {...HTMLElement} body */
const sec = (title, text, ...body) => h("section", { class: "rl-formsec" }, h("h3", { class: "kp-fw-semibold" }, title), h("p", { class: "rl-formsec__text" }, text), ...body);

/**
 * Fill the drawer and open it.
 * @param {HTMLDialogElement} dialog
 * @param {{ title: string, text: string, form: HTMLFormElement, saveLabel: string, onSave: () => Promise<string | { error: string, remedy?: string, word: string }> }} spec
 */
function openDrawer(dialog, { title, text, form, saveLabel, onSave }) {
  const save = h("button", { type: "submit", class: "kp-button kp-button--primary", "data-kp-flash-button": true, "data-kp-flash-words": "Saved", form: form.id }, saveLabel);
  const cancel = h("button", { type: "button", class: "kp-button" }, "Cancel");
  const line = h("p", { class: "rl-editor__line", role: "status" });
  dialog.replaceChildren(
    h(
      "header",
      { class: "kp-drawer__head" },
      h("h2", { class: "kp-dialog__title", id: "rl-editor-t" }, title),
      h("button", { type: "button", class: "kp-icon-button kp-dialog__close", "aria-label": "Close without saving", "data-close": true }, "✕"),
      h("p", { class: "kp-drawer__desc" }, text),
    ),
    form,
    h("footer", { class: "kp-drawer__foot" }, line, cancel, save),
  );
  attachSelects(dialog);
  attachQuantities(dialog);
  attachSwitches(dialog);
  attachSegmented(dialog);
  attachFlashButtons(dialog);
  const close = () => void closeDialog(dialog);
  cancel.addEventListener("click", close);
  dialog.querySelector("[data-close]")?.addEventListener("click", close);
  dialog.addEventListener(
    "cancel",
    (e) => {
      e.preventDefault();
      close();
    },
    { once: true },
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void runFlashButton(save, async () => {
      const out = await onSave();
      if (typeof out === "string") close();
      return out;
    });
  });
  dialog.showModal();
}

/** @param {unknown} e */
const why = (e) => (e instanceof ApiError ? e.message : String(e));

/**
 * A row's Choice switch: the package's switch, named for the row by its column header.
 * @param {boolean} value
 */
function choiceCell(value) {
  const box = h("input", { class: "kp-switch__input", type: "checkbox", role: "switch", "aria-label": "Choice: the small wheel picks from it" });
  /** @type {HTMLInputElement} */ (box).checked = value;
  const el = h("label", { class: "kp-switch" }, box, h("span", { class: "kp-switch__state", "aria-hidden": "true" }));
  return { el, get: () => /** @type {HTMLInputElement} */ (box).checked };
}

/**
 * The sides block: one row per side on three columns (Dutch, English, Choice).
 * @param {Item[]} sides the dish's sides
 */
function sidesBlock(sides) {
  const list = rows({
    columns: [
      { label: "Dutch", width: "minmax(0, 1fr)", make: (/** @type {any} */ s) => textCell("Dutch name of the side", s.name?.nl ?? "", "Frieten") },
      { label: "English", width: "minmax(0, 1fr)", make: (/** @type {any} */ s) => textCell("English name of the side", s.name?.en ?? "", "Fries") },
      { label: "Choice", width: "max-content", make: (/** @type {any} */ s) => choiceCell(s.choice === true) },
    ],
    items: sides,
    add: "Add a side",
    noun: "side",
    blank: () => ({ name: { nl: "", en: "" }, choice: false }),
  });
  return {
    el: list.el,
    get: () =>
      list
        .get()
        .map(([nl, en, choice]) => ({ name: { nl, en }, choice }))
        .filter((/** @type {any} */ s) => s.name.nl || s.name.en),
  };
}

/**
 * Open the editor for a dish, or for a new one.
 * @param {HTMLDialogElement} dialog
 * @param {{ dish: Item | null, categories: Item[], recipes: Item[] }} spec
 */
export function openDishEditor(dialog, { dish, categories, recipes }) {
  const d = dish ?? { name: { nl: "", en: "" }, category: categories[0]?.id ?? null, parents: true, recipe_id: null, sides: [] };
  const n = names(d);
  const nl = input(n.nl, "text", { autocomplete: "off", lang: "nl", placeholder: "Stoofvlees" });
  const en = input(n.en, "text", { autocomplete: "off", placeholder: "Flemish beef stew" });
  const category = select([["", "No category"], ...categories.map((c) => /** @type {[string, string]} */ ([c.id, label(c)]))], d.category ?? "", "Category");
  const parents = toggle("On the parents' wheel", d.parents === true);
  const recipe = select(
    [["", "No recipe"], ...[...recipes].sort((a, b) => String(a.name).localeCompare(String(b.name))).map((r) => /** @type {[string, string]} */ ([r.id, String(r.name)]))],
    d.recipe_id ?? "",
    "Recipe",
  );
  const sides = sidesBlock(Array.isArray(d.sides) ? d.sides : []);
  const form = /** @type {HTMLFormElement} */ (
    h(
      "form",
      { class: "kp-drawer__body rl-form", id: "dl-editor-form", novalidate: true },
      sec(
        "The dish",
        "A dish shows on the Dutch wheel when it has a Dutch name and on the English one when it has an English name.",
        h(
          "div",
          { class: "kp-formgrid" },
          row("Dutch name", nl, "What the parents' page on eten.kp-soft.dev says."),
          row("English name", en, "What Kitchen says."),
          row("Category", category, "Everyday, special, …; the parents' page can narrow the wheel to one."),
          row("Parents' wheel", parents, "Only dishes with this on stand on the parents' wheel."),
          row("Recipe", recipe, "The recipe to cook it from, if there is one."),
        ),
      ),
      sec(
        "Sides",
        "What comes with the dish. Switch Choice on for the sides to choose between, such as fries, croquettes or mash: the small wheel picks one of them when there are two or more. A side with Choice off always comes with the dish.",
        sides.el,
      ),
    )
  );
  openDrawer(dialog, {
    title: dish ? `Edit ${label(dish)}` : "Add a dish",
    text: dish ? "Change any field; nothing is saved until you press Save." : "Fill in what you know; every field can be changed later.",
    form,
    saveLabel: dish ? "Save the dish" : "Add the dish",
    onSave: async () => {
      const body = {
        ...(dish ?? {}),
        name: { nl: /** @type {HTMLInputElement} */ (nl).value.trim(), en: /** @type {HTMLInputElement} */ (en).value.trim() },
        category: category.value || null,
        parents: on(parents),
        recipe_id: recipe.value || null,
        sides: sides.get(),
      };
      if (!body.name.nl && !body.name.en) {
        /** @type {HTMLInputElement} */ (nl).focus();
        return { error: "A dish needs a name.", remedy: "Type its Dutch and its English name.", word: "Not saved" };
      }
      try {
        if (dish) await replace("dishes", body);
        else await create("dishes", body);
      } catch (e) {
        return { error: why(e), word: "Not saved" };
      }
      const only = languages(body);
      const where = only === "nl" ? "; it shows only on the Dutch wheel" : only === "en" ? "; it shows only on the English wheel" : "";
      toast(`${dish ? "Saved" : "Added"} ${label(body)}${where}`);
      return "Saved";
    },
  });
}

/**
 * Open the name editor for a category, or a new one.
 * @param {HTMLDialogElement} dialog
 * @param {{ list: "dish_categories", item: Item | null, items: Item[], noun: string, example: { nl: string, en: string } }} spec
 */
export function openNameEditor(dialog, { list, item, items, noun, example }) {
  const count = items.length;
  const n = names(item);
  const nl = input(n.nl, "text", { autocomplete: "off", lang: "nl", placeholder: example.nl });
  const en = input(n.en, "text", { autocomplete: "off", placeholder: example.en });
  const last = item ? count : count + 1;
  const position = h(
    "div",
    { class: "kp-quantity", "data-kp-quantity": true, "data-kp-quantity-min": "1", "data-kp-quantity-max": String(Math.max(1, last)), "data-kp-quantity-label": "Position" },
    h("input", { class: "kp-quantity__input", value: String(Math.min(item?.order ?? last, last)) }),
  );
  const form = /** @type {HTMLFormElement} */ (
    h(
      "form",
      { class: "kp-drawer__body rl-form", id: "dl-name-form", novalidate: true },
      sec(
        `The ${noun}`,
        `It shows in each language it has a name in.`,
        h(
          "div",
          { class: "kp-formgrid" },
          row("Dutch name", nl, "What the parents' page says."),
          row("English name", en, "What Kitchen says."),
          row("Position", position, "Where it stands in the list of categories."),
        ),
      ),
    )
  );
  openDrawer(dialog, {
    title: item ? `Edit ${label(item)}` : `Add a ${noun}`,
    text: "Nothing is saved until you press Save.",
    form,
    saveLabel: item ? `Save the ${noun}` : `Add the ${noun}`,
    onSave: async () => {
      const body = {
        ...(item ?? {}),
        name: { nl: /** @type {HTMLInputElement} */ (nl).value.trim(), en: /** @type {HTMLInputElement} */ (en).value.trim() },
        order: getQuantity(position),
      };
      if (!body.name.nl && !body.name.en) {
        /** @type {HTMLInputElement} */ (nl).focus();
        return { error: `A ${noun} needs a name.`, remedy: "Type its Dutch name, its English name or both.", word: "Not saved" };
      }
      try {
        const saved = item ? await replace(list, body) : await create(list, body);
        // The others close up around it, so the positions stay 1, 2, 3, … without a gap or a tie.
        const rest = ordered(items).filter((x) => x.id !== saved.id);
        rest.splice(Math.max(0, body.order - 1), 0, saved);
        for (const [i, x] of rest.entries()) if (x.order !== i + 1) await replace(list, { ...x, order: i + 1 });
      } catch (e) {
        return { error: why(e), word: "Not saved" };
      }
      toast(item ? `Saved ${label(body)}` : `Added ${label(body)}`);
      return "Saved";
    },
  });
}
