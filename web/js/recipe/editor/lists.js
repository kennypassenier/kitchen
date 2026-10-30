// Tracks, ingredient lines and tools: the repeatable lists of a recipe, and the warning about imported lines
// without an ingredient (Kenny, 29/10/2026).

import { h } from "../../dom.js";
import { t } from "../../i18n/index.js";
import { input, select, rows, textCell } from "../../ui/form-parts.js";
import { ingredientPicker, ingredientsPicker } from "../../ingredients/picker.js";
import { unresolvedOf } from "./logic.js";
import { newId } from "./ids.js";
import { UNITS, groups, unitName } from "./consts.js";

/** A one-column list of named things (tracks, tools). @param {{ label: string, cell: string, ph: string }} w */
const nameColumn = ({ label, cell, ph }) => ({
  label,
  width: "minmax(0, 1fr)",
  make: (/** @type {any} */ tk) => {
    const c = textCell(cell, tk.name ?? "", ph);
    return { el: c.el, get: () => ({ id: tk.id ?? (tk.id = newId()), name: c.get() }) };
  },
});

/** An imported line the catalogue did not know (Kenny, 29/10/2026 14:27): what the page said, and two explicit actions: add it as a new ingredient (the picker's own step, both names required) or discard the line. Save is blocked while such a line stands (the alert above the list lists them). It goes once the line has an ingredient. @param {any} i @param {ReturnType<typeof ingredientPicker>} c @param {HTMLElement} cell */
function proposalNote(i, c, cell) {
  const addNew = h("button", { type: "button", class: "kp-button kp-button--sm" }, t("imp.addNew"));
  const discard = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--ghost" }, t("imp.discard"));
  const note = h("div", { class: "ri-proposal" }, h("p", { class: "ri-proposal__text" }, t("imp.fromPage", i.proposal.text)), h("div", { class: "kp-row-actions" }, addNew, discard));
  addNew.addEventListener("click", () => c.startNew(String(i.proposal.name ?? "")));
  discard.addEventListener("click", () => /** @type {HTMLElement | null} */ (cell.closest(".rl-row")?.querySelector(".rl-row__remove"))?.click());
  const settle = () => void (note.hidden = Boolean(c.get()));
  for (const type of ["input", "change", "kp-combobox-change"]) cell.addEventListener(type, () => setTimeout(settle, 0));
  cell.append(note);
}

/** The ingredient cell: the picker, the line's remark (shown on the recipe page) and, for an unresolved import line, its proposal. */
const ingredientColumn = () => ({
  label: t("edit.ingredient"),
  width: "minmax(0, 1fr)",
  make: (/** @type {any} */ i) => {
    const c = ingredientPicker(i.ingredient ?? null, { label: t("edit.ingredient") });
    // A remark about the line ("chopped", "schil en sap"; an import fills it from the brackets), shown on the recipe page.
    const noteField = input(i.note ?? "", "text", { "aria-label": t("edit.lineNote"), placeholder: t("edit.lineNotePh"), autocomplete: "off" });
    const cell = h("div", { class: "ri-cell" }, c.el, noteField);
    if (i.proposal) proposalNote(i, c, cell);
    return {
      el: cell,
      get: () => {
        const ingredient = c.get();
        const text = /** @type {HTMLInputElement} */ (noteField).value.trim();
        return { ...i, id: i.id ?? (i.id = newId()), ingredient, note: text || undefined, proposal: ingredient ? undefined : i.proposal };
      },
    };
  },
});

const amountColumn = () => ({
  label: t("edit.amount"),
  width: "6rem",
  make: (/** @type {any} */ i) => {
    const el = input(i.amount ?? "", "number", { "aria-label": t("edit.amount"), step: "any", min: "0", inputmode: "decimal" });
    return { el, get: () => (/** @type {HTMLInputElement} */ (el).value === "" ? null : Number(/** @type {HTMLInputElement} */ (el).value)) };
  },
});

const unitColumn = () => ({
  label: t("edit.unit"),
  width: "8rem",
  make: (/** @type {any} */ i) => {
    const el = select([...new Set([...UNITS, i.unit].filter(Boolean))].map((u) => [u, unitName(u)]), i.unit ?? "g", t("edit.unit"));
    return { el, get: () => el.value };
  },
});

