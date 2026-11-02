// kp-themes split delivery: each theme's register is a stylesheet of its own. /static/theme-boot.js (in each page's head,
// below kp-themes-base.min.css) writes the worn theme's register link before the first paint; this adopts that link and
// fetches the register of a theme the visitor picks, holding the change until the file has loaded. Call it once per page,
// before the theme pickers, which are what start a change. It lives under /eten/ because the parents' page may load only
// /eten/ and /static/, and the main app (web/js/main.js) uses the same file.

import { attachLazyRegisters } from "/static/kp/dist/js/lazy-register.js";

/** Attach the lazy registers with the pattern the page's theme-boot tag carries; warn when the tag has none. */
export function attachThemeRegisters() {
  const boot = document.querySelector("script[data-register-pattern]");
  const pattern = boot?.getAttribute("data-register-pattern");
  if (!pattern) {
    console.warn("kitchen: theme-boot.js carries no data-register-pattern; a picked theme will not load its register");
    return;
  }
  attachLazyRegisters({ pattern });
}
