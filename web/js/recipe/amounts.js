// The arithmetic of scaling an amount for another number of portions.
//
// Weights and volumes round to a number a person can weigh (5 g steps under
// 250, 10 g above, kilograms and litres from 1000); counted things and
// spoons round to a quarter and are written as kitchen fractions (½ ¼ ¾); a
// pinch never changes; an ingredient with no amount ("to taste") stays
// without one.

/** @typedef {{ id: string, name: string, amount: number | null, unit: string, group?: string, note?: string }} Ingredient */
/** @typedef {import("./words.js").Words} Words */

const FRACTIONS = /** @type {Record<number, string>} */ ({ 0.25: "¼", 0.5: "½", 0.75: "¾" });
/** Units measured on a scale; every other unit counts things. */
const MEASURED = new Set(["g", "ml"]);

/** The unit's word for an amount, plural unless it is one or less. @param {Words} words @param {string} unit @param {number} value */
function unitWord(words, unit, value) {
  const forms = /** @type {Record<string, string[]>} */ (words.units)[unit];
  if (!forms) return unit;
  return value <= 1 ? forms[0] : forms[1];
}

/**
 * One amount for a number of portions: what to write and the unit after it.
 * @param {Ingredient} ing @param {number} factor portions wanted / portions written
 * @param {Words} words @param {boolean} fractions kitchen fractions instead of decimals
 */
export function amountOf(ing, factor, words, fractions = true) {
  const numbers = new Intl.NumberFormat(words.loc, { maximumFractionDigits: 2 });
  if (ing.amount === null || ing.amount === undefined) return { text: "", unit: unitWord(words, ing.unit, 2) };
  if (ing.unit === "pinch") return { text: numbers.format(ing.amount), unit: unitWord(words, ing.unit, ing.amount) };
  let value = ing.amount * factor;
  if (MEASURED.has(ing.unit)) {
    value = value < 10 ? Math.max(0.5, Math.round(value * 2) / 2) : value < 250 ? Math.round(value / 5) * 5 : Math.round(value / 10) * 10;
    if (value >= 1000) return { text: numbers.format(value / 1000), unit: ing.unit === "g" ? words.units.kg[0] : words.units.l[0] };
    return { text: numbers.format(value), unit: unitWord(words, ing.unit, value) };
  }
  value = Math.max(0.25, Math.round(value * 4) / 4);
  const whole = Math.floor(value);
  const part = Math.round((value - whole) * 100) / 100;
  const text = fractions && part > 0 ? `${whole > 0 ? whole : ""}${FRACTIONS[part]}` : numbers.format(value);
  return { text, unit: unitWord(words, ing.unit, value) };
}

/** Minutes as a person says them: "55 min", "1 h 30 min". @param {number} minutes @param {Words} words */
export function minutesText(minutes, words) {
  const m = Math.round(minutes);
  if (m < 60) return `${m} ${words.min}`;
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${hours} ${words.hour} ${rest} ${words.min}` : `${hours} ${words.hour}`;
}
