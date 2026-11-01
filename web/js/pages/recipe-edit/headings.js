// What the editor page says around the form: the contents list and the heading for how the form started.

import { t } from "../../i18n/index.js";
import { SECTIONS } from "../../recipe/editor/sections.js";

/** The contents list: each section, and the three lists inside the lists section one level down. */
export const entries = () =>
  SECTIONS.flatMap((def) => [
    { id: def.id, label: t(def.title) },
    ...(def.key === "lists" ? [["rl-sec-tracks", "edit.tracks"], ["rl-sec-ingredients", "edit.ingredients"], ["rl-sec-tools", "edit.tools"]].map(([id, key]) => ({ id, label: t(key), level: 1 })) : []),
  ]);

/** The page heading and sentence for how the form started. @param {import("./start.js").Start} s */
export function headingOf(s) {
  const name = String(s.recipe?.name ?? "");
  if (s.recipe) return [t("rec.editTitle", name), t("rec.editText")];
  if (s.copyOf) return [t("edit.copyTitle", s.copyOf), t("edit.copyText")];
  if (s.imported) return [t("imp.previewTitle"), t("imp.previewText")];
  return [t("list.recipes.add"), t("rec.addText")];
}

/** Write the heading, the sentence and the document title. @param {{ title: HTMLElement, lede: HTMLElement }} shell @param {import("./start.js").Start} s */
export function applyHeading(shell, s) {
  const [title, text] = headingOf(s);
  shell.title.textContent = title;
  shell.lede.textContent = text;
  document.title = `${title} · Kitchen`;
}
