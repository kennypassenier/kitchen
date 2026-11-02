// node --test scripts/paper-fonts.test.mjs: the print sheet's adopted stylesheet carries the base sheet's own address,
// so its relative font urls load from /static/kp/ instead of 404ing at /fonts/ (fix-paper-fonts-1).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the paper stylesheet is built with the base sheet's address as its baseURL", () => {
  const src = readFileSync(new URL("../web/js/recipe/sheet.js", import.meta.url), "utf8");
  assert.match(src, /new win\.CSSStyleSheet\(\{ baseURL: new URL\(PAPER_SHEETS\[0\], location\.href\)\.href \}\)/);
});
