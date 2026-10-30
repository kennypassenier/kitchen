// The parents' wheel page's words, Dutch and English (the page is one module for both languages, Kenny, 22/10/2026).

/** @param {string[]} list @param {string} and */
export const join = (list, and) => (list.length < 2 ? list.join("") : `${list.slice(0, -1).join(", ")} ${and} ${list.at(-1)}`);
/** A choice inside a sentence: "met frieten", never "met Frieten". @param {string} s */
export const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

export const WORDS = {
  nl: {
    cardTitle: "Het eten van vanavond",
    cardText: "Tik op een wiel om het te laten kiezen. Een tik op het kleine wiel kiest opnieuw voor hetzelfde gerecht.",
    answerKicker: "Het avondeten",
    dishKicker: "Het gerecht",
    sideKicker: "Het bijgerecht",
    filterLabel: "Soort eten",
    all: "Alles",
    loading: "De gerechten worden gelezen",
    failedTitle: "De gerechten konden niet gelezen worden",
    emptyTitle: "Er staat nog geen gerecht op dit wiel",
    emptyText: "Kenny zet gerechten op dit wiel vanuit Kitchen; daarna staan ze hier.",
    count: (/** @type {number} */ n) => `${n} ${n === 1 ? "gerecht" : "gerechten"}`,
    sideFirst: "Draai eerst het grote wiel; dan kiest dit wiel het bijgerecht.",
    nothing: (/** @type {string} */ dish) => `${dish}: hier valt niets te kiezen.`,
    tagChoice: (/** @type {string[]} */ sides) => `Met een keuze: ${join(sides.map(lower), "of")}`,
    tagSame: "Altijd op dezelfde manier",
    tagWith: (/** @type {string} */ dish) => `Bij ${dish}`,
    idle: "Tik op het grote wiel; het kiest het eten en het kleine wiel het bijgerecht.",
    turning: "De wielen draaien…",
    tonight: (/** @type {string} */ dish, /** @type {string[]} */ withs) => (withs.length ? `Vanavond: ${dish}, met ${join(withs.map(lower), "en")}.` : `Vanavond: ${dish}.`),
  },
  en: {
    cardTitle: "Tonight's dinner",
    cardText: "Tap a wheel to let it choose. A tap on the small wheel picks again for the same dish.",
    answerKicker: "Dinner",
    dishKicker: "The dish",
    sideKicker: "The side",
    filterLabel: "Kind of food",
    all: "All",
    loading: "Reading the dishes",
    failedTitle: "The dishes could not be read",
    emptyTitle: "No dish is on this wheel yet",
    emptyText: "Open the dishes, add one with a Dutch and an English name and switch on “On the parents' wheel”.",
    count: (/** @type {number} */ n) => `${n} ${n === 1 ? "dish" : "dishes"}`,
    sideFirst: "Spin the big wheel first; then this wheel picks the side.",
    nothing: (/** @type {string} */ dish) => `${dish}: nothing to choose here.`,
    tagChoice: (/** @type {string[]} */ sides) => `With a choice of ${join(sides.map(lower), "or")}`,
    tagSame: "Always the same way",
    tagWith: (/** @type {string} */ dish) => `With ${dish}`,
    idle: "Tap the big wheel; it picks the dish and the small wheel the side.",
    turning: "The wheels are turning…",
    tonight: (/** @type {string} */ dish, /** @type {string[]} */ withs) => (withs.length ? `Tonight: ${dish}, with ${join(withs.map(lower), "and")}.` : `Tonight: ${dish}.`),
  },
};
