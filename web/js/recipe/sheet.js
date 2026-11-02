// The printable sheet: the recipe on paper, drawn into a frame the shape of
// A4 and printed from that same frame.
//
// The sheet is the package's own print look (the `@media print` rules of the
// stylesheet, the checklist with a box to tick per ingredient, the date of
// printing at the foot). A screen never matches `@media print`, so the frame
// gets the stylesheet with that condition turned into "all": what the frame
// shows is what the printer gets. The frame is its own document, so the app
// around it never prints.

import { setChecklistItems } from "/static/kp/dist/js/checklist.js";
import { preparePrint } from "/static/kp/dist/js/print.js";
import { amountOf } from "./amounts.js";
import { pick } from "./bilingual.js";
import { ingredientName } from "../api.js";
import { ZONE } from "../format.js";
import { lang as appLang } from "../i18n/index.js";

/** The package's paper styles: the split delivery's base sheet, then the formal register the frame wears (the frame is
 * `data-theme="formal"`), in that order, as the page's own head links them. */
const PAPER_SHEETS = ["/static/kp/dist/kp-themes-base.min.css", "/static/kp/dist/css/formal-register.min.css"];

/** The package stylesheets with their print rules made unconditional, read once. @type {Promise<string> | null} */
let paperCss = null;

/** One stylesheet's text; a failed read names the file. @param {string} href */
async function sheetText(href) {
  const res = await fetch(href, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`${href}: ${res.status}`);
  return res.text();
}

function loadPaperCss() {
  paperCss ??= Promise.all(PAPER_SHEETS.map(sheetText)).then((parts) => parts.join("\n").replaceAll("@media print", "@media all"));
  paperCss.catch(() => (paperCss = null));
  return paperCss;
}

const FRAME = `
body { margin: 0; padding: 7% 8% 14%; font-size: 0.8rem; }
h1 { margin: 0 0 0.25rem; font-size: 1.35rem; }
.meta { margin: 0 0 1rem; color: #444; }
ol { margin: 1rem 0 0; padding-inline-start: 1.25rem; display: grid; gap: 0.4rem; }
h2 { margin: 1.25rem 0 0; font-size: 1rem; }
`;

/** @typedef {{ notes: string, box: string, groups: string, lines: string }} PrintOptions */

/**
 * @typedef {object} SheetSpec
 * @property {Record<string, any>} recipe
 * @property {number} portions
 * @property {import("./words.js").Words} words
 * @property {string} lang
 * @property {string} total the total time, written
 */

/** The sheet's document: heading, meta line, steps. @param {Document} doc @param {SheetSpec} spec */
function drawText(doc, { recipe, portions, words, total }) {
  /** @type {HTMLElement} */ (doc.querySelector("h1")).textContent = recipe.name;
  /** @type {HTMLElement} */ (doc.querySelector(".meta")).textContent = `${words.forPortions(portions)} · ${words.total} ${total}`;
  const steps = /** @type {{ text: import("./bilingual.js").Text }[]} */ (recipe.steps ?? []);
  const heading = /** @type {HTMLElement} */ (doc.querySelector("h2"));
  const ol = /** @type {HTMLElement} */ (doc.querySelector("ol"));
  heading.textContent = words.howTo;
  heading.hidden = ol.hidden = steps.length === 0;
  ol.replaceChildren(...steps.map((s) => Object.assign(doc.createElement("li"), { textContent: pick(s.text, appLang()) })));
}

/**
 * The ingredients as the package's checklist, scaled to the portions; returns the list now in the frame.
 *
 * The package draws only into an element of the page's own realm (`instanceof HTMLElement`), and the frame is another
 * window, so a list in the frame stayed empty and the sheet printed without its ingredients (found at the 6.0.0 release
 * checks, fix-sheet-checklist-1; kp-gaps/kitchen.md). The list is drawn in this page's document with the frame list's
 * attributes, then imported into the frame in place of the old one.
 * @param {Document} doc the frame's document @param {HTMLElement} list the frame's list @param {SheetSpec} spec
 */
function drawIngredients(doc, list, { recipe, portions, words }) {
  const host = document.createElement("div");
  for (const { name, value } of list.attributes) host.setAttribute(name, value);
  const factor = portions / (recipe.portions || portions || 1);
  const fallbackGroup = words.ingredients(portions).split(" ")[0];
  setChecklistItems(
    host,
    (recipe.ingredients ?? []).map((/** @type {import("./amounts.js").Ingredient} */ ing) => {
      const { text, unit } = amountOf(ing, factor, words);
      const amount = [text, unit].filter(Boolean).join(" ");
      return {
        id: ing.id,
        label: ingredientName(ing.ingredient, appLang()),
        detail: [amount, pick(ing.note, appLang())].filter(Boolean).join(". "),
        group: ing.group || fallbackGroup,
      };
    }),
  );
  const drawn = /** @type {HTMLElement} */ (doc.importNode(host, true));
  list.replaceWith(drawn);
  return drawn;
}

/** The empty iframe, loaded with the frame's own page and the package's paper styles. @param {HTMLIFrameElement} frame */
async function loadFrame(frame) {
  const css = await loadPaperCss();
  await new Promise((resolve) => {
    frame.addEventListener("load", resolve, { once: true });
    frame.srcdoc = `<!doctype html><html lang="en" data-theme="formal"><head><meta charset="utf-8"><style>${FRAME}</style></head><body><h1></h1><p class="meta"></p><div class="kp-checklist" data-kp-checklist></div><h2></h2><ol></ol></body></html>`;
  });
  const win = /** @type {Window & typeof globalThis} */ (frame.contentWindow);
  const doc = /** @type {Document} */ (frame.contentDocument);
  // The base sheet's fonts are relative (`../fonts/…`): without its own address as the base they resolved against the
  // page and 404'd at /fonts/ (two console errors on every /recipe, fix-paper-fonts-1). The register has no urls.
  const sheet = new win.CSSStyleSheet({ baseURL: new URL(PAPER_SHEETS[0], location.href).href });
  sheet.replaceSync(css);
  doc.adoptedStyleSheets = [sheet];
  return { win, doc };
}

/**
 * Turn an empty iframe into the sheet.
 * @param {HTMLIFrameElement} frame
 * @returns {Promise<{ draw: (spec: SheetSpec) => void, option: (name: keyof PrintOptions, value: string) => void, print: () => void }>}
 */
export async function createSheet(frame) {
  const { win, doc } = await loadFrame(frame);
  let list = /** @type {HTMLElement} */ (doc.querySelector(".kp-checklist"));
  /** @type {PrintOptions} */
  const options = { notes: "show", box: "square", groups: "keep", lines: "off" };
  /** @type {(() => void) | null} */
  let undo = null;
  const stamp = () => {
    undo?.();
    undo = preparePrint(doc, { timeZone: ZONE });
  };
  const apply = () => {
    list.setAttribute("data-kp-print-notes", options.notes);
    list.setAttribute("data-kp-print-box", options.box);
    list.setAttribute("data-kp-print-groups", options.groups);
    list.toggleAttribute("data-kp-print-notes-lines", options.lines === "on");
  };
  apply();
  return {
    draw(spec) {
      doc.documentElement.lang = spec.lang;
      drawText(doc, spec);
      list = drawIngredients(doc, list, spec);
      stamp();
    },
    option(name, value) {
      options[name] = value;
      apply();
    },
    print() {
      stamp();
      win.focus();
      win.print();
    },
  };
}
