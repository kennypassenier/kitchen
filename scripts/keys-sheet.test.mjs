// node --test scripts/keys-sheet.test.mjs: Kitchen's keys on the `?` sheet (web/js/shell/keys.js and its callers).
// Static: every listed key is in kp's key format without an AltGr key (Kenny's AZERTY), every entry has its words in
// both languages under `keys.*`, and Kitchen's own step keys are the configurable defaults.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { EN } from "../web/js/i18n/en.js";
import { NL } from "../web/js/i18n/nl.js";

const WEB = fileURLToPath(new URL("../web/js/", import.meta.url));
/** Keys that need AltGr on an AZERTY keyboard (kp-themes' ALTGR_KEYS). */
const ALTGR = ["[", "]", "{", "}", "@", "#", "\\", "|", "~", "€", "`", "^"];

/** Every .js file under `dir`. @param {string} dir @returns {string[]} */
const sources = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? sources(join(dir, n)) : n.endsWith(".js") ? [join(dir, n)] : []));

/** The `{ keys: "…", what: t("…") }` entries of the listKeys calls in `text`. @param {string} text */
export const entriesOf = (text) => [...text.matchAll(/keys:\s*(?:"([^"]+)"|sheetKeys\([^)]*\)[^,]*)\s*,\s*what:\s*t\("([^"]+)"\)/g)].map((m) => ({ keys: m[1] ?? null, what: m[2] }));

const all = sources(WEB).filter((f) => /listKeys\(/.test(readFileSync(f, "utf8")) && !f.endsWith("shell/keys.js")).flatMap((f) => entriesOf(readFileSync(f, "utf8")));

test("the scan reads an entry", () => {
  assert.deepEqual(entriesOf(`{ keys: "Mod S", what: t("keys.save"), group }`), [{ keys: "Mod S", what: "keys.save" }]);
  assert.deepEqual(entriesOf(`{ keys: sheetKeys(s.up) ?? "", what: t("keys.stepUp") }`), [{ keys: null, what: "keys.stepUp" }]);
});

test("the pages list at least the ten keys of the inventory", () => {
  assert.ok(all.length >= 10, `found ${all.length}`);
});

test("no listed key needs AltGr on AZERTY", () => {
  for (const e of all.filter((x) => x.keys)) for (const c of ALTGR) assert.ok(!e.keys.includes(c), `${e.keys} (${e.what})`);
  const own = readFileSync(join(WEB, "shell/keys.js"), "utf8");
  assert.match(own, /"step-up": "Alt\+ArrowUp", "step-down": "Alt\+ArrowDown"/);
});

test("every entry says what it does in English and Dutch, differently", () => {
  for (const { what } of all) {
    assert.ok(what.startsWith("keys."), what);
    assert.equal(typeof EN[what], "string", `EN ${what}`);
    assert.equal(typeof NL[what], "string", `NL ${what}`);
    assert.notEqual(EN[what], NL[what], what);
  }
});
