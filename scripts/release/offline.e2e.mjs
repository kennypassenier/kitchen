// Release check of the offline side (feat-offline-kitchen; on the kit's local database `chassisData.db` since
// feat-db-pages-1/-2), in Firefox against a running Kitchen. Written for the release; NOT run while building (Kenny:
// tests only at the release, with his ok). Listed in docs/OPEN.md (release check 16).
//
//   KITCHEN_BASE=http://127.0.0.1:18440 KITCHEN_TOKEN=… node scripts/release/offline.e2e.mjs
//
// Use a test Kitchen (its own state dir): the run edits the settings' pace and one dish's name and puts both back, and
// adds one freezer item ("E2E soup") that it deletes again.
// Scenarios, each on a fresh signed-in context (a new device to the kit):
//   1. cook mode reloads offline with "Keep everything offline" on (Kenny's default)
//   2. only one recipe kept (feat-offline-recipe): "Keep everything" off, the recipe page's "Keep offline" on; the local
//      database holds that dish and not the others; the recipe and cook mode open offline, another dish does not; the
//      settings row counts it
//   3. an offline edit shows after an offline reload and is replayed when the connection is back
//   4. a conflict on replay lands in the list of refused edits; "Keep the kitchen's version" empties it
//   5. (HELD, not in the list below: "Clear offline copy" has no kit call that empties the local database without the
//      queue; docs/OPEN.md release check 16 "Held")
//   6. signing out with an unsent edit asks first (the kit's confirmation)
//   7. a freezer take (feat-offline-take-1): one whose answer is lost after it reached the kitchen is replayed with the
//      same Idempotency-Key and takes ONE portion; one made offline shows at once and is sent when the connection is back
//   8. a kept recipe whose dish is deleted on the server (feat-offline-gone): the kit's pull removes it, Kitchen lets go
//      of its keep and shows the notice once; a lost connection drops nothing
//   9. a settings merge made offline over a newer change elsewhere is refused on replay (failed list) and the page shows
//      the other device's value
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

/** Is dish `id` kept on this device, as the kit's local database says. @param {any} page @param {string} id */
const keptByKit = (page, id) => page.evaluate((key) => /** @type {any} */ (window).chassisData.db.collection("dishes").isKept(key), id);

/** The dish ids the local database holds. @param {any} page */
const heldDishes = (page) => page.evaluate(async () => (await /** @type {any} */ (window).chassisData.db.collection("dishes").all()).map((/** @type {any} */ d) => d.id));

