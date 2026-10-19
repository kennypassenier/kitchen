// The printable sheet: the recipe on paper, drawn into a frame the shape of
// A4 and printed from that same frame.
//
// The sheet is the package's own print look (the `@media print` rules of the
// stylesheet, the checklist with a box to tick per ingredient, the date of
// printing at the foot). A screen never matches `@media print`, so the frame
// gets the stylesheet with that condition turned into "all": what the frame
// shows is what the printer gets. The frame is its own document, so the app
// around it never prints.

import { setChecklistItems } from "/kp/js/checklist.js";
import { preparePrint } from "/kp/js/print.js";
import { amountOf } from "./amounts.js";

/** The package stylesheet with its print rules made unconditional, read once. @type {Promise<string> | null} */
let paperCss = null;

function loadPaperCss() {
  paperCss ??= fetch("/kp/dist/kp-themes.css", { credentials: "same-origin" })
    .then((res) => {
      if (!res.ok) throw new Error(String(res.status));
      return res.text();
    })
    .then((css) => css.replaceAll("@media print", "@media all"));
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

/**
 * Turn an empty iframe into the sheet.
 * @param {HTMLIFrameElement} frame
 * @returns {Promise<{ draw: (spec: SheetSpec) => void, option: (name: keyof PrintOptions, value: string) => void, print: () => void }>}
 */
export async function createSheet(frame) {
  const css = await loadPaperCss();
  await new Promise((resolve) => {
    frame.addEventListener("load", resolve, { once: true });
    frame.srcdoc = `<!doctype html><html lang="en" data-theme="formal"><head><meta charset="utf-8"><style>${FRAME}</style></head><body><h1></h1><p class="meta"></p><div class="kp-checklist" data-kp-checklist></div><h2></h2><ol></ol></body></html>`;
  });
  const win = /** @type {Window & typeof globalThis} */ (frame.contentWindow);
  const doc = /** @type {Document} */ (frame.contentDocument);
  const sheet = new win.CSSStyleSheet();
  sheet.replaceSync(css);
  doc.adoptedStyleSheets = [sheet];
  const list = /** @type {HTMLElement} */ (doc.querySelector(".kp-checklist"));
  /** @type {PrintOptions} */
  const options = { notes: "show", box: "square", groups: "keep", lines: "off" };
  /** @type {(() => void) | null} */
  let undo = null;

  const stamp = () => {
    undo?.();
    undo = preparePrint(doc, { timeZone: "Europe/Brussels" });
  };
  const apply = () => {
    list.setAttribute("data-kp-print-notes", options.notes);
    list.setAttribute("data-kp-print-box", options.box);
    list.setAttribute("data-kp-print-groups", options.groups);
    list.toggleAttribute("data-kp-print-notes-lines", options.lines === "on");
  };
  apply();

  return {
    draw({ recipe, portions, words, lang, total }) {
      doc.documentElement.lang = lang;
      const factor = portions / (recipe.portions || portions || 1);
      /** @type {HTMLElement} */ (doc.querySelector("h1")).textContent = recipe.name;
      /** @type {HTMLElement} */ (doc.querySelector(".meta")).textContent = `${words.forPortions(portions)} · ${words.total} ${total}`;
      const steps = /** @type {{ text: string }[]} */ (recipe.steps ?? []);
      const heading = /** @type {HTMLElement} */ (doc.querySelector("h2"));
      const ol = /** @type {HTMLElement} */ (doc.querySelector("ol"));
      heading.textContent = words.howTo;
      heading.hidden = ol.hidden = steps.length === 0;
      ol.replaceChildren(...steps.map((s) => Object.assign(doc.createElement("li"), { textContent: s.text })));
      const fallbackGroup = words.ingredients(portions).split(" ")[0];
      setChecklistItems(
        list,
        (recipe.ingredients ?? []).map((/** @type {import("./amounts.js").Ingredient} */ ing) => {
          const { text, unit } = amountOf(ing, factor, words);
          const amount = [text, unit].filter(Boolean).join(" ");
          return {
            id: ing.id,
            label: ing.name,
            detail: [amount, ing.note].filter(Boolean).join(". "),
            group: ing.group || fallbackGroup,
          };
        }),
      );
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
