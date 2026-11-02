// Reads and one write that go straight to the service and never touch the shared copy (split out of web/js/api.js,
// refactor-api-split-1): the recipe import and the parents' wheel lists. web/js/api.js re-exports all three.

import { call } from "./http.js";
import { readJson } from "./kit-data.js";

/** A recipe read from a web page (`{ url }`) or pasted text (`{ text }`), normalised; a refusal's message is its code (src/import.rs). @param {{ url?: string, text?: string }} body */
export const importRecipe = (body) => call("POST", "/data/import", body);

/** The parents' wheel in English, made by the server from the dishes (src/parents.rs). */
export const readWheelEnglish = async () => (await readJson("/data/wheel/en")).data;
/** The same list in Dutch, behind the login: Kitchen's /parents in Dutch, also away from home. */
export const readWheelDutch = async () => (await readJson("/data/wheel/nl")).data;
