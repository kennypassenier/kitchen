// How the freezer form's names follow the "From the dish" pick. Run: node scripts/freezer-names.test.mjs
import assert from "node:assert/strict";
import { namesOf, afterPick } from "../web/js/pages/baddays/freezer-names.js";

const soup = { name: { nl: "Soep", en: "Soup" } };
const stew = { name: { nl: "Stoof", en: "Stew" } };
assert.deepEqual(namesOf(soup), { nl: "Soep", en: "Soup" });
assert.deepEqual(namesOf({ name: { nl: "Alleen" } }), { nl: "Alleen", en: "" }, "a half name stays half");
assert.deepEqual(namesOf(null), { nl: "", en: "" });

let r = afterPick({ dish: soup, filled: null, current: { nl: "iets", en: "" } });
assert.deepEqual(r.names, { nl: "Soep", en: "Soup" }, "a dish fills both, over whatever stood there");
r = afterPick({ dish: stew, filled: r.filled, current: r.names });
assert.deepEqual(r.names, { nl: "Stoof", en: "Stew" }, "another dish replaces the fill");
const back = afterPick({ dish: null, filled: r.filled, current: r.names });
assert.deepEqual(back.names, { nl: "", en: "" }, "no dish empties names the dish filled");
assert.equal(back.filled, null);
const typed = afterPick({ dish: null, filled: r.filled, current: { nl: "Stoof extra", en: "Stew" } });
assert.deepEqual(typed.names, { nl: "Stoof extra", en: "Stew" }, "no dish keeps names someone changed");
assert.deepEqual(afterPick({ dish: null, filled: null, current: { nl: "x", en: "y" } }).names, { nl: "x", en: "y" }, "nothing filled, nothing emptied");
console.log("freezer-names: ok");
