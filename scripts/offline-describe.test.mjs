// node --test scripts/offline-describe.test.mjs: the words of one refused edit in the failed list
// (web/js/offline/describe.js, feat-offline-kitchen): what it changed, when, and why the kitchen refused it.
import test from "node:test";
import assert from "node:assert/strict";
import { whatOf, whenOf, whyOf } from "../web/js/offline/describe.js";

const t = (key, ...args) => `<${key}${args.length ? `:${args.join("|")}` : ""}>`;
const kitchen = { dishes: [{ id: "d1", name: { nl: "Stoofvlees", en: "Beef stew" } }], shelf: [{ id: "s1", name: { nl: "Brood", en: "" } }] };

test("a dish change is named from the edit's own body, in the page's language", () => {
  const edit = { method: "PUT", path: "/data/dishes/d1", body: { name: { nl: "Stoverij", en: "Carbonade" } } };
  assert.equal(whatOf(edit, kitchen, t, "en"), "<off.whatChange:<off.whatItem:<list.dishes>|Carbonade>>");
  assert.equal(whatOf(edit, kitchen, t, "nl"), "<off.whatChange:<off.whatItem:<list.dishes>|Stoverij>>");
});

test("a delete is named from the kitchen as the page holds it, the other half standing in", () => {
  assert.equal(whatOf({ method: "DELETE", path: "/data/shelf/s1" }, kitchen, t, "en"), "<off.whatDelete:<off.whatItem:<list.shelf>|Brood>>");
});

test("settings, a nameless item and an edit Kitchen does not know", () => {
  assert.equal(whatOf({ method: "PATCH", path: "/data/settings", body: { lang: "nl" } }, kitchen, t, "en"), "<off.whatSettings>");
  assert.equal(whatOf({ method: "DELETE", path: "/data/log/x" }, null, t, "en"), "<off.whatDelete:<list.log>>");
  assert.equal(whatOf({ method: "POST", path: "/data/log" }, kitchen, t, "en"), "<off.whatUnknown>");
});

test("why: the kit's stale 409, else the kitchen's own words, else its status", () => {
  assert.equal(whyOf({ method: "PUT", path: "/data/dishes/d1", conflict: { status: 409, body: { code: "stale", rev: 4 } } }, t), "<off.failedWhyStale>");
  assert.equal(whyOf({ method: "PUT", path: "/x", conflict: { status: 404, body: { error: "that item does not exist (any more)" } } }, t), "<off.failedWhyOther:that item does not exist (any more)>");
  assert.equal(whyOf({ method: "PUT", path: "/x", conflict: { status: 422, body: null } }, t), "<off.failedWhyOther:422>");
});

test("when: dd/mm/yyyy HH:mm in Brussels time, or nothing when the kit did not say", () => {
  assert.equal(whenOf({ method: "PUT", path: "/x", at: Date.UTC(2026, 10, 2, 17, 5) }, t), "<off.failedWhen:02/11/2026 18:05>");
  assert.equal(whenOf({ method: "PUT", path: "/x" }, t), "");
});

// feat-offline-take-1 (written 02/11/2026, not run): a refused freezer take is named by its dish.
test("a refused freezer take is named by the freezer item's dish", () => {
  const withFreezer = { ...kitchen, freezer: [{ id: "f1", dish: { nl: "Soep", en: "Soup" } }] };
  const edit = { method: "POST", path: "/data/freezer/f1/take", body: { portions: 1 } };
  assert.equal(whatOf(edit, withFreezer, t, "en"), "<off.whatTake:Soup>");
  assert.equal(whatOf({ ...edit, path: "/data/freezer/gone/take" }, withFreezer, t, "nl"), "<off.whatTakeUnnamed>");
});
