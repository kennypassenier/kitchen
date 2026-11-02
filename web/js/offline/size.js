// A size in the page's language, for the offline copy's usage (feat-offline-kitchen). Pure: the browser's own
// Intl.NumberFormat does the units and the decimal mark, so 1.5 MB reads "1,5 MB" in Dutch. scripts/offline-size.test.mjs.

/** The step between units: the kit counts bytes of stored JSON (chassis-rs data-keep.js `sizeOf`). */
const STEP = 1024;
const UNITS = /** @type {const} */ (["byte", "kilobyte", "megabyte", "gigabyte"]);

/**
 * `bytes` in the largest unit that keeps the number at 1 or more, at most one decimal ("0 bytes", "12 kB", "1.5 MB").
 * A value that is no finite, non-negative number is a programming error and throws, so it is never shown as "NaN".
 * @param {number} bytes @param {"en" | "nl"} lang @returns {string}
 */
export function sizeText(bytes, lang) {
  if (!Number.isFinite(bytes) || bytes < 0) throw new RangeError(`sizeText: ${bytes} is not a size in bytes`);
  let value = bytes;
  let unit = 0;
  while (value >= STEP && unit < UNITS.length - 1) {
    value /= STEP;
    unit += 1;
  }
  const format = new Intl.NumberFormat(lang === "nl" ? "nl-BE" : "en-GB", {
    style: "unit",
    unit: UNITS[unit],
    unitDisplay: unit === 0 ? "long" : "short",
    maximumFractionDigits: unit === 0 ? 0 : 1,
  });
  return format.format(value);
}
