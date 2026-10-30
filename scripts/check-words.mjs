// Every word key a page reads with t("…") exists in both languages (web/js/i18n/en.js + en-pages.js, nl.js + nl-pages.js), and nl.js has no key
// en.js lacks. A key built at run time (t(`list.${list}.add`)) is checked for every list. Run: node scripts/check-words.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { EN as EN_CORE } from "../web/js/i18n/en.js";
import { NL as NL_CORE } from "../web/js/i18n/nl.js";
import { EN_PAGES } from "../web/js/i18n/en-pages.js";
import { NL_PAGES } from "../web/js/i18n/nl-pages.js";

const EN = { ...EN_CORE, ...EN_PAGES };
const NL = { ...NL_CORE, ...NL_PAGES };

const LISTS = ["recipes", "dishes", "dish_categories", "ingredients", "ingredient_categories", "freezer", "shelf", "log", "resting", "recipe_sources"];
const files = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : f.endsWith(".js") ? [join(dir, f)] : []));
const used = new Map();
for (const file of [...files("web/js"), ...files("web/eten")].filter((f) => !f.includes("/i18n/"))) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/\bt\(\s*"([a-zA-Z0-9_.-]+)"/g)) used.set(m[1], file);
  // format.js minutesWords(minutes, "<page>.hm", "<page>.min"): the two keys are passed as words, not read with t() at the call.
  for (const m of src.matchAll(/\bminutesWords\([^,()]+(?:\([^()]*\))?[^,()]*,\s*"([a-zA-Z0-9_.-]+)",\s*"([a-zA-Z0-9_.-]+)"/g)) { used.set(m[1], file); used.set(m[2], file); }
  for (const m of src.matchAll(/\bt\(\s*`list\.\$\{list\}\.([a-zA-Z]+)`/g)) for (const l of LISTS) used.set(`list.${l}.${m[1]}`, file);
  for (const m of src.matchAll(/\bt\(\s*`list\.\$\{list\}`/g)) for (const l of LISTS) used.set(`list.${l}`, file);
  for (const m of src.matchAll(/\bt\(\s*`list\.\$\{list\}\.(the|this)`/g)) for (const l of LISTS) used.set(`list.${l}.${m[1]}`, file);
}
const optional = /^list\.(recipes|dishes|freezer|shelf|log|resting|recipes|recipe_sources)\.inUse$/;
let bad = 0;
for (const [key, file] of used) {
  if (optional.test(key)) continue;
  for (const [name, book] of [["en", EN], ["nl", NL]]) if (!(key in book)) { console.log(`missing in ${name}: ${key} (${file})`); bad++; }
}
for (const key of Object.keys(NL)) if (!(key in EN)) { console.log(`only in nl: ${key}`); bad++; }
console.log(`${used.size} keys used, ${Object.keys(EN).length} in en, ${Object.keys(NL).length} in nl, ${bad} problems`);
process.exit(bad ? 1 : 0);
