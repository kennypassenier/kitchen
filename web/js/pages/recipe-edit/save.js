// Save of the editor page: one click at a time, the failure shown in the page's alert, a success leaving the page.

import { toast } from "/static/kp/dist/kp-themes.min.js";
import { h } from "../../dom.js";
import { t } from "../../i18n/index.js";
import { SECTIONS } from "../../recipe/editor/sections.js";
import { clearHandoff } from "../../recipe/edit-handoff.js";
import { afterSave } from "../../recipe/edit-route.js";
import { reason } from "../../api.js";

/** Put the refusal in the alert above the form and bring it into view. @param {HTMLElement} alert @param {{ section: string, message: string }} res */
function showFailure(alert, res) {
  const def = SECTIONS.find((d) => d.key === res.section);
  alert.replaceChildren(h("div", { class: "kp-alert__body" }, h("strong", null, t("rec.notSaved")), ` ${def ? `${t(def.title)}: ` : ""}${res.message}`));
  alert.hidden = false;
  alert.scrollIntoView({ block: "center" });
}

/**
 * The page's Save. `deps.editor()` and `deps.bar()` are read at the click, because Discard replaces the editor.
 * @param {{ alert: HTMLElement, start: import("./start.js").Start, from: string | null, navigate: (href: string) => void, editor: () => ReturnType<typeof import("../../recipe/editor/index.js").createEditor>, bar: () => ReturnType<typeof import("./bar.js").createBar>, onDone: () => void }} deps
 * @returns {() => Promise<void>}
 */
export function createSave({ alert, start, from, navigate, editor, bar, onDone }) {
  let saving = false;
  return async function save() {
    if (saving) return;
    saving = true;
    alert.hidden = true;
    /** @type {Awaited<ReturnType<ReturnType<typeof editor>["save"]>>} */
    let res;
    try {
      res = await editor().save();
    } catch (e) {
      res = { ok: false, section: "dish", message: reason(e) };
    }
    saving = false;
    if (!res.ok) {
      bar().saving(false);
      showFailure(alert, res);
      return;
    }
    onDone();
    bar().clean();
    toast(start.recipe ? t("rec.savedName", res.name) : t("rec.addedName", res.name));
    navigate(afterSave(from, res.id));
  };
}
