// Scenario 5 of the offline release check (scripts/release/offline.e2e.mjs): "Offline kopie wissen" with an edit
// waiting. The kit's `db.clear()` (chassis-rs 4.6.0) empties the local database and keeps the queue: the row's size drops,
// the edit still waits, an offline reload has no kitchen to show (the failed state, not an empty kitchen), and the edit
// is sent once the connection is back.

import { api, check, kitchenOf, queueOf, signedIn, synced } from "./offline-driver.mjs";

/** The local database's size on this device, in bytes. @param {any} page */
const dbBytes = (page) => page.evaluate(async () => (await /** @type {any} */ (window).chassisData.db.usage()).bytes);

/** @param {any} browser @param {ReturnType<typeof import("./offline-driver.mjs").settings>} cfg */
export async function clearCopy(browser, cfg) {
  const { context, page, errors } = await signedIn(browser, cfg);
  const before = (await kitchenOf(page)).settings?.pace ?? "normal";
  const next = before === "slow" ? "normal" : "slow";
  await page.goto(`${cfg.base}/settings`);
  await page.locator("#st-offline-clear").waitFor();
  check((await dbBytes(page)) > 0, "the local database holds the kitchen");
  await context.setOffline(true);
  await api(page, "patchSettings", { pace: next });
  await page.locator("#st-offline-clear").click();
  await page.waitForFunction(async () => (await /** @type {any} */ (window).chassisData.db.usage()).bytes === 0);
  check((await queueOf(page))[0] === 1, "the cleared copy keeps the waiting edit");
  await page.reload();
  await page.locator('[data-kp-state="error"]').first().waitFor();
  check(true, "an offline reload after the clear shows the failed state, not an empty kitchen");
  const done = synced(page);
  await context.setOffline(false);
  await done;
  const server = await page.evaluate(async () => (await (await fetch("/data/settings/kitchen", { credentials: "same-origin" })).json()).pace);
  check(server === next && (await queueOf(page))[0] === 0, "the waiting edit is sent once the connection is back");
  check((await kitchenOf(page)).settings.pace === next, "the page's kitchen follows the replay");
  await api(page, "patchSettings", { pace: before });
  check(errors.length === 0, `no page errors (${errors.join("; ")})`);
  await context.close();
}
