// Navigate from anywhere in the app. The shell routes on `popstate` (main.js), so a pushed address plus that event is the
// same navigation a link makes; a module that has no page context (a row action, a card) needs nothing more.

/** @param {string} href an address inside the app */
export function go(href) {
  history.pushState(null, "", href);
  dispatchEvent(new PopStateEvent("popstate"));
}
