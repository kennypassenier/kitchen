// The recipes screen, `/recipes`: every recipe in one table, with Add, Edit
// and Delete, and the field that imports a recipe from a link. Built only from the package's parts: the page header, the
// data table with its own loading, empty and failed states, the editor page
// (js/pages/recipe-edit/) for Add, Edit and Duplicate and the typed
// confirmation for Delete.

// Split on 30/10/2026 (docs/agent/MODULARITY.md): template.js builds the page, rows.js the table rows.

import { loadKitchen, onKitchen, kitchenNow } from "../../api.js";
import { attachDataTables, attachMenuButtons, dataTable } from "/static/kp/dist/kp-themes.min.js";
import { newRecipe } from "../../recipe/edit-nav.js";
import { importAsk } from "../../recipe/import-plan.js";
import { t } from "../../i18n/index.js";
import { buildPage } from "./template.js";
import { wireImportField, paintContext } from "./import-field.js";
import { rowsFor } from "./rows.js";

/** @typedef {import("../../api.js").Kitchen} Kitchen */

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
  let alive = true;
  const ui = buildPage(ask);
  const { table, body, page } = ui;
  root.replaceChildren(page);
  const detach = attachDataTables(page);
  const handle = dataTable(table);
  handle?.busy({ text: t("recs.loading"), overlay: true });
  handle?.state("loading");
  wireOpeners(ui);
  const detachField = wireImportField(ui.field, ask.dishId);
  if (ask.focus) ui.field.url.focus();

  let detachMenus = () => {};
  /** @param {Kitchen} k */
  function show(k) {
    paintContext(ui.field, { dish: ask.dishId ? k.dishes.find((d) => d.id === ask.dishId) ?? null : null, site: ask.siteId ? (k.recipe_sources ?? []).find((s) => s.id === ask.siteId) ?? null : null });
    detachMenus();
    body.replaceChildren(...rowsFor(k));
    detachMenus = attachMenuButtons(body);
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
    detachMenus();
    detachField();
  };
}
