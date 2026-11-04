// node --test scripts/snapshot-parts.test.mjs: the kitchen put together from its individual endpoints when
// `GET /data/kitchen` fails on the server (web/js/api/snapshot-parts.js, Kenny's API rule 04/11/2026).
import test from "node:test";
import assert from "node:assert/strict";
import { isKitchen, isServerFault, kitchenFromParts, readKitchenOrParts, MALFORMED } from "../web/js/api/snapshot-parts.js";
import { LISTS } from "../web/js/offline/config.js";

const quiet = () => {
  const warn = console.warn;
  console.warn = () => {};
  return () => (console.warn = warn);
};

/** The kitchen the merged endpoint answers, and a `get` that answers the same data from the individual endpoints. */
const kitchen = () => ({
  format: 5,
  ...Object.fromEntries(LISTS.map((name) => [name, [{ id: `${name}-1`, rev: 1 }]])),
  settings: { pace: "slow" },
  settings_rev: 7,
});
function server(merged) {
  const k = kitchen();
  const calls = [];
  const get = async (path) => {
    calls.push(path);
    if (path === "/data/kitchen") return merged(k);
    if (path === "/data/settings/kitchen") return { data: { id: "kitchen", rev: k.settings_rev, ...k.settings } };
    return { data: k[path.replace("/data/", "")] };
  };
  return { k, calls, get };
}
const fail = (status) => async () => {
  throw Object.assign(new Error(`status ${status}`), { status });
};

test("the parts make the merged kitchen: every list, the settings and their revision", async () => {
  const { k, get } = server((x) => ({ data: x }));
  assert.deepEqual(await kitchenFromParts(get), { ...k, recipes: [] });
});

test("a healthy merged call answers alone; no part is read", async () => {
  const { k, get, calls } = server((x) => ({ data: x }));
  assert.deepEqual((await readKitchenOrParts(get)).data, k);
  assert.deepEqual(calls, ["/data/kitchen"]);
});

test("a 5xx on the merged call falls back to the parts, the same kitchen", async () => {
  const restore = quiet();
  const { k, get, calls } = server(fail(500));
  assert.deepEqual((await readKitchenOrParts(get)).data, { ...k, recipes: [] });
  assert.equal(calls.length, 1 + LISTS.length + 1, "the merged call, one per list, the settings item");
  restore();
});

test("a malformed merged answer falls back too", async () => {
  const restore = quiet();
  const { k, get } = server(() => ({ data: { format: 5, dishes: "no" } }));
  assert.deepEqual((await readKitchenOrParts(get)).data.dishes, k.dishes);
  restore();
});

test("offline and signed out do not fall back: the parts would fail the same way", async () => {
  for (const status of [0, 401, 404]) {
    const { get, calls } = server(fail(status));
    await assert.rejects(readKitchenOrParts(get), { status });
    assert.equal(calls.length, 1);
  }
});

test("a failed fallback throws its own error, never a silent empty kitchen", async () => {
  const restore = quiet();
  const get = async (path) => {
    if (path === "/data/log") throw Object.assign(new Error("log is down"), { status: 503 });
    if (path === "/data/kitchen") throw Object.assign(new Error("down"), { status: 500 });
    return { data: [] };
  };
  await assert.rejects(readKitchenOrParts(get), { message: "log is down", status: 503 });
  const notAList = async (path) => (path === "/data/kitchen" ? fail(502)() : { data: { id: "kitchen", rev: 0 } });
  await assert.rejects(readKitchenOrParts(notAList), { code: MALFORMED });
  restore();
});

test("what counts as a kitchen, and as the server's fault", () => {
  assert.equal(isKitchen(kitchen()), true);
  for (const bad of [null, [], "x", { ...kitchen(), format: "5" }, { ...kitchen(), settings: [] }, { ...kitchen(), log: undefined }]) assert.equal(isKitchen(bad), false);
  assert.deepEqual([500, 503, 502].map((status) => isServerFault({ status })), [true, true, true]);
  assert.deepEqual([0, 401, 404, 409].map((status) => isServerFault({ status })), [false, false, false, false]);
  assert.equal(isServerFault({ code: MALFORMED }), true);
  assert.equal(isServerFault(undefined), false);
});
