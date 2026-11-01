// One opening of the editor page: the form in its scope, the kit's unsaved bar and contents list around it, Save, Discard,
// and leaving. A copy, an import or a restored draft starts as unsaved work (recipe/editor/index.js: no baseline).

import { attachContents, setContents, toast } from "/static/kp/dist/kp-themes.min.js";
import { h } from "../../dom.js";
import { t } from "../../i18n/index.js";
import { createEditor } from "../../recipe/editor/index.js";
import { leaveWith } from "../../recipe/editor/leaving.js";
import { SECTIONS } from "../../recipe/editor/sections.js";
import { clearHandoff } from "../../recipe/edit-handoff.js";
import { afterSave } from "../../recipe/edit-route.js";
import { reason } from "../../api.js";
import { createBar } from "./bar.js";

/** The contents list: each section, and the three lists inside the lists section one level down. */
const entries = () =>
  SECTIONS.flatMap((def) => [
    { id: def.id, label: t(def.title) },
    ...(def.key === "lists" ? [["rl-sec-tracks", "edit.tracks"], ["rl-sec-ingredients", "edit.ingredients"], ["rl-sec-tools", "edit.tools"]].map(([id, key]) => ({ id, label: t(key), level: 1 })) : []),
  ]);

/** The page heading and sentence for how the form started. @param {import("./start.js").Start} s */
function headingOf(s) {
  const name = String(s.recipe?.name ?? "");
  if (s.recipe) return [t("rec.editTitle", name), t("rec.editText")];
  if (s.copyOf) return [t("edit.copyTitle", s.copyOf), t("edit.copyText")];
  if (s.imported) return [t("imp.previewTitle"), t("imp.previewText")];
  return [t("list.recipes.add"), t("rec.addText")];
}

/**
 * @param {{ shell: ReturnType<typeof import("./template.js").buildShell>, start: import("./start.js").Start, mainOptions: string[], from: string | null, navigate: (href: string) => void }} o
 */
export function openSession({ shell, start, mainOptions, from, navigate }) {
  const { scope, alert } = shell;
  /** @type {ReturnType<typeof createEditor>} */
  let editor;
  let done = false;
  let saving = false;

  /** Build the form (the opening one, a restored draft, or the saved state after Discard) and put it in the scope. @param {Partial<import("./start.js").Start>} over */
  function show(over) {
    const s = { ...start, ...over };
    // The old sections' marks go first, so the bar counts again (a removed node is no attribute change).
    bar.refreshNow();
    editor?.dispose();
    editor = createEditor({ recipe: s.recipe, mainOptions, preset: s.preset, restore: s.restore, copyOf: s.copyOf, imported: s.imported, cover: s.cover, restoreWith: (data) => show({ restore: data, copyOf: "", imported: false, cover: null }) });
    alert.hidden = true;
    scope.replaceChildren(editor.form);
    editor.start();
    const [title, text] = headingOf(s);
    shell.title.textContent = title;
    shell.lede.textContent = text;
    document.title = `${title} · Kitchen`;
    setContents(shell.contents, entries());
    bar.refreshNow();
  }

  async function save() {
    if (saving) return;
    saving = true;
    alert.hidden = true;
    /** @type {Awaited<ReturnType<typeof editor.save>>} */
    let res;
    try {
      res = await editor.save();
    } catch (e) {
      res = { ok: false, section: "dish", message: reason(e) };
    }
    saving = false;
    if (!res.ok) {
      bar.saving(false);
      const def = SECTIONS.find((d) => d.key === res.section);
      alert.replaceChildren(h("div", { class: "kp-alert__body" }, h("strong", null, t("rec.notSaved")), ` ${def ? `${t(def.title)}: ` : ""}${res.message}`));
      alert.hidden = false;
      alert.scrollIntoView({ block: "center" });
      return;
    }
    done = true;
    clearHandoff(sessionStorage);
    bar.clean();
    toast(start.recipe ? t("rec.savedName", res.name) : t("rec.addedName", res.name));
    navigate(afterSave(from, res.id));
  }

  // Discard puts the form back as it opened. The changes are written to the draft first, so the draft offer above the
  // form brings them back: nothing is lost by a click.
  async function discard() {
    await editor.parts.draft.flush(true).catch((e) => console.error("keeping the draft", e));
    const preset = start.copyOf || start.imported ? { dish_id: start.preset.dish_id } : start.preset;
    show({ restore: null, copyOf: "", imported: false, cover: null, preset });
  }

  const bar = createBar({
    root: shell.root, bar: shell.bar, scope,
    changed: () => (editor ? editor.changed() : []),
    words: () => ({ was: start.recipe ? t("ep.wasSaved") : t("ep.wasNone"), now: t("ep.nowChanged") }),
    onSave: () => void save(),
    onDiscard: () => void discard(),
    onLeave: (path) => leaveWith(/** @type {HTMLElement} */ (document.activeElement ?? shell.bar), editor, () => { done = true; clearHandoff(sessionStorage); navigate(path); }),
  });
  const detachContents = attachContents(shell.root);
  show({});
  // The index is a fold on a phone and open beside the form on a desktop.
  shell.fold.open = matchMedia("(min-width: 64rem)").matches;
  return {
    /** Leaving by any other way (Back in the browser, a script): the work is kept as a draft. */
    close() {
      editor.dispose({ keep: !done && editor.dirty() });
      detachContents();
      bar.dispose();
    },
  };
}
