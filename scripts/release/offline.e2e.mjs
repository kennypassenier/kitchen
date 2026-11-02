// Release check of the offline copy (feat-offline-kitchen), in Firefox against a running Kitchen. Written for the
// release; NOT run while building (Kenny: tests only at the release, with his ok). Listed in docs/OPEN.md.
//
//   KITCHEN_BASE=http://127.0.0.1:18440 KITCHEN_TOKEN=… node scripts/release/offline.e2e.mjs
//
// Use a test Kitchen (its own state dir): the run edits the settings' pace and one dish's name and puts both back.
// Scenarios, each on a fresh signed-in context (a new device to the kit):
//   1. cook mode reloads offline with "Keep everything offline" on (Kenny's default)
//   2. only one recipe kept: SKIPPED until Kenny chose the per-recipe toggle's shape (docs/OPEN.md)
//   3. an offline edit shows after an offline reload and is replayed when the connection is back
//   4. a conflict on replay lands in the list of refused edits; "Keep the kitchen's version" empties it
//   5. "Clear offline copy" clears it: an offline reload then shows the page's failed state
//   6. signing out with an unsent edit asks first (the kit's confirmation)
// Exit code 1 on the first failed check; the measured duration is printed at the end.

import { api, bandState, check, kitchenOf, launch, queueOf, settings, signedIn, synced } from "./offline-driver.mjs";

const cfg = settings();
const started = Date.now();

/** A recipe of the kitchen with steps, for cook mode. @param {any} k */
const someRecipe = (k) => k.recipes.find((/** @type {any} */ r) => Array.isArray(r.steps) && r.steps.length) ?? k.recipes[0];

async function cookOffline(browser) {
  const { context, page, errors } = await signedIn(browser, cfg);
  const recipe = someRecipe(await kitchenOf(page));
  check(recipe, "the kitchen has a recipe to cook");
  await page.goto(`${cfg.base}/cook?id=${encodeURIComponent(recipe.id)}`);
  await page.locator(".ck-screen").first().waitFor();
  await context.setOffline(true);
  await page.reload();
  await page.locator(".ck-screen").first().waitFor();
  check((await page.locator('.kp-card[data-kp-state="error"]').count()) === 0, "cook mode reloads offline without a failed card");
  await page.waitForFunction(() => document.querySelector("[data-kp-connection]")?.getAttribute("data-kp-state") === "offline");
  check((await bandState(page)) === "offline", "the connection band says offline");
  check(errors.length === 0, `no page errors (${errors.join("; ")})`);
  await context.close();
}

async function editAndReplay(browser) {
  const { context, page } = await signedIn(browser, cfg);
  const before = (await kitchenOf(page)).settings?.pace ?? "normal";
  const next = before === "slow" ? "normal" : "slow";
  await context.setOffline(true);
  await api(page, "patchSettings", { pace: next });
  check((await queueOf(page))[0] === 1, "the offline edit waits in the kit's queue");
  await page.goto(`${cfg.base}/settings`);
  await page.locator("#st-pace-said").waitFor();
  check((await kitchenOf(page)).settings.pace === next, "an offline reload shows the waiting edit (laid over the copy)");
  const done = synced(page);
  await context.setOffline(false);
  const summary = await done;
  check(summary.sent === 1 && (await queueOf(page))[0] === 0, "the edit is sent once the connection is back");
  const server = await page.evaluate(async () => (await (await fetch("/data/settings", { credentials: "same-origin" })).json()).pace);
  check(server === next, "the kitchen has the edit");
  await api(page, "patchSettings", { pace: before });
  await context.close();
}

