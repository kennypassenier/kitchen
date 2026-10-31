// The editors of the named things: an ingredient and a recipe source (opened in the shared drawer).

import { getSegmentedValues } from "/static/kp/dist/kp-themes.min.js";
import { kitchenNow } from "../api.js";
import { t, lang, nameOf } from "../i18n/index.js";
import { row, input, select } from "../ui/form-parts.js";
import { today } from "../format.js";
import { ordered } from "../dishes/editor.js";
import { pair, choiceOf, dateField, openForm } from "./drawer.js";

/** @typedef {import("./lists.js").List} List */
/** @typedef {import("./lists.js").Item} Item */

/** @param {List} list @param {Item | null} item @param {Item} v */
export function openIngredientEditor(list, item, v) {
  const nl = input(String(v.name?.nl ?? ""), "text", { autocomplete: "off", lang: "nl", placeholder: t("rec.phIngNl") });
  const en = input(String(v.name?.en ?? ""), "text", { autocomplete: "off", placeholder: t("rec.phIngEn") });
  const cats = ordered(kitchenNow()?.ingredient_categories ?? []);
  const cat = select(cats.map((c) => /** @type {[string, string]} */ ([c.id, nameOf(c).text])), v.category ?? cats.find((c) => c.name?.en === "Other")?.id ?? cats[0]?.id ?? "", t("rec.category"));
  openForm({
    list,
    item,
    title: t("rec.ingTitle"),
    text: t("rec.ingText"),
    rows: [row(t("rec.dutchName"), nl, t("rec.dutchHint")), row(t("rec.englishName"), en, t("rec.englishHint")), row(t("rec.category"), cat, t("rec.ingCatHint"))],
    body: () => {
      const name = { nl: /** @type {HTMLInputElement} */ (nl).value.trim(), en: /** @type {HTMLInputElement} */ (en).value.trim() };
      if (!name.nl || !name.en) return { error: t(name.nl ? "ip.needEn" : "ip.needNl"), remedy: t("rec.fixName") };
      return { name, category: cat.value || null };
    },
    saved: (b) => t(item ? "rec.savedName" : "rec.addedName", nameOf(b).text),
  });
}

/** The fields of the source form. @param {Item} v */
function sourceFields(v) {
  const name = input(String(v.name ?? ""), "text", { autocomplete: "off", placeholder: t("src.name") });
  const url = input(String(v.url ?? ""), "text", { autocomplete: "off", inputmode: "url", placeholder: "https://…", spellcheck: "false" });
  const language = choiceOf({ nl: t("src.nl"), en: t("src.en") }, String(v.language ?? lang()), t("src.language"));
  const note = pair(v.note, "area", "");
  const verified = dateField(String(v.verified ?? ""), { max: today(), label: t("src.verified") });
  const how = input(String(v.verified_by ?? ""), "text", { autocomplete: "off" });
  return { name, url, language, note, verified, how };
}

/** Read the source form, or say what is wrong. @param {ReturnType<typeof sourceFields>} f */
function sourceBody({ name, url, language, note, verified, how }) {
  const n = /** @type {HTMLInputElement} */ (name).value.trim();
  const u = /** @type {HTMLInputElement} */ (url).value.trim();
  if (!n) return { error: t("src.errName"), remedy: t("src.fix") };
  if (!u) return { error: t("src.errUrl"), remedy: t("src.fix") };
  const text = note.get();
  if ((text.nl || text.en) && (!text.nl || !text.en)) return { error: t("rec.halfText", t("src.note")), remedy: t("src.fix") };
  const day = verified.get();
  if (day && day > today()) return { error: t("rec.errDay"), remedy: t("rec.fixDay") };
  return { name: n, url: u, language: getSegmentedValues(language)[0] ?? "nl", note: text, verified: day ?? "", verified_by: /** @type {HTMLInputElement} */ (how).value.trim() };
}

/** @param {List} list @param {Item | null} item @param {Item} v */
export function openSourceEditor(list, item, v) {
  const f = sourceFields(v);
  openForm({
    list,
    item,
    title: t("src.title"),
    text: t("src.cardLede"),
    rows: [
      row(t("src.name"), f.name, t("src.nameHint")),
      row(t("src.url"), f.url, t("src.urlHint")),
      row(t("src.language"), f.language, t("src.langHint")),
      row(t("rec.inNl", t("src.note")), f.note.nl, t("src.noteHint")),
      row(t("rec.inEn", t("src.note")), f.note.en, ""),
      row(t("src.verified"), f.verified.el, t("src.verifiedHint")),
      row(t("src.how"), f.how, t("src.howHint")),
    ],
    after: f.verified.start,
    body: () => sourceBody(f),
    saved: (b) => t(item ? "rec.savedName" : "rec.addedName", b.name),
  });
}
