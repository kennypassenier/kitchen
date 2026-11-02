// node --test scripts/quantity-lock.test.mjs: locking a kit stepper (web/js/ui/quantity-lock.js), the editor's Override.
import test from "node:test";
import assert from "node:assert/strict";
import { lockQuantity } from "../web/js/ui/quantity-lock.js";

/** A stepper as the kit leaves it once it painted a lock: the attribute and a disabled input. */
function stepper() {
  const attrs = new Map([["data-kp-quantity-disabled", ""]]);
  const field = { disabled: true };
  return {
    field,
    has: (/** @type {string} */ n) => attrs.has(n),
    hasAttribute: (/** @type {string} */ n) => attrs.has(n),
    setAttribute: (/** @type {string} */ n, /** @type {string} */ v) => void attrs.set(n, v),
    removeAttribute: (/** @type {string} */ n) => void attrs.delete(n),
    querySelector: (/** @type {string} */ sel) => (sel === ".kp-quantity__input" ? field : null),
  };
}

test("unlocking clears the attribute and the input the kit disabled", () => {
  const q = stepper();
  assert.equal(lockQuantity(q, false), true);
  assert.equal(q.has("data-kp-quantity-disabled"), false);
  assert.equal(q.field.disabled, false);
});

test("locking sets the attribute (the kit disables the input on its paint)", () => {
  const q = stepper();
  q.removeAttribute("data-kp-quantity-disabled");
  assert.equal(lockQuantity(q, true), true);
  assert.equal(q.has("data-kp-quantity-disabled"), true);
});

test("the same lock again is no change (no paint that would undo typing)", () => {
  const q = stepper();
  assert.equal(lockQuantity(q, true), false);
  lockQuantity(q, false);
  assert.equal(lockQuantity(q, false), false);
});

test("a stepper without its input is unlocked without error", () => {
  const q = { ...stepper(), querySelector: () => null };
  assert.doesNotThrow(() => lockQuantity(q, false));
});
