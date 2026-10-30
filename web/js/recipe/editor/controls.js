// Attach the kit's behaviour (selects, steppers, switches, segmented, autosize, comboboxes, flash buttons) to new markup.

import { attachSegmented } from "/static/kp/js/segmented.js";
import { attachSelects, attachComboboxes } from "/static/kp/js/combobox.js";
import { attachQuantities } from "/static/kp/js/quantity.js";
import { attachSwitches } from "/static/kp/js/forms.js";
import { attachAutosize } from "/static/kp/js/autosize.js";
import { attachFlashButtons } from "/static/kp/js/flash.js";

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
