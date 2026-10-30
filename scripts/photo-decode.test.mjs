// node --test scripts/photo-decode.test.mjs: the decode orchestration of web/js/recipe/photo-decode.js (Kenny, 30/10/2026).
import test from "node:test";
import assert from "node:assert/strict";
import { decodeWith } from "../web/js/recipe/photo-decode.js";

const unreadable = "not a picture";
const never = () => assert.fail("must not be called");

test("the bitmap path wins when it works", async () => {
  const r = await decodeWith({ bitmap: async () => "bitmap", readDataUrl: never, loadImage: never, unreadable });
  assert.equal(r, "bitmap");
});

test("a failing bitmap falls back to the data URL path", async () => {
  const seen = [];
  const r = await decodeWith({
    bitmap: async () => { throw new Error("no"); },
    readDataUrl: async () => "data:image/jpeg;base64,AAAA",
    loadImage: async (url) => { seen.push(url); return "image"; },
    unreadable,
  });
  assert.equal(r, "image");
  assert.deepEqual(seen, ["data:image/jpeg;base64,AAAA"]);
});

test("both paths failing throws the unreadable message, with the causes kept", async () => {
  await assert.rejects(
    decodeWith({
      bitmap: async () => { throw new Error("b"); },
      readDataUrl: async () => "data:,",
      loadImage: async () => { throw new Error("l"); },
      unreadable,
    }),
    (e) => e.message === unreadable && e.cause.bitmapError.message === "b" && e.cause.fallbackError.message === "l",
  );
});
