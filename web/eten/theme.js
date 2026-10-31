// The theme picker on the parents' page (Kenny, 24/10/2026 09:29: "a theme picker on the parents' page, top right, the
// kit's picker in Dutch, the choice kept in that browser"). It is the kit's own menu (js/theme-picker.js) and nothing
// home-made. The page has no account, so the choice lives only in this browser's localStorage key `theme`, the key the
// kit's no-flash snippet (/static/theme-boot.js, loaded in the page's head) reads before the first paint.
//
// The picker's words are set here, not taken from Kitchen's kp-nl.js: that file sits under /js/, behind the login, and
// this page may load only /eten/ and /static/.

import { setStrings, attachThemePickers, themeMenuMarkup } from "/static/kp/dist/kp-themes.min.js";

const LABEL = "Thema";

setStrings({
  themePicker: "Kies een thema",
  themeSaveFailed: "Deze keuze wordt niet onthouden: opslag is geblokkeerd in deze browser.",
  themeSaveRefused: "Niet bewaard op de server: je keuze is teruggezet.",
  themeGroupLight: "Licht",
  themeGroupDark: "Donker",
});

/** Draw the menu into `host` and wire it. @param {HTMLElement} host */
export function mountThemePicker(host) {
  host.innerHTML = themeMenuMarkup({ id: "eten-theme-menu", label: LABEL });
  attachThemePickers(host);
}
