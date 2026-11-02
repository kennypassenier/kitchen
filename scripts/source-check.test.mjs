// node --test scripts/source-check.test.mjs: how a recipe source was checked, in plain words (web/js/records/
// source-check.js, Kenny 02/11/2026 03:43, feat-source-text-1).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkedWith, checkedWithField } from "../web/js/records/source-check.js";

const OLD = "Real import fetch (POST /data/import) of https://www.simplyrecipes.com/recipes/perfect_guacamole/";

test("the old developer's sentence reads as an import of its recipe", () => {
  assert.deepEqual(checkedWith(OLD), { kind: "import", url: "https://www.simplyrecipes.com/recipes/perfect_guacamole/", label: "Perfect guacamole" });
});

test("a bare recipe address is an import of that recipe", () => {
  const c = checkedWith("https://dagelijksekost.vrt.be/gerechten/daube-varkenswangen-geglaceerde-wortel");
  assert.equal(c.kind, "import");
  assert.equal(c.label, "Daube varkenswangen geglaceerde wortel");
});

test("an address without a path is named by its host", () => {
  assert.equal(checkedWith("https://www.24kitchen.nl/").label, "24kitchen.nl");
});

test("typed words stay as typed, empty is nothing", () => {
  assert.deepEqual(checkedWith("Tried three recipes by hand"), { kind: "text", text: "Tried three recipes by hand" });
  assert.equal(checkedWith(""), null);
  assert.equal(checkedWith(undefined), null);
  assert.equal(checkedWith("   "), null);
});

test("the form starts from the bare address, never the old sentence", () => {
  assert.equal(checkedWithField(OLD), "https://www.simplyrecipes.com/recipes/perfect_guacamole/");
  assert.equal(checkedWithField("my own words"), "my own words");
});

test("every seeded site reads as an import with a name", () => {
  const seed = JSON.parse(readFileSync(new URL("../src/recipe_sources_seed.json", import.meta.url), "utf8"));
  assert.equal(seed.length, 6);
  for (const s of seed) {
    const c = checkedWith(s.verified_by);
    assert.equal(c?.kind, "import", s.name);
    assert.ok(c.label.length > 3, s.name);
    assert.ok(!/POST|fetch/.test(s.verified_by), `${s.name} still carries the developer's wording`);
  }
});
