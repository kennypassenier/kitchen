// The recipes screen, `/recipes`: every recipe in one table, with Add, Edit
// and Delete, and the field that imports a recipe from a link. Built only from the package's parts: the page header, the
// data table with its own loading, empty and failed states, the editor page
// (js/pages/recipe-edit/) for Add, Edit and Duplicate and the typed
// confirmation for Delete.

// Split on 30/10/2026 (docs/agent/MODULARITY.md): template.js builds the page, rows.js the table rows.

import { attachDataTables, dataTable } from "/static/kp/dist/js/datatable.js";
import { newRecipe } from "../../recipe/edit-nav.js";
import { importAsk } from "../../recipe/import-plan.js";
import { t } from "../../i18n/index.js";
import { buildPage } from "./template.js";
import { wireImportField } from "./import-field.js";
import { bindRows } from "./table-state.js";

/** Add opens the editor page (Edit and Duplicate are the rows', rows.js); Import is the field above the table. @param {ReturnType<typeof buildPage>} ui */
function wireOpeners({ add, empty }) {
  add.addEventListener("click", () => newRecipe());
  empty.querySelector("[data-rl-add]")?.addEventListener("click", () => newRecipe());
}

/**
 * @param {HTMLElement} root
 * @param {{ params: URLSearchParams }} page `?import=1` focuses the import field (the sources page and a dish's page send people there)
 */
export function mount(root, { params }) {
  const ask = importAsk(params);
  document.title = `${t("nav.recipes")} · Kitchen`;
  const ui = buildPage(ask);
  const { table, page } = ui;
  root.replaceChildren(page);
  const detach = attachDataTables(page);
  const handle = dataTable(table);
  handle?.busy({ text: t("recs.loading"), overlay: true });
  handle?.state("loading");
  wireOpeners(ui);
  const detachField = wireImportField(ui.field, ask.dishId);
  if (ask.focus) ui.field.url.focus();

  const stopRows = bindRows(ui, ask, handle);
  return () => {
    stopRows();
    detach();
    detachField();
  };
}
