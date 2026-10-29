// Reading the lines of an imported recipe (Kenny, 29/10/2026 14:27): an ingredient line into amount, unit and name, and
// the first duration of a step into minutes. Pure functions, no DOM, no words, no api, so a node script can check them.
// The units are the ones the recipe editor knows (js/recipe/editor.js UNITS); a metric or imperial unit it lacks is
// converted into one it has (1 kg = 1000 g, 1 dl = 100 ml, 1 cup = 240 ml).

/** The vulgar fractions a page may use. */
const FRACTIONS = /** @type {Record<string, number>} */ ({ "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 });
const FRACTION_CLASS = "[½¼¾⅓⅔⅛]";

/** What a written unit becomes: the editor's unit and the factor to its amount. @type {Record<string, [string, number]>} */
const UNIT_WORDS = {};
/** @param {string} unit @param {number} factor @param {string[]} words */
const unit = (unit, factor, words) => words.forEach((w) => (UNIT_WORDS[w] = [unit, factor]));
unit("g", 1, ["g", "gr", "gram", "gramme", "grams", "grammes"]);
unit("g", 1000, ["kg", "kilo", "kilogram", "kilos"]);
unit("g", 28, ["oz", "ounce", "ounces"]);
unit("g", 454, ["lb", "lbs", "pound", "pounds"]);
unit("ml", 1, ["ml", "milliliter", "millilitre", "milliliters", "millilitres"]);
unit("ml", 10, ["cl", "centiliter", "centilitre"]);
unit("ml", 100, ["dl", "deciliter", "decilitre"]);
unit("ml", 1000, ["l", "liter", "litre", "liters", "litres"]);
unit("ml", 240, ["cup", "cups", "kopje", "kopjes"]);
unit("tbsp", 1, ["el", "eetlepel", "eetlepels", "eetl", "tbsp", "tbs", "tablespoon", "tablespoons"]);
unit("tsp", 1, ["tl", "theelepel", "theelepels", "koffielepel", "koffielepels", "kl", "tsp", "teaspoon", "teaspoons"]);
unit("pc", 1, ["stuk", "stuks", "stuk(s)", "st", "pc", "pcs", "piece", "pieces"]);
unit("pinch", 1, ["snuifje", "snuifjes", "snuf", "snufje", "pinch", "pinches"]);
unit("clove", 1, ["teen", "tenen", "teentje", "teentjes", "clove", "cloves"]);
unit("slice", 1, ["plak", "plakken", "plakje", "plakjes", "slice", "slices"]);
unit("handful", 1, ["handvol", "handje", "handful", "handfuls"]);

/** A number at the start of a string: "1½", "½", "1 1/2", "1/2", "2,5", "1.5", "2-3" (a range keeps its first number). @param {string} s @returns {{ value: number, rest: string } | null} */
export function leadingNumber(s) {
  const text = s.trim();
  /** @type {RegExpMatchArray | null} */
  let m;
  let value;
  let end;
  if ((m = text.match(new RegExp(`^(\\d+)\\s*(${FRACTION_CLASS})`)))) {
    value = Number(m[1]) + FRACTIONS[m[2]];
    end = m[0].length;
  } else if ((m = text.match(new RegExp(`^(${FRACTION_CLASS})`)))) {
    value = FRACTIONS[m[1]];
    end = m[0].length;
  } else if ((m = text.match(/^(\d+)\s+(\d+)\/(\d+)(?!\d)/))) {
    value = Number(m[1]) + Number(m[2]) / Number(m[3]);
    end = m[0].length;
  } else if ((m = text.match(/^(\d+)\/(\d+)(?!\d)/))) {
    value = Number(m[2]) ? Number(m[1]) / Number(m[2]) : NaN;
    end = m[0].length;
  } else if ((m = text.match(/^\d+(?:[.,]\d+)?/))) {
    value = Number(m[0].replace(",", "."));
    end = m[0].length;
  } else return null;
  if (!Number.isFinite(value)) return null;
  // A range ("2-3", "2 – 3", "2 to 3", "2 tot 3") keeps its first number: skip the second one.
  let rest = text.slice(end);
  const range = rest.match(/^\s*(?:-|–|—|to|tot|à)\s*(?:\d+(?:[.,]\d+)?(?:\s*\d+\/\d+)?|\d*\s*[½¼¾⅓⅔⅛])/i);
  if (range) rest = rest.slice(range[0].length);
  return { value, rest };
}

/** Round to at most 2 decimals so 1/3 does not write 0.3333333. @param {number} n */
const tidy = (n) => Math.round(n * 100) / 100;

/**
 * An ingredient line as an editor line: `{ amount, unit, name, text }`. `name` is what is left of the line without the
 * amount, the unit, a leading "of"/"van", a trailing note after a comma and anything in brackets; `text` is the line as
 * written. No amount: `amount` is null (the unit "pc" then means nothing).
 * @param {string} line
 */
export function parseIngredientLine(line) {
  const text = line.replace(/\s+/g, " ").trim();
  const num = leadingNumber(text);
  let amount = num ? num.value : null;
  let rest = num ? num.rest.trim() : text;
  let unitName = "pc";
  if (!num) {
    // "snuifje peper", "handvol basilicum": a unit word with no number means one of them.
    const first = rest.match(/^([A-Za-zÀ-ÿ]+)\s+\S/);
    const hit = first ? UNIT_WORDS[first[1].toLowerCase()] : undefined;
    if (hit && ["pinch", "handful", "clove", "slice"].includes(hit[0]) && first) {
      amount = 1;
      unitName = hit[0];
      rest = rest.slice(first[1].length).trim();
    }
  }
  if (num) {
    const m = rest.match(/^([A-Za-zÀ-ÿ]+(?:\(s\))?)\.?(?=$|[\s,;:)(])/);
    const hit = m ? UNIT_WORDS[m[1].toLowerCase()] : undefined;
    if (hit && amount !== null) {
      unitName = hit[0];
      amount = tidy(amount * hit[1]);
      rest = rest.slice(m ? m[0].length : 0).trim();
    } else if (amount !== null) amount = tidy(amount);
  }
  rest = rest.replace(/^(?:of|van|de|het|een|d')\s+/i, "");
  const name = rest
    .replace(/\([^)]*\)/g, " ")
    .split(/[,;]/)[0]
    .replace(/\s+/g, " ")
    .trim();
  return { amount, unit: unitName, name, text };
}

/** The first duration a step names, in minutes: "10 minuten", "10 min", "10 minutes", "1 uur", "1 hour", "1½ uur", "15-20 min" (first). @param {string} text */
export function firstMinutes(text) {
  const m = text.match(
    new RegExp(`(\\d+\\s*${FRACTION_CLASS}|${FRACTION_CLASS}|\\d+(?:[.,]\\d+)?)(?:\\s*(?:-|–|—|to|tot)\\s*\\d+(?:[.,]\\d+)?)?\\s*(minuten|minuut|minutes|minute|mins|min|uren|uur|hours|hour|hrs|hr|h)(?![A-Za-zÀ-ÿ])`, "i"),
  );
  if (!m) return 0;
  const n = leadingNumber(m[1]);
  if (!n) return 0;
  const hours = /^(u|h)/i.test(m[2]);
  return Math.min(1440, Math.max(0, Math.round(n.value * (hours ? 60 : 1))));
}

/** A name without case, accents and the plural endings a recipe line puts on it, for matching the catalogue. @param {string} s */
export const normalName = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** The spellings to try for a name, most exact first: itself, then without a plural ending. @param {string} name */
export function nameForms(name) {
  const n = normalName(name);
  const forms = [n];
  for (const end of ["es", "en", "s"]) {
    if (n.length > end.length + 2 && n.endsWith(end)) {
      const stem = n.slice(0, -end.length);
      forms.push(stem);
      // Dutch open syllable: tomaten -> tomat -> tomaat.
      if (end === "en" && /[^aeiou][aeiou][^aeiou]$/.test(stem)) forms.push(stem.replace(/([aeiou])([^aeiou])$/, "$1$1$2"));
    }
  }
  return forms;
}

/**
 * The catalogue ingredient a name means, comparing both halves case-insensitively; none when nothing matches.
 * @param {string} name @param {{ id: string, name?: { nl?: string, en?: string } }[]} catalogue
 * @returns {string | null}
 */
export function matchIngredient(name, catalogue) {
  if (!name) return null;
  const forms = nameForms(name);
  for (const form of forms) {
    const hit = catalogue.find((i) => [i.name?.nl, i.name?.en].some((half) => half && normalName(String(half)) === form));
    if (hit) return hit.id;
  }
  return null;
}
