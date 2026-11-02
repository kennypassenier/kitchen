// node --test scripts/paint-timing.test.mjs: when the editor's timeline is painted again (fix-long-recipe-1). Typing waits for
// a pause; a picked value, an added or removed row or a stepper paints at once; a burst paints once.
import test from "node:test";
import assert from "node:assert/strict";
import { paintDelay, createPaintQueue, TYPING_PAUSE_MS } from "../web/js/recipe/editor/paint-timing.js";

/** Fake timers: `tick(ms)` runs what is due, `flush()` the microtasks. */
function clock() {
  let now = 0;
  let next = 1;
  const timers = new Map();
  const micro = [];
  return {
    setTimer: (fn, ms) => (timers.set(next, { fn, at: now + ms }), next++),
    clearTimer: (id) => timers.delete(id),
    soon: (fn) => micro.push(fn),
    flush: () => micro.splice(0).forEach((fn) => fn()),
    tick(ms) {
      now += ms;
      for (const [id, t] of [...timers]) if (t.at <= now) (timers.delete(id), t.fn());
    },
  };
}

test("typing waits for a pause; every other change paints at once", () => {
  assert.equal(paintDelay("input"), TYPING_PAUSE_MS);
  assert.ok(TYPING_PAUSE_MS >= 200 && TYPING_PAUSE_MS <= 500);
  for (const type of ["change", "kp-quantity-change", "rl-rows-change", "drop"]) assert.equal(paintDelay(type), 0, type);
});

test("a run of key presses paints once, after the pause", () => {
  const c = clock();
  let painted = 0;
  const q = createPaintQueue(() => painted++, c);
  for (let i = 0; i < 10; i++) {
    q.queue("input");
    c.flush();
    c.tick(100);
  }
  assert.equal(painted, 0, "no paint while the keys keep coming");
  c.tick(TYPING_PAUSE_MS);
  assert.equal(painted, 1);
});

test("an explicit change paints at once and replaces a waiting typing paint", () => {
  const c = clock();
  let painted = 0;
  const q = createPaintQueue(() => painted++, c);
  q.queue("input");
  q.queue("change");
  q.queue("rl-rows-change");
  c.flush();
  assert.equal(painted, 1, "one paint for the burst, without waiting");
  c.tick(TYPING_PAUSE_MS * 2);
  assert.equal(painted, 1, "the typing paint it replaced does not come later");
});

test("typing right after a change still waits for its own pause", () => {
  const c = clock();
  let painted = 0;
  const q = createPaintQueue(() => painted++, c);
  q.queue("change");
  c.flush();
  q.queue("input");
  c.flush();
  assert.equal(painted, 1);
  c.tick(TYPING_PAUSE_MS);
  assert.equal(painted, 2);
});

test("cancel drops a waiting paint", () => {
  const c = clock();
  let painted = 0;
  const q = createPaintQueue(() => painted++, c);
  q.queue("input");
  q.cancel();
  c.tick(TYPING_PAUSE_MS * 2);
  c.flush();
  assert.equal(painted, 0);
});