async function conflictToFailedList(browser) {
  const a = await signedIn(browser, cfg);
  const b = await signedIn(browser, cfg);
  const dish = (await kitchenOf(a.page)).dishes[0];
  check(dish, "the kitchen has a dish");
  const name = dish.name;
  await a.context.setOffline(true);
  await api(a.page, "replace", "dishes", { ...dish, name: { nl: `${name.nl} (A)`, en: `${name.en} (A)` } });
  await api(b.page, "replace", "dishes", { ...dish, name: { nl: `${name.nl} (B)`, en: `${name.en} (B)` } });
  const done = synced(a.page);
  await a.context.setOffline(false);
  await done;
  check((await queueOf(a.page))[1] === 1, "the refused edit is in the failed list and the queue went on");
  await a.page.getByRole("button", { name: /Review|Bekijken/ }).click();
  const sheet = a.page.locator("#off-failed");
  await sheet.waitFor();
  check((await sheet.locator(".kp-formgrid__row").count()) === 1, "the list of refused edits shows it");
  await sheet.getByRole("button", { name: /Keep the kitchen's version|Versie van de keuken houden/ }).click();
  await sheet.locator(".kp-empty").waitFor();
  check((await queueOf(a.page))[1] === 0, "keeping the kitchen's version drops the edit");
  const fresh = (await kitchenOf(b.page)).dishes.find((/** @type {any} */ d) => d.id === dish.id);
  await api(b.page, "replace", "dishes", { ...fresh, name });
  await a.context.close();
  await b.context.close();
}

async function clearCopy(browser) {
  const { context, page } = await signedIn(browser, cfg);
  await page.goto(`${cfg.base}/settings`);
  await page.locator("#st-offline-said", { hasText: /On\.|Aan\./ }).waitFor();
  await page.click("#st-offline-clear");
  await page.waitForFunction(async () => (await /** @type {any} */ (window).chassisData.usage()).used === 0);
  check(true, "clearing empties the copy");
  await context.setOffline(true);
  await page.goto(`${cfg.base}/recipes`).catch(() => {}); // the page itself comes from the worker
  await page.locator('.kp-card[data-kp-state="error"]').first().waitFor();
  check(true, "an offline reload after clearing shows the failed state, not old data");
  await context.close();
}

async function logoutAsks(browser) {
  const { context, page } = await signedIn(browser, cfg);
  const pace = (await kitchenOf(page)).settings?.pace ?? "normal";
  // The kitchen refuses to answer the settings PATCH (no answer at all), so the kit keeps the edit waiting.
  await context.route("**/data/settings", (r) => (r.request().method() === "PATCH" ? r.abort("internetdisconnected") : r.continue()));
  await api(page, "patchSettings", { pace });
  check((await queueOf(page))[0] === 1, "one edit waits unsent");
  // The kit's logout form lives on its own pages (layout.html). The confirmation needs a configured chassisData there.
  await page.goto(`${cfg.base}/status`);
  await page.locator("#chassis-logout").evaluate((form) => /** @type {HTMLFormElement} */ (form).requestSubmit());
  const asked = await page.getByText(/not been sent yet|not sent to the kitchen yet|nog niet naar de keuken/).first().waitFor({ state: "visible", timeout: 3000 }).then(() => true, () => false);
  check(asked, "signing out with an unsent edit asks first (known kit gap if this fails: docs/OPEN.md)");
  await context.close();
}

const browser = await launch(cfg);
let failed = false;
try {
  for (const [name, run] of [["cook mode offline", cookOffline], ["offline edit + replay", editAndReplay], ["conflict on replay", conflictToFailedList], ["clear copy", clearCopy], ["logout with unsent edits", logoutAsks]]) {
    console.log(name);
    await run(browser);
  }
  console.log("only one recipe kept: SKIPPED (the per-recipe toggle waits on Kenny's choice, docs/OPEN.md)");
} catch (e) {
  failed = true;
  console.error(e instanceof Error ? e.message : e);
} finally {
  await browser.close();
  const s = Math.round((Date.now() - started) / 1000);
  console.log(`offline release check: ${failed ? "FAILED" : "passed"} in ${Math.floor(s / 60)} min ${s % 60} s`);
}
process.exit(failed ? 1 : 0);
