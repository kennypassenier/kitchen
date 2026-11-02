// node --test scripts/kp-entries.test.mjs: Kitchen is on kp-themes' split delivery (chassis-rs 4.2.0, feat-kp-split-1).
// Every page links kp-themes-base.min.css and imports kp's per-module entries under /static/kp/dist/js/; nothing may still
// reach the one-file bundle, the full stylesheet or the loose /static/kp/js/ modules, because two deliveries on one page
// each hold their own copy of kp's state (theme, remembered places, strings). A static walk of the files: no browser.
//
// Not covered here: the kit's injected runtime (/static/chassis/webapp-runtime.js) is chassis-rs' file; whether it is on
// the bundle is a release check in docs/OPEN.md (the network check), not something Kitchen's tree can show.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";

const ROOT = resolve(import.meta.dirname, "..");
const WEB = join(ROOT, "web");
const PAGES = ["index.html", "eten/index.html"];
const ENTRY = /^\/static\/kp\/dist\/js\/([\w-]+\.js)$/;
// What the split delivery replaced; any of these on a page is the old delivery.
const OLD = [/\/static\/kp\/dist\/kp-themes\.min\.js/, /\/static\/kp\/dist\/kp-themes\.css/, /\/static\/kp\/css\/fonts\.css/, /\/static\/kp\/js\//];

/** Every .js / .mjs / .html file under `dir`. @param {string} dir @returns {string[]} */
const files = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : /\.(m?js|html)$/.test(f) ? [p] : [];
});

/** Code without line and block comments, so a comment naming the old path is not an import. @param {string} src */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

/** The specifiers a file loads: static and dynamic imports, script src, stylesheet href. @param {string} src */
function specifiers(src) {
  const c = code(src);
  const out = [];
  for (const m of c.matchAll(/\bfrom\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\bimport\s+["']([^"']+)["']/g)) out.push(m[1] ?? m[2] ?? m[3]);
  for (const m of c.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)) out.push(m[1]);
  return out;
}

/** A specifier as a file under web/, or null for /static/ and other outside paths. @param {string} from @param {string} spec */
function local(from, spec) {
  if (spec.startsWith("/static/") || /^[a-z]+:/.test(spec)) return null;
  const p = spec.startsWith("/") ? join(WEB, spec) : resolve(dirname(from), spec);
  return existsSync(p) && statSync(p).isFile() && /\.(m?js|html)$/.test(p) ? p : null;
}

/** Every specifier reachable from a page, following Kitchen's own files. @param {string} page */
function pageSpecifiers(page) {
  const seen = new Set();
  const specs = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const s of specifiers(readFileSync(file, "utf8"))) {
      specs.add(s);
      const next = local(file, s);
      if (next) walk(next);
    }
  };
  walk(join(WEB, page));
  return { specs, files: seen.size };
}

/** The vendored dist/js folder: $KP_DIST, else the cargo checkout of the chassis revision Cargo.lock pins. */
function distJs() {
  if (process.env.KP_DIST) return process.env.KP_DIST;
  const lock = readFileSync(join(ROOT, "Cargo.lock"), "utf8");
  const rev = lock.match(/source = "git\+https:\/\/github\.com\/kennypassenier\/chassis-rs\?(?:tag|rev)=[^#]+#([0-9a-f]{7})/)?.[1];
  assert.ok(rev, "Cargo.lock pins no chassis-rs git revision; set KP_DIST to the vendored kp dist/js folder");
  const base = join(homedir(), ".cargo", "git", "checkouts");
  const dir = existsSync(base) && readdirSync(base).filter((d) => d.startsWith("chassis-rs-"))
    .map((d) => join(base, d, rev, "crates/chassis/static/kp/dist/js")).find(existsSync);
  assert.ok(dir, `no cargo checkout of chassis-rs ${rev}: run cargo build once, or set KP_DIST`);
  return dir;
}

/** The names a minified entry exports. @param {string} src */
function exportsOf(src) {
  const names = new Set();
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) for (const p of m[1].split(",")) names.add(p.trim().split(/\s+as\s+/).pop() ?? "");
  return names;
}

test("no file under web/ reaches the bundle, the full stylesheet or the loose modules", () => {
  const bad = files(WEB).flatMap((f) => specifiers(readFileSync(f, "utf8")).filter((s) => OLD.some((re) => re.test(s))).map((s) => `${f}: ${s}`));
  assert.deepEqual(bad, []);
});

for (const page of PAGES) {
  test(`${page} loads the split delivery only, never mixed with the bundle`, () => {
    const { specs, files: seen } = pageSpecifiers(page);
    assert.ok(seen > 1, `${page}: the walk found the page's own modules`);
    const old = [...specs].filter((s) => OLD.some((re) => re.test(s)));
    const split = [...specs].filter((s) => ENTRY.test(s) || s.endsWith("/kp-themes-base.min.css"));
    assert.deepEqual(old, [], `${page} mixes the old delivery with ${split.length} split references`);
    assert.ok(specs.has("/static/kp/dist/kp-themes-base.min.css"), `${page} links the base stylesheet`);
    assert.ok(specs.has("/static/kp/dist/js/auto.js"), `${page} loads auto.js`);
    assert.ok(specs.has("/static/kp/dist/js/lazy-register.js"), `${page} attaches the lazy registers`);
  });

  test(`${page} puts theme-boot.js below the base stylesheet with the register pattern`, () => {
    const html = code(readFileSync(join(WEB, page), "utf8"));
    const base = html.indexOf("kp-themes-base.min.css");
    const boot = html.search(/<script src="\/static\/theme-boot\.js"[^>]*data-register-pattern="\/static\/kp\/dist\/css\/\{theme\}-register\.min\.css"/);
    assert.ok(base >= 0 && boot > base, `${page}: base stylesheet, then theme-boot.js with data-register-pattern`);
  });
}

test("every name Kitchen imports from a per-module entry is exported by that entry", () => {
  const dir = distJs();
  const missing = [];
  for (const f of files(WEB)) {
    for (const m of code(readFileSync(f, "utf8")).matchAll(/import\s*\{([^}]*)\}\s*from\s*["'](\/static\/kp\/dist\/js\/[\w-]+\.js)["']/g)) {
      const entry = join(dir, m[2].match(ENTRY)?.[1] ?? "");
      if (!existsSync(entry)) { missing.push(`${f}: ${m[2]} does not exist`); continue; }
      const names = exportsOf(readFileSync(entry, "utf8"));
      for (const n of m[1].split(",").map((p) => p.trim().split(/\s+as\s+/)[0]).filter(Boolean)) if (!names.has(n)) missing.push(`${f}: ${n} not in ${m[2]}`);
    }
  }
  assert.deepEqual(missing, []);
});
