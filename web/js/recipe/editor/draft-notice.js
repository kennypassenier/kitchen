// The quiet notice for a draft that could not be saved (fix-draft-toast-1, 02/11/2026). The draft saves about a second
// after every change, so a dropped connection would fail on every keystroke: the notice shows once, and again only after
// a save has succeeded in between. Every failure is logged with its context. Pure: tested by scripts/draft-notice.test.mjs.

/**
 * @param {{ show: () => void, warn?: (message: string, error: unknown) => void }} o `show` puts the notice up (the kit's
 * toast); `warn` logs a failure (console.warn by default).
 */
export function createDraftNotice({ show, warn = (message, error) => console.warn(message, error) }) {
  let shown = false;
  return {
    /** A save failed: log it, and show the notice unless it is still up from an earlier failure. @param {string} key @param {unknown} error */
    failed(key, error) {
      warn(`the draft ${key} was not saved`, error);
      if (shown) return;
      shown = true;
      show();
    },
    /** A save went through: the next failure is news again. */
    succeeded() {
      shown = false;
    },
    get shown() {
      return shown;
    },
  };
}
