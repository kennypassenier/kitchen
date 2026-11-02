// STAND-IN for kp-themes 2bc105c2b ("An empty or failed data table keeps its loaded footprint without js/footprint.js").
// Remove when Kitchen's chassis-rs carries the kp-themes release with this fix (docs/OPEN.md), then re-measure.
//
// kp-themes 12.2.0 holds an empty or failed table's plate at the rows block's loaded height (--kp-datatable-held), but the
// count line, the pager bar and the sort summary leave while the plate stands, so the table came out 9-41 px lower than
// loaded (release checks 02/11/2026). As in that commit, the plate also takes the height of what leaves, with its gap:
// measured while the table is not covered, written as the slots' minimum around kp's own --kp-datatable-held.

const COVERED = "data-kp-state-covered";
const SLOTS = ":scope > [data-kp-datatable-empty], :scope > [data-kp-datatable-failed]";

/** What leaves while a plate covers the rows (kp css one-state-plate-for-every.css). @param {HTMLElement} wrap */
function leaving(wrap) {
  const bars = [...wrap.querySelectorAll(":scope > .kp-datatable__bar:not(:has([data-kp-datatable-search]))")].filter(
    (bar) => bar.querySelector(":scope > [data-kp-datatable-status], :scope > [data-kp-datatable-pager]") !== null,
  );
  return [...bars, ...wrap.querySelectorAll("[data-kp-datatable-sort-summary]")];
}

/** Record what leaves, with its gap, as the minimum of both state slots. @param {HTMLElement} wrap */
function hold(wrap) {
  if (wrap.hasAttribute(COVERED)) return;
  const gap = parseFloat(getComputedStyle(wrap).rowGap) || 0;
  let sum = 0;
  for (const el of leaving(wrap)) {
    const h = el.getBoundingClientRect().height;
    if (h > 0) sum += h + gap;
  }
  const min = `max(var(--kp-stateplate-floor, 12rem), min(calc(var(--kp-datatable-held, 0px) + ${sum.toFixed(2)}px), var(--kp-footprint-max, 48rem)))`;
  for (const slot of /** @type {NodeListOf<HTMLElement>} */ (wrap.querySelectorAll(SLOTS))) slot.style.minBlockSize = min;
}

const sizes = new ResizeObserver((entries) => {
  for (const entry of entries) hold(/** @type {HTMLElement} */ (entry.target.closest(".kp-datatable")));
});
const seen = new WeakSet();

/** Watch every data table the app draws, now and later. Called once, from main.js. */
export function holdDatatableFootprints() {
  const scan = () => {
    for (const wrap of document.querySelectorAll(".kp-datatable")) {
      if (seen.has(wrap)) continue;
      seen.add(wrap);
      sizes.observe(wrap);
    }
  };
  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
}
