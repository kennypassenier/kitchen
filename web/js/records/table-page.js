// The shell the table screens share (/dishes, /ingredients, /sources, /log): a page header, and the data tables' life
// cycle: loading state, the one kitchen read, filling the rows, the retry, the kitchen's change events and the clean-up.

import { attachDataTables, dataTable } from "/static/kp/js/datatable.js";
import { loadKitchen, onKitchen, kitchenNow } from "../api.js";
import { h } from "../dom.js";

/** The page header: title, a sentence, and optional buttons on the right. @param {{ title: string, lede: string, actions?: Node[] }} o */
export function pageHead({ title, lede, actions = [] }) {
  return h(
    "header",
    { class: "kp-page-header" },
    h(
      "div",
      { class: "kp-page-header__inner" },
      h("div", null, h("h1", { class: "kp-page-header__title" }, title), h("p", { class: "kp-page-header__description" }, lede)),
      actions.length ? h("div", { class: "kp-page-header__actions" }, ...actions) : null,
    ),
  );
}

/**
 * Put the page in the root and keep its tables filled. Returns the clean-up.
 * @param {{ root: HTMLElement, page: HTMLElement, cards: { table: HTMLElement }[], busyText: string, busyAtOnce?: boolean, fill: (k: import("../api.js").Kitchen) => void }} o
 */
export function mountTables({ root, page, cards, busyText, busyAtOnce = false, fill }) {
  let alive = true;
  root.replaceChildren(page);
  const detach = attachDataTables(page);
  const handles = cards.map((c) => dataTable(c.table));
  const busy = () => {
    for (const handle of handles) {
      handle?.busy({ text: busyText, overlay: true });
      handle?.state("loading");
    }
  };
  if (busyAtOnce) busy();

  /** @param {import("../api.js").Kitchen} k */
  function show(k) {
    fill(k);
    for (const handle of handles) {
      handle?.refresh({ keepPage: true });
      handle?.state("ready");
    }
  }

  /** @param {boolean} [force] */
  async function load(force = false) {
    if (force || !kitchenNow()) busy();
    try {
      const k = await loadKitchen({ force });
      if (alive) show(k);
    } catch (e) {
      if (alive) for (const handle of handles) handle?.fail(e instanceof Error ? e.message : String(e));
    }
  }
  for (const c of cards) c.table.addEventListener("kp-datatable-retry", () => void load(true));
  const stop = onKitchen((k) => alive && show(k));
  void load();
  return () => {
    alive = false;
    stop();
    detach();
  };
}