/** @param {Record<string, any>} r */
const listColumn = (r) => ({
  label: t("edit.list"),
  width: "14rem",
  make: (/** @type {any} */ i) => {
    const el = select([...new Set([...groups(), ...(r.ingredients ?? []).map((/** @type {any} */ x) => x.group), i.group].filter(Boolean))].map((g) => [g, g]), i.group ?? groups()[0], t("edit.whichList"));
    return { el, get: () => el.value };
  },
});

/** Several ingredients at once (Kenny, 24/10/2026 10:14): pick them in one go, then each becomes its own line with its own amount; a new one can be added right in the picker, as in the lines. @param {ReturnType<typeof rows>} ingredients */
function manyBlock(ingredients) {
  const many = ingredientsPicker([], { label: t("edit.manyLabel") });
  const manyAdd = h("button", { type: "button", class: "kp-button kp-button--sm" }, t("edit.manyAdd"));
  manyAdd.addEventListener("click", () => {
    const ids = many.get();
    for (const id of ids) ingredients.add({ ingredient: id, amount: null, unit: "g", group: groups()[0] });
    if (ids.length) many.clear();
  });
  return h("div", { class: "rl-many" }, many.el, manyAdd);
}

/** Imported lines still without an ingredient (Kenny, 29/10/2026): listed in a warning above the lines, and Save is blocked until each one is added as a new ingredient, given an ingredient, or discarded. @param {ReturnType<typeof rows>} ingredients */
function unresolvedPanel(ingredients) {
  const unresolvedBox = h("div", { class: "kp-alert kp-alert--warning ri-unresolved", role: "status", hidden: true });
  const unresolvedLines = () => unresolvedOf(ingredients.get().map(([n]) => n));
  const paintUnresolved = () => {
    const lines = unresolvedLines();
    unresolvedBox.hidden = lines.length === 0;
    if (lines.length) unresolvedBox.replaceChildren(h("div", { class: "kp-alert__body" }, h("strong", null, t("imp.unresolvedTitle", lines.length)), " ", t("imp.unresolvedText"), h("ul", { class: "ri-unresolved__list" }, ...lines.slice(0, 6).map((l) => h("li", null, l)), lines.length > 6 ? h("li", null, t("imp.more", lines.length - 6)) : null)));
  };
  return { unresolvedBox, unresolvedLines, paintUnresolved };
}

/** A repeatable list under its own small heading and sentence. @param {string} title @param {string} text @param {...HTMLElement} els */
const listBlock = (title, text, ...els) => h("div", { class: "rl-list" }, h("h4", { class: "kp-fw-semibold" }, title), h("p", { class: "rl-formsec__text" }, text), ...els);

/** @param {Record<string, any>} r the recipe as it was */
export function listFields(r) {
  const tracks = rows({ columns: [nameColumn({ label: t("edit.trackName"), cell: t("edit.trackName"), ph: t("edit.trackPh") })], items: r.tracks ?? [], add: t("edit.addTrack"), noun: "track", blank: () => ({ name: "" }) });
  const ingredients = rows({
    columns: [ingredientColumn(), amountColumn(), unitColumn(), listColumn(r)],
    items: r.ingredients ?? [], add: t("list.ingredients.add"), noun: "ingredient", blank: () => ({ ingredient: null, amount: null, unit: "g", group: groups()[0] }),
  });
  const tools = rows({ columns: [nameColumn({ label: t("edit.tool"), cell: t("edit.toolName"), ph: t("edit.toolPh") })], items: r.tools ?? [], add: t("edit.addTool"), noun: "tool", blank: () => ({ name: "" }) });
  const { unresolvedBox, unresolvedLines, paintUnresolved } = unresolvedPanel(ingredients);
  const lists = h(
    "div",
    { class: "rl-lists" },
    listBlock(t("edit.tracks"), t("edit.tracksHint"), tracks.el),
    listBlock(t("edit.ingredients"), t("edit.ingredientsHint"), unresolvedBox, manyBlock(ingredients), ingredients.el),
    listBlock(t("edit.tools"), t("edit.toolsHint"), tools.el),
  );
  return { el: lists, tracks, ingredients, tools, unresolvedBox, unresolvedLines, paintUnresolved };
}
