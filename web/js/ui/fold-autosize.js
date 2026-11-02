// Textareas inside a closed fold are sized when the fold opens (fix-long-recipe-1, 02/11/2026). The kit's autosize reads
// and writes layout per textarea, one forced reflow each (kp-gaps 02/11/2026), so a 40-step recipe spent seconds sizing
// the second-language text of every step, hidden in its closed "More" fold. Those are switched off (`data-kp-autosize="off"`,
// which the kit's attach skips) until the fold first opens; then they get their attribute back and are attached.

import { attachAutosize } from "/static/kp/dist/kp-themes.min.js";

const ATTR = "data-kp-autosize";

/** Defer the autosize of every textarea in `fold` (a closed `<details>`) until it first opens. @param {HTMLDetailsElement} fold */
export function autosizeWhenOpen(fold) {
  if (fold.open) return;
  const later = [...fold.querySelectorAll(`textarea[${ATTR}]`)].filter((area) => area.getAttribute(ATTR) !== "off");
  if (!later.length) return;
  const was = later.map((area) => /** @type {string} */ (area.getAttribute(ATTR)));
  for (const area of later) area.setAttribute(ATTR, "off");
  const onToggle = () => {
    if (!fold.open) return;
    fold.removeEventListener("toggle", onToggle);
    later.forEach((area, i) => area.setAttribute(ATTR, was[i]));
    attachAutosize(fold);
  };
  fold.addEventListener("toggle", onToggle);
}
