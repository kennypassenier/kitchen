// Lock or unlock one of the kit's steppers (a `.kp-quantity`). The kit reads a stepper as locked while it carries
// `data-kp-quantity-disabled` OR its input is `disabled`, and its paint copies that back onto the input, so once locked
// the input stays disabled after the attribute goes (kp-gaps/kitchen.md, 02/11/2026). Unlocking therefore clears both.
// No imports, so node can test it (scripts/quantity-lock.test.mjs).

/**
 * Answers whether the lock changed, so the caller paints the stepper once (the kit enables its buttons on a paint).
 * @param {{ hasAttribute: (n: string) => boolean, setAttribute: (n: string, v: string) => void, removeAttribute: (n: string) => void, querySelector: (s: string) => any }} q the stepper
 * @param {boolean} locked
 * @returns {boolean}
 */
export function lockQuantity(q, locked) {
  const was = q.hasAttribute("data-kp-quantity-disabled");
  if (locked) {
    q.setAttribute("data-kp-quantity-disabled", "");
    return !was;
  }
  q.removeAttribute("data-kp-quantity-disabled");
  const field = q.querySelector(".kp-quantity__input");
  if (field) field.disabled = false;
  return was;
}
