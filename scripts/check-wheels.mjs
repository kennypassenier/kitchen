// There is ONE wheel component (web/eten/dishwheel.js, Kenny, 24/10/2026 10:27: "the wheel must work the same everywhere"). This
// fails when any other file under web/ imports kp's wheel module ("/static/kp/js/wheel.js") or calls setWheelItems / spinWheel
// itself, because a second place that drives a wheel is how two wheels come to behave differently. Run: node scripts/check-wheels.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const COMPONENT = "web/eten/dishwheel.js";
const files = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : /\.(js|mjs|html)$/.test(f) ? [join(dir, f)] : []));
let bad = 0;
let seen = 0;
for (const file of files("web")) {
  if (file === COMPONENT) continue;
  seen++;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, "");
    if (/["'`]\/static\/kp\/js\/wheel\.js["'`]/.test(code)) { console.log(`${file}:${i + 1}: imports kp's wheel module`); bad++; }
    if (/\b(setWheelItems|spinWheel|attachWheels)\s*\(/.test(code)) { console.log(`${file}:${i + 1}: drives a wheel itself`); bad++; }
  });
}
console.log(`${seen} files checked besides ${COMPONENT}, ${bad} problems`);
process.exit(bad ? 1 : 0);
