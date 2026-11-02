// node --test scripts/offline-undo.test.mjs: Undo of a delete still waiting in the kit's queue (web/js/offline/undo.js).
// fix-offline-master-4 (Kenny 02/11/2026 19:43, "de server is altijd de master"): Undo only takes back a delete that
// is still queued; one the replay already sent is restored by the server, never by the page's parked copy. api.js then
// marks the held kitchen as local, so the next online read replaces the parked item with the server's version.
// Written on 02/11/2026, not run (Kenny's test rule): a release check in docs/OPEN.md.
import test from "node:test";
import assert from "node:assert/strict";
import { parkDeleted, unqueueDelete } from "../web/js/offline/undo.js";
import { itemPath } from "../web/js/offline/apply.js";

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

test("a delete still queued is dropped and the parked item comes back", async () => {
  parkDeleted("shelf", { id: "s1", name: "Soup", rev: 3 });
  const kit = fakeKit([{ id: 7, method: "DELETE", path: itemPath("shelf", "s1"), state: "queued" }]);
  assert.deepEqual(await unqueueDelete(kit, "shelf", "s1"), { id: "s1", name: "Soup", rev: 3 });
  assert.deepEqual(kit.dropped, [7]);
});

test("a delete the replay already sent is not taken back locally: the server restores it", async () => {
  parkDeleted("shelf", { id: "s2" });
  assert.equal(await unqueueDelete(fakeKit([]), "shelf", "s2"), null, "no queued entry: sent");
  assert.equal(await unqueueDelete(fakeKit([{ id: 8, method: "DELETE", path: itemPath("shelf", "s2"), state: "queued" }], false), "shelf", "s2"), null, "drop lost the race with the replay");
});

test("a failed or held delete is the failed list's business, never Undo's", async () => {
  parkDeleted("log", { id: "l1" });
  const kit = fakeKit([{ id: 9, method: "DELETE", path: itemPath("log", "l1"), state: "failed" }]);
  assert.equal(await unqueueDelete(kit, "log", "l1"), null);
  assert.deepEqual(kit.dropped, []);
});
