// kp-themes 11.3.0 (chassis 3.14.0) no longer lets the browser submit a valid `data-kp-form`: the package fires
// `kp-form-valid` and stops the submit. A form that relies on the browser posting it (an `action` or `method="post"`)
// must say `data-kp-form-native-submit`, or it silently stops sending. Every form in Kitchen saves with fetch (none posts
// natively), so this fails when a form with `data-kp-form` AND a native post lacks the attribute, and lists every form it
// found so a new one is seen. Reads web/ and src/ (server-rendered HTML). Run: node scripts/check-forms.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const files = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : /\.(js|mjs|html|rs)$/.test(f) ? [join(dir, f)] : []));
let bad = 0;
let forms = 0;
let kpForms = 0;
for (const file of [...files("web"), ...files("src")]) {
  const src = readFileSync(file, "utf8");
  const found = [
    ...[...src.matchAll(/<form\b([^>]*)>/g)].map((m) => ({ at: m.index, attrs: m[1] })),
    ...[...src.matchAll(/\bh\(\s*"form"\s*,\s*\{([^}]*)\}/g)].map((m) => ({ at: m.index, attrs: m[1] })),
  ];
  for (const { at, attrs } of found) {
    forms++;
    const line = src.slice(0, at).split("\n").length;
    const kp = /\bdata-kp-form(?![-\w])/.test(attrs) || /["']data-kp-form["']/.test(attrs);
    if (kp) kpForms++;
    const natives = /\baction\s*[=:]/.test(attrs) || /\bmethod\s*[=:]\s*["']?post/i.test(attrs);
    const marked = /data-kp-form-native-submit/.test(attrs);
    if (kp && natives && !marked) {
      console.log(`${file}:${line}: data-kp-form posts natively but lacks data-kp-form-native-submit`);
      bad++;
    }
  }
}
console.log(`${forms} forms found (${kpForms} with data-kp-form), ${bad} problems`);
process.exit(bad ? 1 : 0);
