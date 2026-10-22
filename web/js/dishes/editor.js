// The dish editor and the small name editor, both in the recipe editor's drawer on `.kp-formgrid`.
//
// A dish (docs/agent/DATA.md "dishes") is what lands on a plate: a Dutch and an English name, a category, whether it
// is on the parents' wheel, an optional recipe to cook it from, and its parts. A part is one kind from the part list
// ("Potatoes, rice or pasta", "Sauce", …) with the choices for this dish. Only a kind marked for the small wheel (the
// sides: potatoes, fries, rice, pasta) is picked by it; the rest is what comes with the dish. Every name has a Dutch
// and an English half, and a dish, part or choice shows on the wheel of each language it has a name in
// (src/parents.rs; Kenny, 22/10/2026 23:08).
//
// The name editor edits one part kind or one category: its two names, its position in the list and, for a kind,
// whether the small wheel picks it.

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
        "Parts",
        "What the dish is made of besides itself. The small wheel picks only from a part whose kind is marked for it, such as potatoes, rice or pasta, and only when it has two or more choices; the rest is what comes with the dish.",
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
      const only = languages(body);
      const where = only === "nl" ? "; it shows only on the Dutch wheel" : only === "en" ? "; it shows only on the English wheel" : "";
      toast(`${dish ? "Saved" : "Added"} ${label(body)}${where}`);
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
  const small = list === "dish_parts" ? toggle("Picked by the small wheel", item?.wheel === true) : null;
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
          row("Position", position, `Where it stands in the list of ${noun === "category" ? "categories" : "kinds of part"}.`),
          small ? row("Small wheel", small, "Sides such as potatoes, rice or pasta: the small wheel picks one of the dish's choices.") : null,
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
        ...(small ? { wheel: on(small) } : {}),
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
