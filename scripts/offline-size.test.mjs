// node --test scripts/offline-size.test.mjs: the offline copy's size as the settings row says it
// (web/js/offline/size.js, feat-offline-kitchen): the largest unit that keeps the number at 1 or more, one decimal at
// most, the page's decimal mark, and never "NaN".
import test from "node:test";
import assert from "node:assert/strict";
import { sizeText } from "../web/js/offline/size.js";

const plain = (s) => s.replace(/ | /g, " ");

test("bytes, kilobytes and megabytes, one decimal at most", () => {
  assert.equal(plain(sizeText(0, "en")), "0 bytes");
  assert.equal(plain(sizeText(512, "en")), "512 bytes");
  assert.equal(plain(sizeText(1536, "en")), "1.5 kB");
  assert.equal(plain(sizeText(50 * 1024 * 1024, "en")), "50 MB");
});

test("Dutch takes the comma", () => {
  assert.match(plain(sizeText(1.5 * 1024 * 1024, "nl")), /^1,5 MB$/);
});

test("a value that is not a size throws instead of showing NaN", () => {
  for (const bad of [-1, NaN, Infinity]) assert.throws(() => sizeText(bad, "en"), RangeError);
});
