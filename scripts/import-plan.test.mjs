// node --test scripts/import-plan.test.mjs: an import becomes an unsaved draft for the editor page (web/js/recipe/import-plan.js).
import test from "node:test";
import assert from "node:assert/strict";
import { importInput, draftKeyFor, planImport, shouldOfferPaste, importHref, importAsk, failureOf } from "../web/js/recipe/import-plan.js";

const found = (extra = {}) => ({ name: "Carbonara", portions: 4, ingredients: ["200 g spaghetti", "1 handvol rucola"], steps: ["Kook de pasta 10 minuten.", "Meng alles."], minutes: { prep: 5, cook: 10, total: null }, image_url: "https://example.org/c.jpg", source_url: "https://example.org/carbonara", ...extra });
const catalogue = [{ id: "i1", name: { nl: "Spaghetti", en: "Spaghetti" } }];

test("a pasted text wins only when the fold is open and has text", () => {
  assert.deepEqual(importInput({ address: " https://a.example/x ", pasted: "", pasteOpen: false }), { ok: true, usePaste: false, body: { url: "https://a.example/x" } });
  assert.deepEqual(importInput({ address: "https://a.example", pasted: " Ingredients\n1 egg ", pasteOpen: true }), { ok: true, usePaste: true, body: { text: "Ingredients\n1 egg" } });
  assert.equal(importInput({ address: "https://a.example", pasted: "text", pasteOpen: false }).usePaste, false);
});

test("nothing typed is refused, not sent", () => {
  assert.deepEqual(importInput({ address: "  ", pasted: "", pasteOpen: false }), { ok: false });
  assert.deepEqual(importInput({ address: "", pasted: "   ", pasteOpen: true }), { ok: false });
});

test("the draft key is the one the editor page uses for a new recipe in that dish", () => {
  assert.equal(draftKeyFor("d1"), "new:d1");
  assert.equal(draftKeyFor(null), "new:");
});

test("the result is the editor's form state: label, source, portions, steps with minutes, lines matched or proposed", () => {
  const plan = planImport(found(), "d1", catalogue, "Main");
  assert.equal(plan.key, "new:d1");
  assert.equal(plan.cover, "https://example.org/c.jpg");
  const r = plan.restore;
  assert.equal(r.dish_id, "d1");
  assert.deepEqual(r.label, { nl: "Carbonara", en: "Carbonara" });
  assert.equal(r.source, "https://example.org/carbonara");
  assert.equal(r.portions, 4);
  assert.equal(r.steps.length, 2);
  assert.equal(r.steps[0].mins, 10);
  assert.equal(r.ingredients[0].ingredient, "i1");
  assert.equal(r.ingredients[1].ingredient, null);
  assert.ok(r.ingredients[1].proposal, "an unknown line is kept as a proposal, never dropped");
  assert.equal(r.minutes, undefined, "a step with minutes means no page total override");
});

test("without a dish the draft is for no dish; portions are kept inside 1 to 24; a page total is the override only when no step has minutes", () => {
  const plan = planImport(found({ portions: 99, steps: ["Meng alles."], minutes: { prep: null, cook: null, total: 30 }, source_url: "file:///etc/passwd", image_url: null }), null, catalogue, "Main");
  assert.equal(plan.key, "new:");
  assert.equal(plan.restore.dish_id, null);
  assert.equal(plan.restore.portions, 24);
  assert.equal(plan.restore.minutes_override, 30);
  assert.equal(plan.restore.source, undefined, "only a web address is kept as the source");
  assert.equal(plan.cover, null);
});

test("pasting the text is offered after the errors where a page cannot be read, and only before the text was used", () => {
  for (const code of ["no_recipe", "http_status", "not_html", "unreachable", "timeout", "too_large", "too_many_redirects"]) assert.equal(shouldOfferPaste(code, false), true, code);
  assert.equal(shouldOfferPaste("no_recipe", true), false);
  assert.equal(shouldOfferPaste("blocked_address", false), false);
});

test("the Recipes address that focuses the import field round-trips its dish and its source", () => {
  assert.equal(importHref(), "/recipes?import=1");
  const href = importHref({ dish: "d 1", site: "s1" });
  assert.equal(href, "/recipes?import=1&dish=d+1&site=s1");
  assert.deepEqual(importAsk(new URL(href, "http://x").searchParams), { focus: true, dishId: "d 1", siteId: "s1" });
  assert.deepEqual(importAsk(new URLSearchParams("")), { focus: false, dishId: null, siteId: null });
});

test("a dropped connection says so, not that the import failed", () => {
  assert.deepEqual(failureOf({ fromKitchen: true, code: "The connection to the kitchen dropped.", status: 0, usedPaste: false }), { key: "photo.dropped" });
  assert.deepEqual(failureOf({ fromKitchen: false, code: "", status: 0, usedPaste: true }), { key: "photo.dropped" });
});

test("no recipe points at the pasted text; other codes keep their own words", () => {
  assert.deepEqual(failureOf({ fromKitchen: true, code: "no_recipe", status: 422, usedPaste: false }), { key: "imp.fallback" });
  assert.deepEqual(failureOf({ fromKitchen: true, code: "no_recipe", status: 422, usedPaste: true }), { key: "imp.noText" });
  assert.deepEqual(failureOf({ fromKitchen: true, code: "timeout", status: 504, usedPaste: false }), { code: "timeout" });
});