async function oneRecipeKept(browser) {
  const { context, page, errors } = await signedIn(browser, cfg);
  await page.evaluate(() => /** @type {any} */ (window).chassisData.keepAll(false));
  const k = await kitchenOf(page);
  const recipe = someRecipe(k);
  const other = k.recipes.find((/** @type {any} */ r) => r.dish_id !== recipe.dish_id);
  check(recipe && other, "the kitchen has recipes in two dishes");
  await page.goto(`${cfg.base}/recipe?id=${encodeURIComponent(recipe.id)}`);
  await page.locator("#rp-keep").waitFor({ state: "attached" });
  await page.locator(".rp-keep .kp-switch").click();
  await page.locator(".rp-keep__said", { hasText: /Kept on this device|Bewaard op dit toestel/ }).waitFor();
  check(await keptByKit(page, recipe.dish_id), "the kit keeps the recipe's dish");
  const held = await heldDishes(page);
  check(held.includes(recipe.dish_id) && !held.includes(other.dish_id), "the local database holds that dish and NOT the others");
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
  const server = await page.evaluate(async () => (await (await fetch("/data/settings/kitchen", { credentials: "same-origin" })).json()).pace);
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

async function logoutAsks(browser) {
  const { context, page } = await signedIn(browser, cfg);
  const pace = (await kitchenOf(page)).settings?.pace ?? "normal";
  // The kitchen refuses to answer the settings PATCH (no answer at all), so the kit keeps the edit waiting.
  await context.route("**/data/settings/kitchen", (r) => (r.request().method() === "PATCH" ? r.abort("internetdisconnected") : r.continue()));
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
 * Scenario 8 (feat-offline-gone, Kenny 02/11/2026 19:43). A dish made for the check is kept, then deleted as another
 * device would (a plain DELETE, not through this page's api.js, which marks its own deletes), and the kitchen read
 * again: offline first (nothing is dropped), then online (the kit's pull removes it; Kitchen says so once).
 */
async function keptDishGone(browser) {
  const { context, page, errors } = await signedIn(browser, cfg);
  await page.evaluate(() => /** @type {any} */ (window).chassisData.keepAll(false));
  const dish = await api(page, "create", "dishes", { name: { nl: "E2E weg", en: "E2E gone" }, category: null, parents: false, ingredients: [], sides: [], recipes: [] });
  await page.evaluate((id) => /** @type {any} */ (window).chassisData.db.collection("dishes").keep(id, true), dish.id);
  check((await keptByKit(page, dish.id)) && (await heldDishes(page)).includes(dish.id), "the new dish is kept and held");
  await context.setOffline(true);
  await api(page, "loadKitchen", { force: true }).catch(() => {});
  check(await keptByKit(page, dish.id), "a lost connection drops nothing");
  await context.setOffline(false);
  await page.evaluate((id) => fetch(`/data/dishes/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin" }), dish.id);
  await api(page, "loadKitchen", { force: true });
  await page.waitForFunction((id) => /** @type {any} */ (window).chassisData.db.collection("dishes").isKept(id).then((k) => !k), dish.id);
  const notice = page.getByText(/no longer in the kitchen|niet meer in de keuken/);
  await notice.first().waitFor();
  check((await notice.count()) === 1, "the notice shows once");
  await api(page, "loadKitchen", { force: true });
  check((await notice.count()) === 1, "a later read does not show it again");
  check(errors.length === 0, `no page errors (${errors.join("; ")})`);
  await context.close();
}

/** Scenario 9 (fix-offline-master-5 on the settings item, feat-db-pages-1): a stale settings merge replayed is refused. */
async function settingsStale(browser) {
  const a = await signedIn(browser, cfg);
  const b = await signedIn(browser, cfg);
  const held = (await kitchenOf(a.page)).settings ?? {};
  const before = held.pace ?? "normal";
  const dinner = held.dinner_time ?? null;
  await a.context.setOffline(true);
  await api(a.page, "patchSettings", { pace: before === "slow" ? "normal" : "slow" });
  await api(b.page, "patchSettings", { dinner_time: "19:05" });
  const done = synced(a.page);
  await a.context.setOffline(false);
  await done;
  check((await queueOf(a.page))[1] === 1, "the stale settings merge is in the failed list");
  await a.page.waitForFunction(async (pace) => {
    const k = await (await import("/js/api.js")).loadKitchen({ force: true });
    return k.settings.dinner_time === "19:05" && (k.settings.pace ?? "normal") === pace;
  }, before);
  check(true, "the page shows the other device's change, not its own refused one");
  await a.page.evaluate(() => /** @type {any} */ (window).chassisData.failed().then((f) => Promise.all(f.map((e) => /** @type {any} */ (window).chassisData.drop(e.id)))));
  await api(b.page, "patchSettings", { dinner_time: dinner });
  await a.context.close();
  await b.context.close();
}

const browser = await launch(cfg);
let failed = false;
try {
  // KITCHEN_E2E_ONLY=3,4,… runs only those scenarios (numbered as in the header), so a fix reruns only what failed.
  const only = (process.env.KITCHEN_E2E_ONLY ?? "").split(",").map((n) => n.trim()).filter(Boolean);
  const scenarios = [["cook mode offline", cookOffline, 1], ["only one recipe kept", oneRecipeKept, 2], ["offline edit + replay", editAndReplay, 3], ["conflict on replay", conflictToFailedList, 4], ["logout with unsent edits", logoutAsks, 6], ["freezer take once", freezerTakeOnce, 7], ["kept dish gone", keptDishGone, 8], ["settings stale", settingsStale, 9]];
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
