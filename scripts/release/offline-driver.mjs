// The browser side of the release check scripts/release/offline.e2e.mjs (feat-offline-kitchen): Firefox through
// playwright-core from the kp-themes checkout (Kitchen has no node_modules of its own), one signed-in context per run,
// and the small steps every scenario shares. Nothing here runs on import.
//
// Configuration, all from the environment (no value is guessed):
//   KITCHEN_BASE     the running Kitchen, e.g. http://127.0.0.1:18440 (required)
//   KITCHEN_TOKEN    a login token of that Kitchen (required; never printed)
//   KP_THEMES        the kp-themes checkout whose node_modules hold playwright-core (default ~/Projects/kp-themes)
//   PW_FIREFOX       the Firefox executable (default: Playwright's firefox-1538 in ~/.cache/ms-playwright)

import { createRequire } from "node:module";

/** @param {string} name */
function needed(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set: see the head of scripts/release/offline-driver.mjs`);
  return value;
}

export function settings() {
  const home = process.env.HOME ?? "";
  return {
    base: needed("KITCHEN_BASE").replace(/\/+$/, ""),
    token: needed("KITCHEN_TOKEN"),
    kp: process.env.KP_THEMES ?? `${home}/Projects/kp-themes`,
    firefox: process.env.PW_FIREFOX ?? `${home}/.cache/ms-playwright/firefox-1538/firefox/firefox`,
  };
}

/** Firefox, launched once. @param {ReturnType<typeof settings>} cfg */
export async function launch(cfg) {
  const require = createRequire(`${cfg.kp}/node_modules/`);
  const { firefox } = require("playwright-core");
  return firefox.launch({ executablePath: cfg.firefox });
}

/**
 * A fresh, signed-in context (a new device to the kit: no offline copy, no settings) and its page, on `/`.
 * @param {any} browser @param {ReturnType<typeof settings>} cfg
 */
export async function signedIn(browser, cfg) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${cfg.base}/login`);
  await page.fill("#token", cfg.token);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click('#login-form button[type="submit"]')]);
  await page.goto(`${cfg.base}/`);
  await page.waitForFunction(() => Boolean(/** @type {any} */ (window).chassisData?.ready?.()));
  // The service worker must control the page before an offline reload can be served from it.
  await page.evaluate(() => navigator.serviceWorker?.ready);
  await page.reload();
  return { context, page, errors };
}

/** Call one of Kitchen's own api.js functions in the page, as a screen would. @param {any} page @param {string} fn @param {...any} args */
export const api = (page, fn, ...args) =>
  page.evaluate(async ([name, rest]) => {
    const mod = await import("/js/api.js");
    const out = await /** @type {any} */ (mod)[name](...rest);
    return JSON.parse(JSON.stringify(out ?? null));
  }, [fn, args]);

/** The kitchen as the page's shared copy holds it. @param {any} page */
export const kitchenOf = (page) => api(page, "loadKitchen", { force: true });

/** The kit's queue: [pending, failed]. @param {any} page */
export const queueOf = (page) =>
  page.evaluate(async () => {
    const kit = /** @type {any} */ (window).chassisData;
    return [await kit.pending(), (await kit.failed()).length];
  });

/** Wait for the kit to finish a replay. @param {any} page */
export const synced = (page) =>
  page.evaluate(() => new Promise((resolve) => addEventListener("chassis-data-synced", (e) => resolve(/** @type {CustomEvent} */ (e).detail), { once: true })));

/** The connection band's state attribute, as kp writes it. @param {any} page */
export const bandState = (page) => page.locator("[data-kp-connection]").getAttribute("data-kp-state");

/** A plain assertion that names what failed. @param {unknown} ok @param {string} what */
export function check(ok, what) {
  if (!ok) throw new Error(`release check failed: ${what}`);
  console.log(`  ok  ${what}`);
}
