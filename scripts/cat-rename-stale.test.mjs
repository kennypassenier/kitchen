// node --test scripts/cat-rename-stale.test.mjs: a category renamed in its table cell answers a stale refusal with the
// shared stale toast and Reload (web/js/api/stale-notice.js `noticeIfStale`), like every other quick save
// (fix-cat-rename-stale-1). The modules import the kit bundle, so the wiring is read from the source.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("the cell's save goes through noticeIfStale and still hands the error to the cell", () => {
  const src = read("web/js/records/category-table.js");
  assert.match(src, /import \{[^}]*\bnoticeIfStale\b[^}]*\} from "\.\.\/api\/stale-notice\.js"/);
  assert.match(src, /d\.waitUntil\(renameSave\(/, "the edit waits on the wrapped save");
  const body = src.slice(src.indexOf("async function renameSave"));
  assert.match(body, /noticeIfStale\(e\);\s*throw e;/, "stale raises the notice, then the cell gets the refusal");
});

test("noticeIfStale shows the notice only for the stale refusal", () => {
  const src = read("web/js/api/stale-notice.js");
  const body = src.slice(src.indexOf("export function noticeIfStale"));
  assert.match(body, /if \(!isStale\(e\)\) return false;\s*staleNotice\(\);\s*return true;/);
});
