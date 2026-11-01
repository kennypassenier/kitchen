// The recipe editor, `/recipe/edit` (ux-editor-page-1, Kenny 01/11/2026): the editor is its own page, not a drawer.
// The address is read by recipe/edit-route.js (`?id=` to edit, `?new=1` / `?dish=` for a new recipe, `&start=copy|import`
// for a handoff, `&from=` for where Save returns to). The page is the kit's page header, its unsaved-changes bar and its
// "On this page" list around the sections the drawer had (js/recipe/editor/). Leaving a changed form asks Keep as
// draft / Discard (recipe/editor/leaving.js).

import { attachCardStates, setCardState, CARD_RETRY_EVENT } from "/static/kp/dist/kp-themes.min.js";
import { loadKitchen, reason } from "../../api.js";
import { t } from "../../i18n/index.js";
import { parseEdit, backTarget, safeReturn } from "../../recipe/edit-route.js";
import { buildShell, notFoundPlate } from "./template.js";
import { resolveStart, mainOptionsOf } from "./start.js";
import { openSession } from "./session.js";

/**
 * @param {HTMLElement} root
 * @param {{ params: URLSearchParams, navigate: (href: string) => void }} page
 */
export function mount(root, { params, navigate }) {
  const target = parseEdit(params);
  const from = safeReturn(params.get("from"));
  const shell = buildShell(backTarget(target, from));
  document.title = `${t("ep.opening")} · Kitchen`;
  root.replaceChildren(shell.root);
  const detachCards = attachCardStates(shell.root);
  /** @type {{ close: () => void } | null} */
  let session = null;
  let alive = true;

  /** @param {boolean} [force] */
  async function open(force = false) {
    setCardState(shell.plate, "loading", { words: t("ep.opening") });
    try {
      const k = await loadKitchen({ force });
      const start = await resolveStart(target, k, sessionStorage);
      if (!alive) return;
      if (start.missing) {
        shell.title.textContent = t("ep.notFoundTitle");
        setCardState(shell.plate, "ready");
        shell.plate.querySelector(".kp-card__data")?.replaceChildren(notFoundPlate());
        return;
      }
      shell.plate.remove();
      session = openSession({ shell, start, mainOptions: mainOptionsOf(k), from, navigate });
    } catch (e) {
      if (alive) setCardState(shell.plate, "error", { title: t("ep.failedTitle"), text: reason(e) });
    }
  }
  shell.plate.addEventListener(CARD_RETRY_EVENT, () => void open(true));
  void open();
  return () => {
    alive = false;
    session?.close();
    detachCards();
  };
}
