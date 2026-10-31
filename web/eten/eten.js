// The parents' wheel on eten.kp-soft.dev, in Dutch and without an account (Kenny, 22/10/2026). The server sends only
// the dishes on the wheel, in Dutch (GET /eten/data, src/parents.rs); the page itself is web/eten/wheel.js, shared
// with Kitchen's English /parents. The package's own words on this page (the wheels, the loading and failed notes)
// are set to Dutch here, before anything is drawn.

import { setStrings } from "/static/kp/dist/kp-themes.min.js";
import { mountWheel } from "./wheel.js";
import { mountThemePicker } from "./theme.js";

setStrings({
  wheelSpin: "Draai",
  wheelSpinAgain: "Nog eens",
  wheelIdleKiosk: "Tik op het wiel om het te laten kiezen.",
  wheelSpinKiosk: "Draai het wiel",
  wheelResting: "Rust even",
  wheelIdle: "Druk op Draai om het wiel te laten kiezen.",
  wheelChose: "Het wiel koos",
  wheelSpinning: "Het wiel draait…",
  wheelOnlyOne: "Er is maar één keuze",
  wheelEmpty: "Er is niets om uit te kiezen.",
  wheelLoading: "De keuzes worden gelezen…",
  wheelFailed: "De keuzes konden niet gelezen worden.",
  cardLoading: "Even geduld…",
  cardEmpty: "Er is nog niets te tonen.",
  cardFailed: "Kon niet gelezen worden.",
  cardRetry: "Probeer opnieuw",
});

/** @param {boolean} _force */
async function load(_force) {
  let res;
  try {
    res = await fetch("/eten/data", { cache: "no-store" });
  } catch {
    throw new Error("De verbinding met de keuken viel weg. Er is niets verloren; probeer opnieuw.");
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* not JSON: handled below */
  }
  if (!res.ok) throw new Error(data?.error ?? `De keuken antwoordde met ${res.status}.`);
  return data;
}

mountThemePicker(/** @type {HTMLElement} */ (document.getElementById("eten-theme")));
mountWheel(/** @type {HTMLElement} */ (document.getElementById("page")), { lang: "nl", load });
