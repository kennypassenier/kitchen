// The recipes screen, `/recipes`: every recipe in one table, with Add, Edit
// and Delete. Built only from the package's parts: the page header, the
// data table with its own loading, empty and failed states, a drawer on the
// form grid for the editor (js/recipe/editor/) and the typed confirmation
// for Delete.

// Split on 30/10/2026 (docs/agent/MODULARITY.md): template.js builds the page, rows.js the table rows.

import { loadKitchen, onKitchen, kitchenNow } from "../../api.js";
import { attachDataTables, dataTable } from "/static/kp/js/datatable.js";
import { openEditor } from "../../recipe/editor/index.js";
import { openImport } from "../../recipe/import.js";
import { copyRecipe } from "../../recipe/duplicate.js";
import { t } from "../../i18n/index.js";
import { buildPage } from "./template.js";
import { rowsFor } from "./rows.js";

/** @typedef {import("../../api.js").Kitchen} Kitchen */

/** The main ingredients the recipes already name, for the editor's suggestions. */
const mainOptions = () => [...new Set((kitchenNow()?.recipes ?? []).flatMap((r) => r.ing ?? []))];

/** The Add, Import and Copy buttons open the editor drawer. @param {ReturnType<typeof buildPage>} ui */
function wireOpeners({ add, importer, empty, editor }) {
  const dialog = /** @type {HTMLDialogElement} */ (editor);
  /** @param {Record<string, any> | null} recipe */
  const openFor = (recipe) => openEditor(dialog, { recipe, mainOptions: mainOptions() });
  /** An editable copy of a recipe, in the same dish (Kenny, 29/10/2026). @param {Record<string, any>} recipe */
  const openCopy = (recipe) => openEditor(dialog, { recipe: null, preset: { ...copyRecipe(recipe), dish_id: recipe.dish_id }, copyOf: String(recipe.name ?? ""), mainOptions: mainOptions() });
  add.addEventListener("click", () => openFor(null));
  importer.addEventListener("click", () => openImport(dialog, { mainOptions: mainOptions() }));
  empty.querySelector("[data-rl-add]")?.addEventListener("click", () => openFor(null));
  return { edit: openFor, copy: openCopy };
}

/** @param {HTMLElement} root */
export function mount(root) {
  document.title = `${t("nav.recipes")} · Kitchen`;
  let alive = true;
  const ui = buildPage();
  const { table, body, editor, page } = ui;
  root.replaceChildren(page, editor);
  const detach = attachDataTables(page);
  const handle = dataTable(table);
  handle?.busy({ text: t("recs.loading"), overlay: true });
  handle?.state("loading");
  const on = wireOpeners(ui);

  /** @param {Kitchen} k */
  function show(k) {
    body.replaceChildren(...rowsFor(k, on));
    handle?.refresh({ keepPage: true });
    handle?.state("ready");
  }

  /** @param {boolean} [force] */
  async function load(force = false) {
    if (force || !kitchenNow()) {
      handle?.busy({ text: t("recs.loading"), overlay: true });
      handle?.state("loading");
    }
    try {
      const k = await loadKitchen({ force });
      if (alive) show(k);
    } catch (e) {
      if (alive) handle?.fail(e instanceof Error ? e.message : String(e));
    }
  }
  table.addEventListener("kp-datatable-retry", () => void load(true));
  const stop = onKitchen((k) => alive && show(k));
  void load();
  return () => {
    alive = false;
    stop();
    detach();
  };
}
