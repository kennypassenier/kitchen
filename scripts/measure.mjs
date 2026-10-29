// Runs the kp-themes measures (measure-gaps, which includes measure-align and measure-states) against a running Kitchen,
// in every theme (Kenny, 29/10/2026). kp's own CLI picks a theme through `?theme=<name>`, but Kitchen reads the theme
// from localStorage (`theme`, the kit's theme-boot), so the query does nothing here and "dark" was never measured. This
// wrapper gives each run a Playwright storage state with `theme` (and the language) already set, then hands over to kp's
// script unchanged. kp-themes is read, never edited.
//
//   node scripts/measure.mjs <path> [themes=formal,dark] [widths=1280,390] [--base http://127.0.0.1:18440] [--lang en|nl]
//
// <path> is a page of the running app (`/recipes`, `/recipe?id=<id>`, `/cook?id=<id>`). The sections measured are the
// page's cards; a drawer that is opened by a click is measured by the driver scripts, not here. Exit code 1 when kp's
// script found anything.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const [, value] = args.splice(i, 2);
  return value ?? fallback;
};
const base = flag("base", "http://127.0.0.1:18440");
const lang = flag("lang", "en");
const [path, themes = "formal,dark", widths = "1280,390"] = args;
if (!path) {
  console.error("usage: node scripts/measure.mjs <path> [themes] [widths] [--base url] [--lang en|nl]");
  process.exit(2);
}
const kp = `${process.env.HOME}/Projects/kp-themes/research/_review/measure-gaps.mjs`;
const dir = mkdtempSync(join(tmpdir(), "kitchen-measure-"));
let failed = false;
try {
  for (const theme of themes.split(",")) {
    const state = join(dir, `${theme}.json`);
    writeFileSync(
      state,
      JSON.stringify({ cookies: [], origins: [{ origin: new URL(base).origin, localStorage: [{ name: "theme", value: theme }, { name: "kitchen:lang", value: lang }] }] }),
    );
    // kp appends ?theme=<name> to the address and runs the sections; --items marks the page's cards as sections.
    const run = spawnSync("node", [kp, "--url", `${base}${path}`, "--storage-state", state, "--items", "section.kp-card", theme, widths], { stdio: "inherit" });
    if (run.status !== 0) failed = true;
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
