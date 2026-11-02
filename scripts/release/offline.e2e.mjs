// Release check of the offline copy (feat-offline-kitchen), in Firefox against a running Kitchen. Written for the
// release; NOT run while building (Kenny: tests only at the release, with his ok). Listed in docs/OPEN.md.
//
//   KITCHEN_BASE=http://127.0.0.1:18440 KITCHEN_TOKEN=… node scripts/release/offline.e2e.mjs
//
// Use a test Kitchen (its own state dir): the run edits the settings' pace and one dish's name and puts both back, and
// adds one freezer item ("E2E soup") that it deletes again.
// Scenarios, each on a fresh signed-in context (a new device to the kit):
//   1. cook mode reloads offline with "Keep everything offline" on (Kenny's default)
//   2. only one recipe kept (feat-offline-recipe): "Keep everything" off, the recipe page's "Keep offline" on; the kit
//      keeps that dish and not the whole kitchen; the recipe and cook mode open offline, another dish does not; the
//      settings row counts it; clearing the copy clears it
//   3. an offline edit shows after an offline reload and is replayed when the connection is back
//   4. a conflict on replay lands in the list of refused edits; "Keep the kitchen's version" empties it
//   5. "Clear offline copy" clears it: an offline reload then shows the page's failed state
//   6. signing out with an unsent edit asks first (the kit's confirmation)
//   7. a freezer take (feat-offline-take-1): one whose answer is lost after it reached the kitchen is replayed with the
//      same Idempotency-Key and takes ONE portion; one made offline shows at once and is sent when the connection is back
//   8. a kept recipe whose dish is deleted on the server (feat-offline-gone): the next online read drops its keep, its
//      copy and the ingredients no other kept dish uses, shows the notice once; a lost connection drops nothing
// Exit code 1 on the first failed check; the measured duration is printed at the end.

import { api, bandState, check, kitchenOf, launch, queueOf, settings, signedIn, synced } from "./offline-driver.mjs";
import { dishPath } from "../../web/js/offline/config.js";

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

/** Is `path` kept on this device, as the kit says. @param {any} page @param {string} path */
const keptByKit = (page, path) => page.evaluate((p) => /** @type {any} */ (window).chassisData.isKept(p), path);

async function oneRecipeKept(browser) {
  const { context, page, errors } = await signedIn(browser, cfg);
  await page.evaluate(async () => {
    const kit = /** @type {any} */ (window).chassisData;
    await kit.keepAll(false);
    await kit.clearCopy();
  });
  const k = await kitchenOf(page);
  const recipe = someRecipe(k);
  const other = k.recipes.find((/** @type {any} */ r) => r.dish_id !== recipe.dish_id);
  check(recipe && other, "the kitchen has recipes in two dishes");
  await page.goto(`${cfg.base}/recipe?id=${encodeURIComponent(recipe.id)}`);
  await page.locator("#rp-keep").waitFor({ state: "attached" });
  await page.locator(".rp-keep .kp-switch").click();
  await page.locator(".rp-keep__said", { hasText: /Kept on this device|Bewaard op dit toestel/ }).waitFor();
  check(await keptByKit(page, dishPath(recipe.dish_id)), "the kit keeps the recipe's dish");
  check(!(await keptByKit(page, "/data/kitchen")), "the kit does NOT keep the whole kitchen for one recipe");
  await context.setOffline(true);
  await page.reload();
  await page.locator('.rp-card[data-kp-state="ready"]').waitFor();
  check((await page.locator("#rp-title").textContent())?.trim() === recipe.name, "the kept recipe opens offline");
  await page.goto(`${cfg.base}/cook?id=${encodeURIComponent(recipe.id)}`).catch(() => {});
  await page.locator(".ck-screen").first().waitFor();
  check((await page.locator('.kp-card[data-kp-state="error"]').count()) === 0, "cook mode opens the kept recipe offline");
  await page.goto(`${cfg.base}/recipe?id=${encodeURIComponent(other.id)}`).catch(() => {});
  await page.locator('.rp-card[data-kp-state="empty"]').waitFor();
  check(true, "a recipe of a dish that is not kept is not there offline");
  await context.setOffline(false);
  await page.goto(`${cfg.base}/settings`);
  await page.locator("#st-offline-said", { hasText: /kept on (its|their) own|apart bewaard/ }).waitFor();
  check(true, "the settings row counts the recipes kept one by one");
  await page.click("#st-offline-clear");
  await page.waitForFunction(async () => (await /** @type {any} */ (window).chassisData.usage()).used === 0);
  await context.setOffline(true);
  await page.goto(`${cfg.base}/recipe?id=${encodeURIComponent(recipe.id)}`).catch(() => {});
  await page.locator('.rp-card[data-kp-state="error"]').waitFor();
  check(true, "clearing the copy clears the kept recipe too");
  check(errors.length === 0, `no page errors (${errors.join("; ")})`);
  await context.close();
}

/** The freezer item as the kitchen itself holds it (no copy). @param {any} page @param {string} id */
const serverPortions = (page, id) =>
  page.evaluate(async (fid) => (await (await fetch("/data/freezer", { credentials: "same-origin" })).json()).find((/** @type {any} */ f) => f.id === fid)?.portions, id);

