// The recipes table's life: its rows from the kitchen, its loading and failed states, and the live refresh.

import { loadKitchen, onKitchen, kitchenNow } from "../../api.js";
import { attachMenuButtons } from "/static/kp/dist/js/menu-button.js";
import { t } from "../../i18n/index.js";
import { paintContext } from "./import-field.js";
import { rowsFor } from "./rows.js";

/** @typedef {import("../../api.js").Kitchen} Kitchen */

/**
 * Fill the table from the kitchen now and on every change; `ask` says which dish or site the import field names.
 * @param {ReturnType<typeof import("./template.js").buildPage>} ui
 * @param {{ dishId: string | null, siteId: string | null }} ask
 * @param {ReturnType<typeof import("/static/kp/dist/js/datatable.js").dataTable>} handle
 * @returns {() => void} stops it
 */
export function bindRows(ui, ask, handle) {
  const { table, body } = ui;
  let alive = true;
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
    detachMenus();
  };
}
