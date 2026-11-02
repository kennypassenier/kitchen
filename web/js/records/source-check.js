// How a recipe source was checked, as its page shows it (Kenny, 02/11/2026 03:43, feat-source-text-1). A source's
// `verified_by` is a plain string anyone can type ("For example: the recipe address you imported"); the six seeded
// sites carry the address of the recipe their import was tested with. Kitchens seeded before 02/11/2026 still hold
// the developer's sentence "Real import fetch (POST /data/import) of <address>": it is read as that address, so every
// kitchen shows the same plain words without a migration of the stored rows. Pure: no DOM, no words
// (scripts/source-check.test.mjs); the item page builds the sentence.

/** The developer's wording the seed carried until 02/11/2026. */
const DEV_PREFIX = /^Real import fetch \(POST \/data\/import\) of\s+/;

/** @typedef {{ kind: "import", url: string, label: string } | { kind: "text", text: string }} Checked */

/** A readable name from a recipe address's last path part: ".../perfect_guacamole/" is "Perfect guacamole". @param {URL} u */
function labelOf(u) {
  const last = u.pathname.split("/").filter(Boolean).pop() ?? "";
  const words = decodeURIComponent(last).replace(/\.[a-z]+$/i, "").replace(/[-_]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : u.hostname.replace(/^www\./, "");
}

/** @param {string} text @returns {URL | null} an http(s) address, or null */
function addressOf(text) {
  if (!/^https?:\/\/\S+$/.test(text)) return null;
  try {
    return new URL(text);
  } catch {
    return null;
  }
}

/**
 * What `verified_by` says: a recipe address (typed, seeded, or behind the old developer's wording) is an import of that
 * recipe; anything else is shown as typed; empty is nothing.
 * @param {unknown} raw @returns {Checked | null}
 */
export function checkedWith(raw) {
  const text = String(raw ?? "").trim().replace(DEV_PREFIX, "");
  if (!text) return null;
  const u = addressOf(text);
  return u ? { kind: "import", url: u.href, label: labelOf(u) } : { kind: "text", text };
}

/** The value the source form starts with: the old developer's wording becomes the bare address. @param {unknown} raw */
export const checkedWithField = (raw) => String(raw ?? "").trim().replace(DEV_PREFIX, "");
