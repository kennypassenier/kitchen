// The dish editor and the small name editor, both in the recipe editor's drawer on `.kp-formgrid`. A dish's recipes
// are its own (Kenny, 24/10/2026 09:18, 09:27) and are edited with the recipe editor from the dish's page; saving the
// dish here keeps them (the body spreads the dish).
//
// A dish (docs/agent/DATA.md "dishes") is what lands on a plate: a Dutch and an English name, a category, whether it
// is on the parents' wheel, its fixed ingredients and its sides (Kenny,
// 24/10/2026 05:03, 05:15, 05:26, 05:27). The fixed ingredients always come with the dish (the stew itself, salad).
// A side is one or more ingredients that go together ("frieten en mayonaise", "kroketten met mayonaise"), with an
// optional label of its own; each side is one entry on the small wheel, which spins when the dish has two or more.
// The same ingredient may stand in several sides. Ingredients are chosen with js/ingredients/picker.js. Every name
// has a Dutch and an English half, and a dish shows on the wheel of each language it has a name in (src/parents.rs;
// Kenny, 22/10/2026 23:08).
//
// A category has no editor here any more: it is edited in its table (records/category-table.js, Kenny 01/11/2026 20:21).
//
// Split on 30/10/2026 (docs/agent/MODULARITY.md): names.js (the name helpers), drawer.js (the drawer and `sec`), sides.js
// (the sides block). The old names are re-exported from here, so no importer changes.

import { toast } from "/static/kp/dist/kp-themes.min.js";
import { h } from "../dom.js";
import { create, replace, reason } from "../api.js";
import { ingredientsPicker } from "../ingredients/picker.js";
import { row, input, toggle, on, select } from "../ui/form-parts.js";
import { t } from "../i18n/index.js";
import { names, label, languages, ordered } from "./names.js";
import { sec, openDrawer } from "./drawer.js";
import { sidesBlock } from "./sides.js";

export { names, label, languages, ordered, sec, openDrawer };

/** @typedef {Record<string, any>} Item */

/** The dish's fields on the form grid. @param {Item} d @param {Item[]} categories */
function dishForm(d, categories) {
  const n = names(d);
  const f = {
    nl: input(n.nl, "text", { autocomplete: "off", lang: "nl", placeholder: "Stoofvlees" }),
    en: input(n.en, "text", { autocomplete: "off", placeholder: t("de.phEn") }),
    category: select([["", t("it.noCategory")], ...categories.map((c) => /** @type {[string, string]} */ ([c.id, label(c)]))], d.category ?? "", t("rec.category")),
    parents: toggle(t("it.onParents"), d.parents === true),
    fixed: ingredientsPicker(Array.isArray(d.ingredients) ? d.ingredients : [], { label: t("de.fixedAria") }),
    sides: sidesBlock(Array.isArray(d.sides) ? d.sides : []),
  };
  const form = /** @type {HTMLFormElement} */ (
    h(
      "form",
      { class: "kp-drawer__body rl-form", id: "dl-editor-form", novalidate: true },
      sec(
        t("de.dishTitle"),
        t("de.dishText"),
        h(
          "div",
          { class: "kp-formgrid" },
          row(t("rec.dutchName"), f.nl, t("de.nlHint")),
          row(t("rec.englishName"), f.en, t("rec.englishHint")),
          row(t("rec.category"), f.category, t("de.catHint")),
          row(t("it.parentsWheel"), f.parents, t("de.parentsHint")),
        ),
      ),
      sec(t("it.always"), t("de.alwaysText"), h("div", { class: "kp-formgrid kitchen-formgrid" }, row(t("nav.ingredients"), f.fixed.el, t("de.fixedHint")))),
      sec(t("it.sides"), t("de.sidesText"), f.sides.el),
    )
  );
  return { form, ...f };
}

/** Check the dish (every name in both languages, Kenny, 24/10/2026 10:04; a side's own label too), save it, say where it shows. @param {Item | null} dish @param {Item | null} from @param {ReturnType<typeof dishForm>} f */
async function saveDish(dish, from, f) {
  const { nl, en } = f;
  const body = {
    ...(dish ?? from ?? {}),
    name: { nl: /** @type {HTMLInputElement} */ (nl).value.trim(), en: /** @type {HTMLInputElement} */ (en).value.trim() },
    category: f.category.value || null,
    parents: on(f.parents),
    ingredients: f.fixed.get(),
    sides: f.sides.get(),
  };
  if (!body.name.nl || !body.name.en) {
    /** @type {HTMLInputElement} */ (body.name.nl ? en : nl).focus();
    return { error: t(body.name.nl ? "ip.needEn" : "ip.needNl"), remedy: t("de.dishFixName"), word: t("rec.notSaved") };
  }
  const halfLabel = body.sides.findIndex((/** @type {Item} */ s) => s.label && (!s.label.nl || !s.label.en));
  if (halfLabel >= 0) return { error: t("de.sideLabelHalf", halfLabel + 1), remedy: t("de.sideLabelFix"), word: t("rec.notSaved") };
  try {
    if (dish) await replace("dishes", body);
    else await create("dishes", body);
  } catch (e) {
    return { error: reason(e), word: t("rec.notSaved") };
  }
  const only = languages(body);
  const where = only === "nl" ? t("de.onlyNl") : only === "en" ? t("de.onlyEn") : "";
  toast(`${t(dish ? "rec.savedName" : "rec.addedName", label(body))}${where}`);
  return t("rec.saved");
}

/**
 * Open the editor for a dish, or for a new one. `from` is a copy of a dish (recipe/duplicate.js `copyDish`): the editor opens
 * on it as a new dish, and Save makes it (Kenny, 29/10/2026).
 * @param {HTMLDialogElement} dialog
 * @param {{ dish: Item | null, categories: Item[], from?: Item | null }} spec
 */
export function openDishEditor(dialog, { dish, categories, from = null }) {
  const d = dish ?? from ?? { name: { nl: "", en: "" }, category: categories[0]?.id ?? null, parents: true, recipes: [], ingredients: [], sides: [] };
  const f = dishForm(d, categories);
  openDrawer(dialog, {
    title: dish ? t("rec.editTitle", label(dish)) : from ? t("de.copyTitle", label(from)) : t("list.dishes.add"),
    text: dish ? t("rec.editText") : from ? t("de.copyText") : t("rec.addText"),
    form: f.form,
    saveLabel: dish ? t("de.saveDish") : t("list.dishes.addSave"),
    onSave: () => saveDish(dish, from, f),
  });
}
