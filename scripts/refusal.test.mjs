// node --test scripts/refusal.test.mjs: a size refusal mapped to a field message (web/js/api/refusal.js) and to the
// recipe editor's section (web/js/recipe/editor/sections.js), fix-field-limits-1.
import test from "node:test";
import assert from "node:assert/strict";
import { limitOf, fieldWords, limitWords, withinRecipe, FIELD_WORDS, ENTRY_WORDS, LIST_WORDS } from "../web/js/api/refusal.js";
import { sectionOf } from "../web/js/recipe/editor/sections.js";
import { EN as EN_CORE } from "../web/js/i18n/en.js";
import { NL as NL_CORE } from "../web/js/i18n/nl.js";
import { MAX_NAME_CHARS, MAX_TEXT_CHARS, MAX_STEPS } from "../web/js/limits.js";

/** The t() of one book, without the browser's i18n module. */
const words = (book) => (key, ...args) => {
  const w = book[key];
  assert.ok(w !== undefined, `missing word ${key}`);
  return typeof w === "function" ? w(...args) : String(w);
};
const en = words(EN_CORE);
const nl = words(NL_CORE);

test("only a size refusal with a field and a limit is read as one", () => {
  assert.deepEqual(limitOf({ error: "x", reason: "too_long", field: "name.nl", limit: 200 }), { reason: "too_long", field: "name.nl", limit: 200 });
  assert.equal(limitOf({ error: "name.en is empty" }), null);
  assert.equal(limitOf({ reason: "too_long", field: 3, limit: 200 }), null);
  assert.equal(limitOf(null), null);
  assert.equal(limitOf("too_long"), null);
});

test("a name half is named with its language, in both books", () => {
  const r = { reason: "too_long", field: "name.nl", limit: MAX_NAME_CHARS };
  assert.equal(limitWords(r, en), `Name (Dutch) is too long: at most ${MAX_NAME_CHARS} characters. Make it shorter and save again.`);
  assert.equal(limitWords(r, nl), `Naam (Nederlands) is te lang: hoogstens ${MAX_NAME_CHARS} tekens. Maak het korter en bewaar opnieuw.`);
});

test("a step's text is named by its number within the recipe and lands in the steps section", () => {
  const field = withinRecipe("recipes[2].steps[3].text.en");
  assert.equal(field, "steps[3].text.en");
  assert.equal(fieldWords(field, en), "step 4, text (English)");
  assert.equal(fieldWords(field, nl), "stap 4, tekst (Engels)");
  assert.equal(sectionOf(field), "steps");
  assert.equal(limitWords({ reason: "too_long", field, limit: MAX_TEXT_CHARS }, nl), `Stap 4, tekst (Engels) is te lang: hoogstens ${MAX_TEXT_CHARS} tekens. Maak het korter en bewaar opnieuw.`);
});

test("too many steps names the list; other fields find their section", () => {
  assert.equal(limitWords({ reason: "too_many", field: "steps", limit: MAX_STEPS }, en), `Too many steps: at most ${MAX_STEPS}. Remove some and save again.`);
  assert.equal(sectionOf("ingredients[0].note.nl"), "lists");
  assert.equal(sectionOf("last_note"), "notes");
  assert.equal(sectionOf("gear"), "time");
  assert.equal(sectionOf("name.nl"), "dish"); // a new dish's name
  assert.equal(fieldWords("odd[1].thing", en), "odd 2, thing"); // an unknown key is shown as it is
});

test("every word the mapping can ask for is in both books", () => {
  const keys = [...Object.values(FIELD_WORDS), ...Object.values(ENTRY_WORDS), ...Object.values(LIST_WORDS), "lim.lang.nl", "lim.lang.en", "lim.tooLong", "lim.tooMany"];
  for (const key of keys) {
    assert.ok(key in EN_CORE, `en lacks ${key}`);
    assert.ok(key in NL_CORE, `nl lacks ${key}`);
  }
});
