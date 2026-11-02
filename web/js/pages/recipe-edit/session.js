// One opening of the editor page: the form in its scope, the kit's unsaved bar and contents list around it, Save, Discard,
// and leaving. A copy, an import or a restored draft starts as unsaved work (recipe/editor/index.js: no baseline).

import { attachContents, setContents } from "/static/kp/dist/js/page-contents.js";
import { t } from "../../i18n/index.js";
import { createEditor } from "../../recipe/editor/index.js";
import { leaveWith } from "../../recipe/editor/leaving.js";
import { clearHandoff } from "../../recipe/edit-handoff.js";
import { createBar } from "./bar.js";
import { entries, applyHeading } from "./headings.js";
import { createSave } from "./save.js";

/**
 * @param {{ shell: ReturnType<typeof import("./template.js").buildShell>, start: import("./start.js").Start, mainOptions: string[], from: string | null, navigate: (href: string) => void }} o
 */
export function openSession({ shell, start, mainOptions, from, navigate }) {
  const { scope, alert } = shell;
  /** @type {ReturnType<typeof createEditor>} */
  let editor;
  let done = false;
  const save = createSave({ alert, start, from, navigate, editor: () => editor, bar: () => bar, onDone: () => { done = true; clearHandoff(sessionStorage); } });

  /** Build the form (the opening one, a restored draft, or the saved state after Discard) and put it in the scope. @param {Partial<import("./start.js").Start>} over */
  function show(over) {
    const s = { ...start, ...over };
    // The old sections' marks go first, so the bar counts again (a removed node is no attribute change).
    bar.refreshNow();
    editor?.dispose();
    editor = createEditor({ recipe: s.recipe, mainOptions, preset: s.preset, restore: s.restore, copyOf: s.copyOf, imported: s.imported, cover: s.cover, draftKey: s.draftKey, compare: s.compare ?? null, restoreWith: (data, key) => show({ restore: data, copyOf: "", imported: false, cover: null, draftKey: key, compare: editor.baseline }) });
    alert.hidden = true;
    scope.replaceChildren(editor.form);
    editor.start();
    applyHeading(shell, s);
    setContents(shell.contents, entries());
    bar.refreshNow();
  }

  // Discard puts the form back as it opened. The changes are written to the draft first, so the draft offer above the
  // form brings them back: nothing is lost by a click.
  async function discard() {
    await editor.parts.draft.flush(true).catch((e) => console.error("keeping the draft", e));
    const preset = start.copyOf || start.imported ? { dish_id: start.preset.dish_id } : start.preset;
    // The blank form after a copy's or an import's Discard is a blank new recipe with its own key: the kept draft stays
    // apart and is offered above the form (recipe/draft-keys.js).
    show({ restore: null, copyOf: "", imported: false, cover: null, preset, draftKey: "" });
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
