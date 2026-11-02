// node --test scripts/kit-ready.test.mjs: Kitchen waits for the kit's runtime (web/js/api/kit-ready.js). The runtime
// module runs after main.js while `readyState` already says "interactive", so readyState alone must never end the wait
// (fix-kit-ready-1: every page showed "the kit's data client is not on this page").
import test from "node:test";
import assert from "node:assert/strict";
import { kitRuntimeRan } from "../web/js/api/kit-ready.js";

/** A window or document whose listeners the test fires by hand. */
function target(extra = {}) {
  /** @type {Map<string, () => void>} */
  const on = new Map();
  return { ...extra, on, addEventListener: (/** @type {string} */ type, /** @type {() => void} */ fn) => on.set(type, fn) };
}

const settled = async (/** @type {Promise<void>} */ p) => {
  let done = false;
  p.then(() => (done = true));
  await new Promise((r) => setTimeout(r, 0));
  return done;
};

test("a client already on the window is taken at once", async () => {
  assert.equal(await settled(kitRuntimeRan(target({ chassisData: {} }), target({ readyState: "loading" }))), true);
});

test("'interactive' without the client waits for DOMContentLoaded (the runtime module still has to run)", async () => {
  const win = target(), doc = target({ readyState: "interactive" });
  const wait = kitRuntimeRan(win, doc);
  assert.equal(await settled(wait), false);
  doc.on.get("DOMContentLoaded")?.();
  assert.equal(await settled(wait), true);
});

test("a call after DOMContentLoaded still ends at load", async () => {
  const win = target(), doc = target({ readyState: "interactive" });
  const wait = kitRuntimeRan(win, doc);
  win.on.get("load")?.();
  assert.equal(await settled(wait), true);
});

test("a complete page without the client ends the wait, so the caller reports the broken deployment", async () => {
  assert.equal(await settled(kitRuntimeRan(target(), target({ readyState: "complete" }))), true);
});
