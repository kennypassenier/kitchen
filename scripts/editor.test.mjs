// node --test scripts/editor.test.mjs: the recipe editor's pure logic (web/js/recipe/editor/logic.js): step rows to steps,
// which rows count, the two times, the label and dish name, and the form read back into a recipe or a draft.
import test from "node:test";
import assert from "node:assert/strict";
import { namedOnly, timeOverride, liveRows, timesOf, stepFromFields, trackChoices, partnerChoices, tidyWith, labelOut, dishText, unresolvedOf, recipeBody } from "../web/js/recipe/editor/logic.js";

const fields = (extra = {}) => ({ id: "s1", track: "", text: "  Boil  ", say: " ", mins: 5, active: true, hasTimer: false, timerName: "", timerSeconds: "", uses: [], note: "", warn: false, mini: true, photos: [], start: "", partner: "", timerDefault: "Timer", ...extra });
const row = (id, text) => ({ id, text: { value: text }, get: () => ({ id, text }) });

test("a step row is trimmed and empty links become null", () => {
  const s = stepFromFields(fields());
  assert.equal(s.text, "Boil");
  assert.equal(s.say, "");
  assert.equal(s.track, null);
  assert.equal(s.with, null);
  assert.equal(s.start, null);
  assert.equal(s.timer, null);
  assert.equal(s.note_tone, "");
});

test("a timer needs the switch and a positive number of seconds; its name falls back to the default", () => {
  assert.deepEqual(stepFromFields(fields({ hasTimer: true, timerSeconds: "600" })).timer, { seconds: 600, name: "Timer" });
  assert.deepEqual(stepFromFields(fields({ hasTimer: true, timerSeconds: "90", timerName: " Pasta " })).timer, { seconds: 90, name: "Pasta" });
  assert.equal(stepFromFields(fields({ hasTimer: true, timerSeconds: "0" })).timer, null);
  assert.equal(stepFromFields(fields({ hasTimer: false, timerSeconds: "600" })).timer, null);
  assert.equal(stepFromFields(fields({ hasTimer: true, timerSeconds: "" })).timer, null);
});

test("start is a number from 0 up, the track and partner carry over, a warning sets the tone", () => {
  const s = stepFromFields(fields({ start: "-4", track: "p", partner: "s2", warn: true }));
  assert.equal(s.start, 0);
  assert.equal(s.track, "p");
  assert.equal(s.with, "s2");
  assert.equal(s.note_tone, "warning");
  assert.equal(stepFromFields(fields({ start: "12" })).start, 12);
  assert.equal(stepFromFields(fields({ start: "0" })).start, 0);
});

test("uses drop the empty pairs and keep the others in order", () => {
  const s = stepFromFields(fields({ uses: [["2", "eggs"], ["", ""], ["", "salt"], ["1 tbsp", ""]] }));
  assert.deepEqual(s.uses, [{ amount: "2", name: "eggs" }, { amount: "", name: "salt" }, { amount: "1 tbsp", name: "" }]);
});

test("liveRows keeps only the rows that have text, in order", () => {
  const rows = [row("a", "Chop"), row("b", ""), row("c", "Fry")];
  assert.deepEqual(liveRows(rows).map((r) => r.id), ["a", "c"]);
  assert.deepEqual(liveRows([]), []);
});

test("namedOnly drops unnamed tracks", () => {
  assert.deepEqual(namedOnly([{ id: "a", name: "Pasta" }, { id: "b", name: "" }, { id: "c" }]).map((t) => t.id), ["a"]);
});

test("the track options start with the meeting lane and name unnamed tracks", () => {
  assert.deepEqual(trackChoices([{ id: "p", name: "Pasta" }, { id: "q", name: "" }], { meet: "Together", unnamed: "Track" }), [["", "Together"], ["p", "Pasta"], ["q", "Track"]]);
});

test("the partner options leave out the step itself, number the others and cut the text at 40 characters", () => {
  const rows = [row("a", "Chop"), row("b", ""), row("c", "x".repeat(60))];
  assert.deepEqual(partnerChoices(rows, "b", { none: "None", unnamed: "Step" }), [["", "None"], ["a", "1. Chop"], ["c", `3. ${"x".repeat(40)}`]]);
  assert.equal(partnerChoices(rows, "z", { none: "None", unnamed: "Step" })[2][1], "2. Step");
});

test("tidyWith clears a partner that is gone or is the step itself", () => {
  const out = tidyWith([{ id: "a", with: "b" }, { id: "b", with: "gone" }, { id: "c", with: "c" }, { id: "d", with: null }]);
  assert.deepEqual(out.map((s) => s.with), ["b", null, null, null]);
});

test("times: computed from the steps, a typed override wins", () => {
  const steps = [{ id: "a", track: null, mins: 10, active: true }, { id: "b", track: null, mins: 20, active: false }];
  const none = timesOf({ minutes: 0, hands_on: 0 }, steps, [], { minutes: null, hands: null });
  assert.equal(none.total, 30);
  assert.equal(none.minutes, 30);
  assert.equal(none.hands_on, 10);
  assert.equal(none.minutes_override, null);
  const typed = timesOf({ minutes: 0, hands_on: 0 }, steps, [], { minutes: 45, hands: null });
  assert.equal(typed.minutes, 45);
  assert.equal(typed.minutes_override, 45);
  assert.equal(typed.total, 30);
});

