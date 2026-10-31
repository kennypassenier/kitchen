// Attach the kit's behaviour (selects, steppers, switches, segmented, autosize, comboboxes, flash buttons) to new markup.

import { attachSegmented, attachSelects, attachComboboxes, attachQuantities, attachSwitches, attachAutosize, attachFlashButtons } from "/static/kp/dist/kp-themes.min.js";

/** @param {ParentNode} root */
export function attachControls(root) {
  attachSelects(root);
  attachQuantities(root);
  attachSwitches(root);
  attachSegmented(root);
  attachAutosize(root);
  attachComboboxes(root, { creatable: true });
  attachFlashButtons(root);
}
