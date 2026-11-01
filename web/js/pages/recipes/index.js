// The recipes screen, `/recipes`: every recipe in one table, with Add, Edit
// and Delete. Built only from the package's parts: the page header, the
// data table with its own loading, empty and failed states, the editor page
// (js/pages/recipe-edit/) for Add, Edit and Duplicate and the typed
// confirmation for Delete.

// Split on 30/10/2026 (docs/agent/MODULARITY.md): template.js builds the page, rows.js the table rows.

import { loadKitchen, onKitchen, kitchenNow } from "../../api.js";
import { attachDataTables, dataTable } from "/static/kp/dist/kp-themes.min.js";
import { openImport } from "../../recipe/import.js";
import { newRecipe } from "../../recipe/edit-nav.js";
import { drawer } from "../../records/drawer.js";
import { t } from "../../i18n/index.js";
import { buildPage } from "./template.js";
import { rowsFor } from "./rows.js";

/** @typedef {import("../../api.js").Kitchen} Kitchen */

/** Add and Import. Edit and Duplicate are the rows' (rows.js); Add opens the editor page. @param {ReturnType<typeof buildPage>} ui */
function wireOpeners({ add, importer, empty }) {
  add.addEventListener("click", () => newRecipe());
  importer.addEventListener("click", () => openImport(drawer(), {}));
  empty.querySelector("[data-rl-add]")?.addEventListener("click", () => newRecipe());
}

/** @param {HTMLElement} root */
export function mount(root) {
  document.title = `${t("nav.recipes")} · Kitchen`;
  let alive = true;
  const ui = buildPage();
  const { table, body, page } = ui;
  root.replaceChildren(page);
  const detach = attachDataTables(page);
  const handle = dataTable(table);
  handle?.busy({ text: t("recs.loading"), overlay: true });
  handle?.state("loading");
  wireOpeners(ui);

  /** @param {Kitchen} k */
  function show(k) {
    body.replaceChildren(...rowsFor(k));
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
