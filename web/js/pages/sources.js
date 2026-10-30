// Recipe sources (/sources): the websites whose recipe pages the import reads well, so a recipe's address can be pasted
// from them without worry (Kenny, 29/10/2026 15:11: "een pagina toevoegen met links naar sites die het schema respecteren
// en waar ik dus zorgeloos de url van kan ingeven. links moeten in een nieuwe tab openen"). The list is the kitchen's own
// `recipe_sources` collection with full CRUD (Kenny, 15:12); a new kitchen, and a file from before the list, starts with
// the sites a real import proved (src/recipe_sources_seed.json). One card with the package's data table, filterable by
// language, and its loading, empty and failed states; every site link opens in a new tab.

import { h } from "../dom.js";
import { tableCard, itemLink, openRecordEditor, openRecipeImport, deleteRecord } from "../records/index.js";
import { pageHead, mountTables } from "../records/table-page.js";
import { dmy } from "../format.js";
import { externalLink, hostOf } from "../links.js";
import { t, textOf } from "../i18n/index.js";

/** The sources table card. */
function buildCard() {
  return tableCard({
    id: "sr-list",
    title: t("src.title"),
    lede: t("src.cardLede"),
    noun: t("src.noun"),
    plural: t("src.plural"),
    columns: [[t("src.name"), "text"], [t("src.site")], [t("src.language"), "text", "choice"], [t("src.comes")], [t("src.verified"), "number"], [t("src.actions")]],
    add: t("list.recipe_sources.add"),
    emptyTitle: t("src.emptyTitle"),
    emptyText: t("src.emptyText"),
  });
}

/** Import from this site, Edit and Delete. @param {Record<string, any>} s */
function actions(s) {
  const go = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": `${t("src.import")}: ${s.name}` }, t("src.import"));
  const edit = h("button", { type: "button", class: "kp-button kp-button--sm", "aria-label": t("rec.editName", s.name) }, t("common.edit"));
  const del = h("button", { type: "button", class: "kp-button kp-button--sm kp-button--destructive", "aria-label": t("rec.deleteName", s.name) }, t("common.delete"));
  go.addEventListener("click", () => openRecipeImport(null, s));
  edit.addEventListener("click", () => openRecordEditor("recipe_sources", s));
  del.addEventListener("click", () => deleteRecord(del, "recipe_sources", s));
  return h("div", { class: "kp-row-actions" }, go, edit, del);
}

/** @param {Record<string, any>} s */
function sourceRow(s) {
  const language = t(s.language === "nl" ? "src.nl" : "src.en");
  return h(
    "tr",
    { "data-kp-row-key": s.id },
    h("td", { "data-label": t("src.name") }, itemLink("recipe_sources", s)),
    h("td", { "data-label": t("src.site") }, externalLink(s.url, hostOf(s.url))),
    h("td", { "data-label": t("src.language"), "data-kp-filter-value": language }, language),
    h("td", { "data-label": t("src.comes") }, textOf(s.note) || "–"),
    h("td", { "data-label": t("src.verified"), "data-kp-sort-value": String(s.verified ? Date.parse(`${s.verified}T12:00:00Z`) : 0) }, s.verified ? dmy(s.verified) : t("src.none")),
    h("td", { "data-label": t("src.actions") }, actions(s)),
  );
}

/** @param {HTMLElement} root */
export function mount(root) {
  document.title = `${t("nav.sources")} · Kitchen`;
  const importer = h("button", { type: "button", class: "kp-button" }, t("imp.button"));
  const list = buildCard();
  const page = h("div", { class: "dl-page" }, pageHead({ title: t("nav.sources"), lede: t("src.lede"), actions: [importer] }), list.card);
  for (const b of list.addButtons) b.addEventListener("click", () => openRecordEditor("recipe_sources", null));
  importer.addEventListener("click", () => openRecipeImport());
  return mountTables({
    root,
    page,
    cards: [list],
    busyText: t("src.reading"),
    fill: (k) => {
      const sources = [...(k.recipe_sources ?? [])].sort((a, b) => String(a.name).localeCompare(String(b.name)));
      list.body.replaceChildren(...sources.map(sourceRow));
    },
  });
}
