// node --test scripts/kv-center.test.mjs: every key-value list (`dl.kp-kv`) in Kitchen carries the opt-in
// `kp-kv--center` class, so its labels line up with their values (kp-themes 12.2.0; inert on older kits).
// The check is static: it reads every class string in web/ that names `kp-kv` as a list (not a part such as
// `kp-kv__row` or a modifier alone) and fails on one without the centring modifier.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = fileURLToPath(new URL("../web/", import.meta.url));

/** Every .js and .html file under `dir`. @param {string} dir @returns {string[]} */
function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(js|html)$/.test(name) ? [path] : [];
  });
}

/** The class strings in `text` that make an element a key-value list. @param {string} text @returns {string[]} */
export function kvLists(text) {
  const classes = [...text.matchAll(/class(?:Name)?\s*[:=]\s*["'`]([^"'`]*)["'`]/g)].map((m) => m[1]);
  return classes.filter((c) => c.split(/\s+/).includes("kp-kv"));
}

test("the scan finds a list and reads its modifiers", () => {
  assert.deepEqual(kvLists(`h("dl", { class: "kp-kv kp-kv--lines" })`), ["kp-kv kp-kv--lines"]);
  assert.deepEqual(kvLists(`h("div", { class: "kp-kv__row" })`), []);
});

test("every dl.kp-kv in web/ carries kp-kv--center", () => {
  const missing = sources(WEB).flatMap((file) =>
    kvLists(readFileSync(file, "utf8"))
      .filter((c) => !c.split(/\s+/).includes("kp-kv--center"))
      .map((c) => `${file.slice(WEB.length)}: "${c}"`),
  );
  assert.deepEqual(missing, [], `key-value lists without kp-kv--center:\n${missing.join("\n")}`);
});
