// node --test scripts/bilingual.test.mjs: a step text or note in one or two languages (web/js/recipe/bilingual.js, Kenny,
// 30/10/2026: the other language is optional). Plain string = one text for both languages; {nl, en} only with both halves.
import test from "node:test";
import assert from "node:assert/strict";
import { pick, halves, combine, tidy, localStep } from "../web/js/recipe/bilingual.js";
import { stepFromFields } from "../web/js/recipe/editor/logic.js";

test("pick: a plain string is shown as it is in both languages", () => {
  assert.equal(pick("Kook de pasta", "en"), "Kook de pasta");
  assert.equal(pick("Kook de pasta", "nl"), "Kook de pasta");
});

test("pick: a translated text follows the language, a half-empty one falls back to the half it has", () => {
  const both = { nl: "Kook de pasta", en: "Cook the pasta" };
  assert.equal(pick(both, "nl"), "Kook de pasta");
  assert.equal(pick(both, "en"), "Cook the pasta");
  assert.equal(pick({ nl: "Kook de pasta", en: "" }, "en"), "Kook de pasta");
  assert.equal(pick({ nl: " ", en: "Cook" }, "nl"), "Cook");
});

test("pick: nothing there is an empty string, never undefined or 'undefined'", () => {
  for (const v of [undefined, null, {}, { nl: "", en: "" }, ""]) assert.equal(pick(v, "en"), "");
});

test("halves: the main field is the shown language, the other field is the other half", () => {
  const both = { nl: "Kook de pasta", en: "Cook the pasta" };
  assert.deepEqual(halves(both, "en"), { main: "Cook the pasta", other: "Kook de pasta" });
  assert.deepEqual(halves(both, "nl"), { main: "Kook de pasta", other: "Cook the pasta" });
});

test("halves: a plain string or a single half has no second text, and the editor shows the text there is", () => {
  assert.deepEqual(halves("Kook", "en"), { main: "Kook", other: "" });
  assert.deepEqual(halves({ nl: "Kook", en: "" }, "en"), { main: "Kook", other: "" });
  assert.deepEqual(halves(undefined, "nl"), { main: "", other: "" });
});

test("combine: both halves make {nl, en} in either editor language, one half stays a plain string", () => {
  assert.deepEqual(combine("Cook", "Kook", "en"), { nl: "Kook", en: "Cook" });
  assert.deepEqual(combine("Kook", "Cook", "nl"), { nl: "Kook", en: "Cook" });
  assert.equal(combine("  Kook ", "", "en"), "Kook");
  assert.equal(combine("", " Cook ", "nl"), "Cook");
  assert.equal(combine("", "", "nl"), "");
});

test("halves then combine round-trips every shape", () => {
  for (const v of ["Kook", "", { nl: "Kook", en: "Cook" }]) {
    for (const l of ["nl", "en"]) {
      const { main, other } = halves(v, l);
      assert.deepEqual(combine(main, other, l), v);
    }
  }
});

test("tidy trims either shape and drops an empty half", () => {
  assert.equal(tidy("  Kook "), "Kook");
  assert.deepEqual(tidy({ nl: " Kook ", en: " Cook " }), { nl: "Kook", en: "Cook" });
  assert.equal(tidy({ nl: "Kook", en: " " }), "Kook");
});

test("localStep: text and note become plain strings in the language, other fields pass through", () => {
  const s = { id: "a", mins: 5, text: { nl: "Kook", en: "Cook" }, note: { nl: "Let op", en: "Careful" }, note_tone: "warning" };
  assert.deepEqual(localStep(s, "en"), { ...s, text: "Cook", note: "Careful" });
  assert.deepEqual(localStep({ id: "b", text: "Kook" }, "en"), { id: "b", text: "Kook" });
});

test("stepFromFields keeps the shape the editor gives it: an object stays whole, a string is trimmed", () => {
  const fields = (extra) => ({ id: "a", track: "", text: "x", say: "", mins: 1, active: true, hasTimer: false, timerName: "", timerSeconds: "", timerDefault: "Timer", uses: [], note: "", warn: false, mini: true, photos: [], start: "", partner: "", ...extra });
  const s = stepFromFields(fields({ text: { nl: "Kook", en: "Cook" }, note: { nl: "Pas op", en: "Careful" } }));
  assert.deepEqual([s.text, s.note], [{ nl: "Kook", en: "Cook" }, { nl: "Pas op", en: "Careful" }]);
  assert.equal(stepFromFields(fields({ text: "  Kook ", note: " n " })).text, "Kook");
});