test("times: no steps keeps the stored figures", () => {
  const t = timesOf({ minutes: 25, hands_on: 5 }, [], [], { minutes: null, hands: null });
  assert.equal(t.minutes, 25);
  assert.equal(t.hands_on, 5);
});

test("the Override switch starts on for a typed figure, or a stored one with nothing computed", () => {
  assert.equal(timeOverride(40, 30, 30), true);
  assert.equal(timeOverride(0, 30, 30), true);
  assert.equal(timeOverride(null, 0, 20), true);
  assert.equal(timeOverride(undefined, 30, 20), false);
  assert.equal(timeOverride(undefined, 0, 0), false);
});

test("labelOut: unchanged keeps both halves, cleared empties both, a new one fills the language and the missing half", () => {
  const r = { label: { nl: "Snel", en: "Quick" } };
  assert.deepEqual(labelOut(r, "Snel", "Snel", "nl"), { nl: "Snel", en: "Quick" });
  assert.deepEqual(labelOut(r, "  ", "Snel", "nl"), { nl: "", en: "" });
  assert.deepEqual(labelOut(r, "Lang", "Snel", "nl"), { nl: "Lang", en: "Quick" });
  assert.deepEqual(labelOut({}, "Fast", "", "en"), { nl: "Fast", en: "Fast" });
});

test("dishText: an existing dish in the screen language, else the other language, else the new dish's name", () => {
  const dishes = [{ id: "d1", name: { nl: "Pasta", en: "Pasta EN" } }, { id: "d2", name: { nl: "", en: "Soup" } }];
  assert.equal(dishText({ id: "d1", name: null }, dishes, "en"), "Pasta EN");
  assert.equal(dishText({ id: "d2", name: null }, dishes, "nl"), "Soup");
  assert.equal(dishText({ id: null, name: { nl: "Nieuw", en: "New" } }, dishes, "nl"), "Nieuw");
  assert.equal(dishText({ id: "gone", name: null }, dishes, "nl"), "");
});

test("unresolved lines are those with a proposal and no ingredient", () => {
  assert.deepEqual(unresolvedOf([{ ingredient: null, proposal: { text: "2 kiwis" } }, { ingredient: "i1", proposal: { text: "x" } }, { ingredient: null }]), ["2 kiwis"]);
});

const values = (extra = {}) => ({
  choice: { id: "d1", name: null }, label: { nl: "", en: "" }, shortTyped: " ", dishName: "Tomato soup", summary: " s ", source: " ", meals: ["dinner"], ing: ["tomato"],
  times: { minutes: 30, hands_on: 10, minutes_override: null, hands_on_override: null }, portions: 2, prep: "light", safe: false, gear: " pan ", lastNote: "", miniNote: "",
  trackRows: [{ id: "t", name: "Soup" }, { id: "u", name: "" }],
  ingredientRows: [[{ id: "l1", ingredient: "i1" }, 2, "pc", "Main"], [{ id: "l2", ingredient: null, proposal: { text: "a kiwi" } }, 1, "pc", "Main"], [{ id: "l3", ingredient: null }, null, "g", "Main"]],
  toolRows: [{ id: "x", name: "Pot" }, { id: "y", name: "" }],
  steps: [{ id: "a", text: "Boil", with: "gone" }, { id: "b", text: "", with: null }],
  photo: null, ...extra,
});

test("recipeBody: trims, falls back to the dish's first word for short, drops unnamed rows and unresolved lines", () => {
  const b = recipeBody({ id: "r1", name: "Soup" }, values());
  assert.equal(b.id, "r1");
  assert.equal(b.short, "Tomato");
  assert.equal(b.summary, "s");
  assert.equal(b.source, null);
  assert.equal(b.gear, "pan");
  assert.deepEqual(b.tracks, [{ id: "t", name: "Soup" }]);
  assert.deepEqual(b.tools, [{ id: "x", name: "Pot" }]);
  assert.deepEqual(b.ingredients, [{ id: "l1", ingredient: "i1", amount: 2, unit: "pc", group: "Main" }]);
  assert.deepEqual(b.steps, [{ id: "a", text: "Boil", with: null }]);
  assert.equal(b.minutes, 30);
  assert.equal(b.dish_id, "d1");
  assert.equal(b.new_dish, null);
});

test("recipeBody for a draft keeps imported lines the catalogue does not know", () => {
  const b = recipeBody({}, values(), true);
  assert.deepEqual(b.ingredients.map((i) => i.id), ["l1", "l2"]);
});

test("recipeBody: a typed short wins; a new dish carries its name; the preset rides along", () => {
  const b = recipeBody({ safe: true, dish_id: "old" }, values({ shortTyped: " Soup ", choice: { id: null, name: { nl: "Nieuw", en: "New" } } }));
  assert.equal(b.short, "Soup");
  assert.equal(b.dish_id, null);
  assert.deepEqual(b.new_dish, { nl: "Nieuw", en: "New" });
  assert.equal(b.safe, false);
});

test("recipeBody is stable: the same form gives the same draft text", () => {
  assert.equal(JSON.stringify(recipeBody({}, values(), true)), JSON.stringify(recipeBody({}, values(), true)));
});
