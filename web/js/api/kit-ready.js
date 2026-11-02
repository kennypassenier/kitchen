// When the kit's runtime has run. The server puts the runtime module into the page AFTER Kitchen's main.js, so
// `window.chassisData` appears only once that module ran. `readyState` is no guide: the browser sets it to
// "interactive" BEFORE it runs the deferred and module scripts (HTML "the end" of parsing), so a call made while
// main.js runs already sees "interactive" with the runtime still to come (fix-kit-ready-1). The client is taken as
// soon as it is there; otherwise the wait ends at DOMContentLoaded (every deferred module ran) or at `load` (when
// DOMContentLoaded already fired), and a page that still has no client is a broken deployment the caller reports.

/**
 * Resolves once `win.chassisData` exists or every deferred module of the page ran.
 * @param {{ chassisData?: unknown, addEventListener: Window["addEventListener"] }} win
 * @param {{ readyState: string, addEventListener: Document["addEventListener"] }} doc
 * @returns {Promise<void>}
 */
export function kitRuntimeRan(win, doc) {
  if (win.chassisData || doc.readyState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => resolve(undefined);
    doc.addEventListener("DOMContentLoaded", done, { once: true });
    win.addEventListener("load", done, { once: true });
  });
}
