// node --test scripts/offline-undo.test.mjs: Undo of a delete still waiting in the kit's queue (web/js/offline/undo.js).
// fix-offline-master-4 (Kenny 02/11/2026 19:43, "de server is altijd de master"): Undo only takes back a delete that
// is still queued; one the replay already sent is restored by the server. Since feat-db-pages-1 the item comes back as
// the local database holds it (the server's record), the parked page copy only when the device does not hold it.
// Written on 02/11/2026, adjusted 03/11/2026, not run (Kenny's test rule): a release check in docs/OPEN.md.
import test from "node:test";
import assert from "node:assert/strict";
import { parkDeleted, queuedDeleteOf, unqueueDelete } from "../web/js/offline/undo.js";
import { itemPath } from "../web/js/offline/config.js";

/** A fake kit queue: `entries` as the kit lists them, `drop` answering `dropOk`. */
function fakeKit(entries, dropOk = true) {
  const dropped = [];
  return {
    dropped,
    queue: async () => entries.map((e) => ({ ...e })),
    drop: async (id) => {
      dropped.push(id);
      return dropOk;
    },
  };
}

/** The local database's record lookup: `held` answers by `<list>/<id>`. */
const records = (held = {}) => async (list, id) => held[`${list}/${id}`] ?? null;

test("a delete still queued is dropped and the database's record comes back (the server's version)", async () => {
  parkDeleted("shelf", { id: "s1", name: "Soup (page)", rev: 3 });
  const kit = fakeKit([{ id: 7, method: "DELETE", path: itemPath("shelf", "s1"), state: "queued" }]);
  const out = await unqueueDelete(kit, records({ "shelf/s1": { id: "s1", name: "Soup (server)", rev: 4 } }), "shelf", "s1");
  assert.deepEqual(out, { dropped: true, item: { id: "s1", name: "Soup (server)", rev: 4 } });
  assert.deepEqual(kit.dropped, [7]);
});

test("an item the device does not keep comes back as the page parked it", async () => {
  parkDeleted("shelf", { id: "s3", name: "Stew" });
  const kit = fakeKit([{ id: 5, method: "DELETE", path: itemPath("shelf", "s3"), state: "queued" }]);
  assert.deepEqual(await unqueueDelete(kit, records(), "shelf", "s3"), { dropped: true, item: { id: "s3", name: "Stew" } });
});

test("a delete the replay already sent is not taken back locally: the server restores it", async () => {
  parkDeleted("shelf", { id: "s2" });
  const none = { dropped: false, item: null };
  assert.deepEqual(await unqueueDelete(fakeKit([]), records(), "shelf", "s2"), none, "no queued entry: sent");
  assert.deepEqual(await unqueueDelete(fakeKit([{ id: 8, method: "DELETE", path: itemPath("shelf", "s2"), state: "queued" }], false), records(), "shelf", "s2"), none, "drop lost the race with the replay");
});

test("a failed or held delete is the failed list's business, never Undo's", async () => {
  parkDeleted("log", { id: "l1" });
  const kit = fakeKit([{ id: 9, method: "DELETE", path: itemPath("log", "l1"), state: "failed" }]);
  assert.deepEqual(await unqueueDelete(kit, records(), "log", "l1"), { dropped: false, item: null });
  assert.deepEqual(kit.dropped, []);
  assert.equal(queuedDeleteOf([{ id: 1, method: "DELETE", path: itemPath("log", "l1"), state: "held" }], "log", "l1"), null);
});