async function freezerTakeOnce(browser) {
  const { context, page } = await signedIn(browser, cfg);
  const item = await api(page, "create", "freezer", { dish: { nl: "E2E soep", en: "E2E soup" }, portions: 3 });
  // The first take reaches the kitchen, but its answer is lost: the kit queues it with its key and replays it.
  let lost = false;
  await context.route("**/data/freezer/*/take", async (r) => {
    if (lost) return r.continue();
    lost = true;
    await r.fetch();
    await r.abort("internetdisconnected");
  });
  await api(page, "takePortions", item.id, 1);
  check((await queueOf(page))[0] === 1, "the take whose answer was lost waits in the kit's queue");
  const done = synced(page);
  await page.evaluate(() => /** @type {any} */ (window).chassisData.retry());
  await done;
  check((await serverPortions(page, item.id)) === 2, "the replay with the same Idempotency-Key took one portion, not two");
  await context.unroute("**/data/freezer/*/take");
  await context.setOffline(true);
  await api(page, "takePortions", item.id, 1);
  const offline = (await kitchenOf(page)).freezer.find((/** @type {any} */ f) => f.id === item.id);
  check(offline?.portions === 1, "a take made offline shows at once, also after an offline read");
  const back = synced(page);
  await context.setOffline(false);
  await back;
  check((await serverPortions(page, item.id)) === 1, "the offline take reached the kitchen once");
  await api(page, "remove", "freezer", item.id);
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
  const sheet = a.page.locator("dialog.chassis-failed"); // the kit's drawer (chassis-rs 073273f)
  await sheet.waitFor();
  check((await sheet.locator("[data-chassis-failed-item]").count()) === 1, "the kit's list of refused edits shows it");
  await sheet.locator('[data-chassis-failed-act="discard"]').click();
  await sheet.locator(".chassis-failed__empty").waitFor();
  check((await queueOf(a.page))[1] === 0, "discarding the edit drops it and keeps the kitchen's version");
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
  // /recipes draws its list as the package's datatable, whose failed state is `data-kp-state="failed"`; a card says "error".
  await page.locator('.kp-card[data-kp-state="error"], .kp-datatable[data-kp-state="failed"]').first().waitFor();
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
  // The kit's logout form lives on its own pages (layout.html). The guard works there without configure() since chassis-rs 073273f.
  // Kitchen serves no /status (404); /storage is the kit page it has (layout.html, with the logout form).
  await page.goto(`${cfg.base}/storage`);
  await page.locator("#chassis-logout").evaluate((form) => /** @type {HTMLFormElement} */ (form).requestSubmit());
  const asked = await page.getByText(/not been sent yet|not sent to the kitchen yet|nog niet naar de keuken/).first().waitFor({ state: "visible", timeout: 3000 }).then(() => true, () => false);
  check(asked, "signing out with an unsent edit asks first (kit logout guard, chassis-rs 073273f)");
  await context.close();
}

/**
 * Scenario 8 (feat-offline-gone, Kenny 02/11/2026 19:43). A dish made for the check is kept, deleted on the server and
 * the kitchen read again: offline first (nothing is dropped, a copy never says "gone"), then online.
 */
async function keptDishGone(browser) {
  const { context, page, errors } = await signedIn(browser, cfg);
  await page.evaluate(() => /** @type {any} */ (window).chassisData.keepAll(false));
  const dish = await api(page, "create", "dishes", { name: { nl: "E2E weg", en: "E2E gone" }, category: null, parents: false, ingredients: [], sides: [], recipes: [] });
  const path = dishPath(dish.id);
  await page.evaluate((p) => /** @type {any} */ (window).chassisData.keepItem(p, true), path);
  await page.evaluate((p) => /** @type {any} */ (window).chassisData.get(p), path);
  check(await keptByKit(page, path), "the new dish is kept");
  await context.setOffline(true);
  await page.evaluate(() => /** @type {any} */ (window).chassisData.get("/data/dishes/none").catch(() => {}));
  await api(page, "loadKitchen", { force: true }).catch(() => {});
  check(await keptByKit(page, path), "a lost connection drops nothing");
  await context.setOffline(false);
  await api(page, "remove", "dishes", dish.id);
  await api(page, "loadKitchen", { force: true });
  await page.waitForFunction((p) => /** @type {any} */ (window).chassisData.isKept(p).then((k) => !k), path);
  const notice = page.getByText(/no longer in the kitchen|niet meer in de keuken/);
  await notice.first().waitFor();
  check((await notice.count()) === 1, "the notice shows once");
  await api(page, "loadKitchen", { force: true });
  check((await notice.count()) === 1, "a later read does not show it again");
  check(errors.length === 0, `no page errors (${errors.join("; ")})`);
  await context.close();
}

const browser = await launch(cfg);
let failed = false;
try {
  // KITCHEN_E2E_ONLY=3,4,… runs only those scenarios (numbered as in the header), so a fix reruns only what failed.
  const only = (process.env.KITCHEN_E2E_ONLY ?? "").split(",").map((n) => n.trim()).filter(Boolean);
  const scenarios = [["cook mode offline", cookOffline, 1], ["only one recipe kept", oneRecipeKept, 2], ["offline edit + replay", editAndReplay, 3], ["conflict on replay", conflictToFailedList, 4], ["clear copy", clearCopy, 5], ["logout with unsent edits", logoutAsks, 6], ["freezer take once", freezerTakeOnce, 7], ["kept dish gone", keptDishGone, 8]];
  for (const [name, run, n] of scenarios) {
    if (only.length && !only.includes(String(n))) continue;
    console.log(`${n}. ${name}`);
    await run(browser);
  }

} catch (e) {
  failed = true;
  console.error(e instanceof Error ? e.message : e);
} finally {
  await browser.close();
  const s = Math.round((Date.now() - started) / 1000);
  console.log(`offline release check: ${failed ? "FAILED" : "passed"} in ${Math.floor(s / 60)} min ${s % 60} s`);
}
process.exit(failed ? 1 : 0);
