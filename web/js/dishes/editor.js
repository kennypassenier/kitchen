// The dish editor and the small name editor, both in the recipe editor's drawer on `.kp-formgrid`.
//
// A dish (docs/agent/DATA.md "dishes") is what lands on a plate: a Dutch and an English name, a category, whether it
// is on the parents' wheel, an optional recipe to cook it from, its fixed ingredients and its sides (Kenny,
// 24/10/2026 05:03, 05:15, 05:26, 05:27). The fixed ingredients always come with the dish (the stew itself, salad).
// A side is one or more ingredients that go together ("frieten en mayonaise", "kroketten met mayonaise"), with an
// optional label of its own; each side is one entry on the small wheel, which spins when the dish has two or more.
// The same ingredient may stand in several sides. Ingredients are chosen with js/ingredients/picker.js. Every name
// has a Dutch and an English half, and a dish shows on the wheel of each language it has a name in (src/parents.rs;
// Kenny, 22/10/2026 23:08).
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
import { ingredientsPicker } from "../ingredients/picker.js";
import { row, input, toggle, on, select } from "../recipe/editor.js";

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
export const sec = (title, text, ...body) => h("section", { class: "rl-formsec" }, h("h3", { class: "kp-fw-semibold" }, title), h("p", { class: "rl-formsec__text" }, text), ...body);

/**
 * Fill the drawer and open it.
 * @param {HTMLDialogElement} dialog
 * @param {{ title: string, text: string, form: HTMLFormElement, saveLabel: string, onSave: () => Promise<string | { error: string, remedy?: string, word: string }> }} spec
 */
export function openDrawer(dialog, { title, text, form, saveLabel, onSave }) {
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
 * The sides block: one bordered group per side, each with its ingredients, an optional label in both languages, Up,
 * Down and Remove; "Add a side" under them.
 * @param {Item[]} sides the dish's sides
 */
function sidesBlock(sides) {
  const box = h("div", { class: "dl-sides" });
  const groups = h("div", { class: "dl-sides__groups" });
  const none = h("p", { class: "rl-rows__empty" }, "No sides: the dish always comes the same way.");
  const addButton = h("button", { type: "button", class: "kp-button kp-button--sm" }, "Add a side");
  /** @type {{ el: HTMLElement, get: () => Item | null }[]} */
  let list = [];

  const sync = () => {
    none.hidden = list.length > 0;
    list.forEach((entry, i) => {
      const head = /** @type {HTMLElement} */ (entry.el.querySelector(".dl-side__title"));
      head.textContent = `Side ${i + 1}`;
      const [up, down] = /** @type {HTMLButtonElement[]} */ ([...entry.el.querySelectorAll("[data-dl-move]")]);
      up.disabled = i === 0;
      down.disabled = i === list.length - 1;
    });
    groups.replaceChildren(...list.map((e) => e.el));
  };
  /** @param {Item} side @param {boolean} [focus] */
  const push = (side, focus = false) => {
    const picker = ingredientsPicker(Array.isArray(side.ingredients) ? side.ingredients : [], { label: "Ingredients of the side" });
    const nl = input(String(side.label?.nl ?? ""), "text", { autocomplete: "off", lang: "nl", placeholder: "e.g. Kroketten met mayonaise", "aria-label": "Dutch label of the side" });
    const en = input(String(side.label?.en ?? ""), "text", { autocomplete: "off", placeholder: "e.g. Croquettes with mayonnaise", "aria-label": "English label of the side" });
    const up = h("button", { type: "button", class: "kp-button kp-button--sm", "data-dl-move": "up", "aria-label": "Move the side up" }, "Up");
    const down = h("button", { type: "button", class: "kp-button kp-button--sm", "data-dl-move": "down", "aria-label": "Move the side down" }, "Down");
    const remove = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--ghost" }, "Remove");
    const el = h(
      "div",
      { class: "dl-side" },
      h("div", { class: "dl-side__head" }, h("h4", { class: "kp-fw-semibold dl-side__title" }), h("div", { class: "kp-row-actions" }, up, down, remove)),
      h(
        "div",
        { class: "kp-formgrid kitchen-formgrid" },
        row("Ingredients", picker.el, "What goes together on this side; one entry on the small wheel."),
        row("Dutch label", nl, "Optional; without it the side reads as its ingredients."),
        row("English label", en, "Optional, as the Dutch label."),
      ),
    );
    const entry = {
      el,
      get: () => {
        const ingredients = picker.get();
        if (!ingredients.length) return null;
        const label = { nl: /** @type {HTMLInputElement} */ (nl).value.trim(), en: /** @type {HTMLInputElement} */ (en).value.trim() };
        return label.nl || label.en ? { ingredients, label } : { ingredients };
      },
    };
    const move = (/** @type {number} */ by) => {
      const at = list.indexOf(entry);
      const to = at + by;
      if (to < 0 || to >= list.length) return;
      list.splice(at, 1);
      list.splice(to, 0, entry);
      sync();
      (by < 0 ? up : down).focus();
    };
    up.addEventListener("click", () => move(-1));
    down.addEventListener("click", () => move(1));
    remove.addEventListener("click", () => {
      list = list.filter((e) => e !== entry);
      sync();
      addButton.focus();
    });
    list.push(entry);
    sync();
    if (focus) el.querySelector("input")?.focus();
  };
  for (const side of sides) push(side);
  addButton.addEventListener("click", () => push({ ingredients: [] }, true));
  box.append(groups, none, h("div", { class: "rl-rows__add" }, addButton));
  sync();
  return { el: box, get: () => /** @type {Item[]} */ (list.map((e) => e.get()).filter(Boolean)) };
}

/**
 * Open the editor for a dish, or for a new one.
 * @param {HTMLDialogElement} dialog
 * @param {{ dish: Item | null, categories: Item[], recipes: Item[] }} spec
 */
export function openDishEditor(dialog, { dish, categories, recipes }) {
  const d = dish ?? { name: { nl: "", en: "" }, category: categories[0]?.id ?? null, parents: true, recipe_id: null, ingredients: [], sides: [] };
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
  const fixed = ingredientsPicker(Array.isArray(d.ingredients) ? d.ingredients : [], { label: "Ingredients that always come with the dish" });
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
        "Always with it",
        "The ingredients that come with the dish every time, such as the stew itself or a salad.",
        h("div", { class: "kp-formgrid kitchen-formgrid" }, row("Ingredients", fixed.el, "Type to search; a new one can be added right here.")),
      ),
      sec(
        "Sides",
        "The choices that go with the dish: each side is one or more ingredients that go together, such as fries with mayonnaise. The small wheel picks one side when there are two or more; one side is simply named.",
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
        ingredients: fixed.get(),
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
 * Open the name editor for a dish category or an ingredient category, or a new one.
 * @param {HTMLDialogElement} dialog
 * @param {{ list: "dish_categories" | "ingredient_categories", item: Item | null, items: Item[], noun: string, example: { nl: string, en: string } }} spec
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
          row("Position", position, `Where it stands in the list of ${noun === "category" ? "categories" : "ingredient categories"}.`),
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
