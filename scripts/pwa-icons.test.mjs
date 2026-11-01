// node --test scripts/pwa-icons.test.mjs: the approved Kitchen icon set (Kenny, 01/11/2026) in both places.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const web = new URL("../web/", import.meta.url);
const NAMES = ["icon-180.png", "icon-192.png", "icon-512.png", "icon-maskable-192.png", "icon-maskable-512.png", "icon-monochrome-512.png"];
const MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const dims = (path) => {
  const b = readFileSync(new URL(path, web));
  assert.deepEqual([...b.subarray(0, 8)], MAGIC, `${path} is not a PNG`);
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
};
const sizeOf = (name) => { const n = name.match(/(\d+)\.png$/)[1]; return `${n}x${n}`; };

test("the eten manifest lists the approved icons with their purposes", () => {
  const m = JSON.parse(readFileSync(new URL("eten/manifest.webmanifest", web), "utf8"));
  const want = [
    ["icon-192.png", undefined], ["icon-512.png", undefined],
    ["icon-maskable-192.png", "maskable"], ["icon-maskable-512.png", "maskable"],
    ["icon-monochrome-512.png", "monochrome"],
  ];
  assert.deepEqual(m.icons.map((i) => [i.src.replace("/eten/", ""), i.purpose]), want);
  for (const i of m.icons) {
    const file = i.src.replace("/eten/", "");
    assert.ok(existsSync(new URL(`eten/${file}`, web)), file);
    assert.equal(i.type, "image/png");
    assert.equal(i.sizes, sizeOf(file));
    assert.equal(dims(`eten/${file}`), i.sizes, file);
  }
});

test("the parents' page keeps its 180 touch icon and an svg", () => {
  const html = readFileSync(new URL("eten/index.html", web), "utf8");
  assert.ok(html.includes('rel="apple-touch-icon" href="/eten/icon-180.png"'));
  assert.equal(dims("eten/icon-180.png"), "180x180");
  assert.ok(readFileSync(new URL("eten/icon.svg", web), "utf8").includes("<svg"));
});

test("web/pwa holds the same seven files with the kit's names, same bytes as eten", () => {
  assert.ok(readFileSync(new URL("pwa/icon.svg", web)).equals(readFileSync(new URL("eten/icon.svg", web))));
  for (const n of NAMES) {
    assert.equal(dims(`pwa/${n}`), sizeOf(n), n);
    assert.ok(readFileSync(new URL(`pwa/${n}`, web)).equals(readFileSync(new URL(`eten/${n}`, web))), n);
  }
});
