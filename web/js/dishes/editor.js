// The dish editor and the small name editor, both in the recipe editor's drawer on `.kp-formgrid`.
//
// A dish (docs/agent/DATA.md "dishes") is what lands on a plate: a Dutch and an English name, a category, whether it
// is on the parents' wheel, an optional recipe to cook it from, and its parts. A part is one kind from the part list
// ("Potatoes and co.", "Sauce", …) with the choices for this dish; two or more choices are a choice the small wheel
// makes, one is simply how it comes ("with salad"). Every name has both languages, because a dish, a part or a choice
// with only one shows nowhere (src/parents.rs).
//
// The name editor edits one part kind or one category: its two names and its position in the list.

import { attachSegmented } from "/static/kp/js/segmented.js";
import { attachSelects, drawnSelect } from "/static/kp/js/combobox.js";
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
/** What a dish lacks before it may show, or "" when it has both names. @param {Item} dish */
export function missing(dish) {
  const n = names(dish);
  if (!n.nl && !n.en) return "both names";
  if (!n.nl) return "the Dutch name";
  if (!n.en) return "the English name";
  return "";
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
 * The parts block: one group per part of the dish, each a list of choices on two columns (Dutch, English), and an
 * Add a part control that offers the kinds not used yet.
 * @param {Item[]} kinds the part list, in order
 * @param {Item[]} parts the dish's parts
 */
function partsBlock(kinds, parts) {
  const box = h("div", { class: "dl-parts" });
  const groups = h("div", { class: "dl-parts__groups" });
  const none = h("p", { class: "rl-rows__empty" }, "No parts: the dish always comes the same way.");
  const pick = select([], "", "Kind of part to add");
  const addButton = h("button", { type: "button", class: "kp-button kp-button--sm" }, "Add the part");
  const adder = h("div", { class: "dl-parts__add" }, pick, addButton);
  /** @type {{ kind: string, el: HTMLElement, get: () => any[][] }[]} */
  let list = [];

  const sync = () => {
    none.hidden = list.length > 0;
    const free = kinds.filter((k) => !list.some((p) => p.kind === k.id));
    pick.replaceChildren(...free.map((k) => h("option", { value: k.id }, label(k))));
    drawnSelect(pick)?.refresh();
    adder.hidden = free.length === 0;
  };
  /** @param {string} kindId @param {{ nl: string, en: string }[]} choices @param {boolean} [focus] */
  const push = (kindId, choices, focus = false) => {
    const kind = kinds.find((k) => k.id === kindId);
    if (!kind) return;
    const choiceRows = rows({
      columns: [
        { label: "Dutch", width: "minmax(0, 1fr)", make: (/** @type {any} */ c) => textCell("Dutch name of the choice", c.nl ?? "", "Frieten") },
        { label: "English", width: "minmax(0, 1fr)", make: (/** @type {any} */ c) => textCell("English name of the choice", c.en ?? "", "Fries") },
      ],
      items: choices,
      add: "Add a choice",
      noun: "choice",
      blank: () => ({ nl: "", en: "" }),
    });
    const removePart = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--ghost" }, `Remove ${label(kind)}`);
    const el = h(
      "div",
      { class: "dl-part" },
      h("div", { class: "dl-part__head" }, h("h4", { class: "kp-fw-semibold" }, `${names(kind).nl} · ${names(kind).en}`), removePart),
      choiceRows.el,
    );
    const entry = { kind: kindId, el, get: choiceRows.get };
    removePart.addEventListener("click", () => {
      list = list.filter((p) => p !== entry);
      el.remove();
      sync();
      addButton.focus();
    });
    list.push(entry);
    groups.append(el);
    sync();
    if (focus) {
      el.querySelector(".rl-rows__add button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  };
  for (const p of parts) push(p.part, Array.isArray(p.choices) ? p.choices : []);
  addButton.addEventListener("click", () => {
    if (pick.value) push(pick.value, [], true);
  });
  box.append(groups, none, adder);
  sync();
  return {
    el: box,
    get: () =>
      list.map((p) => ({
        part: p.kind,
        choices: p.get().map(([nl, en]) => ({ nl, en })).filter((c) => c.nl || c.en),
      })),
  };
}

/**
 * Open the editor for a dish, or for a new one.
 * @param {HTMLDialogElement} dialog
 * @param {{ dish: Item | null, kinds: Item[], categories: Item[], recipes: Item[] }} spec
 */
export function openDishEditor(dialog, { dish, kinds, categories, recipes }) {
  const d = dish ?? { name: { nl: "", en: "" }, category: categories[0]?.id ?? null, parents: true, recipe_id: null, parts: [] };
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
  const parts = partsBlock(ordered(kinds), Array.isArray(d.parts) ? d.parts : []);
  const form = /** @type {HTMLFormElement} */ (
    h(
      "form",
      { class: "kp-drawer__body rl-form", id: "dl-editor-form", novalidate: true },
      sec(
        "The dish",
        "Both names are needed: a dish without its Dutch or its English name shows on neither wheel.",
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
        "Parts",
        "What the dish is made of besides itself. Two or more choices in a part are a choice the small wheel makes; one is how it always comes. A choice needs both names to show.",
        parts.el,
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
        parts: parts.get(),
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
      const lack = missing(body);
      toast(lack ? `Saved ${label(body)}; it shows nowhere until it has ${lack}` : dish ? `Saved ${label(body)}` : `Added ${label(body)}`);
      return "Saved";
    },
  });
}

/**
 * Open the name editor for a part kind or a category, or a new one.
 * @param {HTMLDialogElement} dialog
 * @param {{ list: "dish_parts" | "dish_categories", item: Item | null, items: Item[], noun: string, example: { nl: string, en: string } }} spec
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
        `Both names are needed: a ${noun} without one of them shows on neither wheel.`,
        h(
          "div",
          { class: "kp-formgrid" },
          row("Dutch name", nl, "What the parents' page says."),
          row("English name", en, "What Kitchen says."),
          row("Position", position, `Where it stands in the list of ${noun === "category" ? "categories" : "kinds of part"}.`),
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
      if (!body.name.nl || !body.name.en) {
        /** @type {HTMLInputElement} */ ((body.name.nl ? en : nl)).focus();
        return { error: `A ${noun} needs both names.`, remedy: "Type the Dutch and the English name.", word: "Not saved" };
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
