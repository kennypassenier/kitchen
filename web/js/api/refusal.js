// A size refusal from the server (fix-field-limits-1): `{error, reason: "too_long" | "too_many", field, limit}` where
// `field` is a path such as `recipes[0].steps[3].text.nl`. Pure: the words come through the `t` that is passed in, so
// node can test it (scripts/refusal.test.mjs). The server's side is src/store/caps.rs.

/** @typedef {{ reason: "too_long" | "too_many", field: string, limit: number }} LimitRefusal */
/** @typedef {(key: string, ...args: any[]) => string} Words */

/** The word key of a field, by its own key in the path; a key not listed is shown as it is. */
export const FIELD_WORDS = /** @type {Record<string, string>} */ ({
  name: "lim.f.name",
  title: "lim.f.title",
  label: "lim.f.label",
  dish: "lim.f.name",
  new_dish: "lim.f.dishName",
  short: "lim.f.short",
  text: "lim.f.text",
  note: "lim.f.note",
  summary: "lim.f.summary",
  gear: "lim.f.gear",
  say: "lim.f.say",
  last_note: "lim.f.lastNote",
  mini_note: "lim.f.miniNote",
  source: "lim.f.source",
  url: "lim.f.url",
  unit: "lim.f.unit",
  group: "lim.f.group",
  amount: "lim.f.amount",
});

/** The word key of one entry of a list ("step 4"), by the list's key. */
export const ENTRY_WORDS = /** @type {Record<string, string>} */ ({
  recipes: "lim.e.recipe",
  steps: "lim.e.step",
  ingredients: "lim.e.ingredient",
  tools: "lim.e.tool",
  tracks: "lim.e.track",
  sides: "lim.e.side",
  uses: "lim.e.use",
  photos: "lim.e.photo",
});

/** The word key of a whole list ("steps"), for a too_many refusal. */
export const LIST_WORDS = /** @type {Record<string, string>} */ ({
  steps: "lim.l.steps",
  ingredients: "lim.l.ingredients",
  tools: "lim.l.tools",
  tracks: "lim.l.tracks",
});

/** The size refusal in an answer's body, or null for any other answer. @param {unknown} data @returns {LimitRefusal | null} */
export function limitOf(data) {
  const d = /** @type {Record<string, unknown> | null} */ (data && typeof data === "object" ? data : null);
  if (!d || (d.reason !== "too_long" && d.reason !== "too_many")) return null;
  if (typeof d.field !== "string" || typeof d.limit !== "number") return null;
  return { reason: d.reason, field: d.field, limit: d.limit };
}

/** `a.b[3].c` as `[{key: "a"}, {key: "b", index: 3}, {key: "c"}]`. @param {string} field */
export function segments(field) {
  return field.split(".").map((part) => {
    const m = /^(.*?)\[(\d+)\]$/.exec(part);
    return m ? { key: m[1], index: Number(m[2]) } : { key: part, index: null };
  });
}

/** The path without its leading `recipes[i]`: the recipe editor edits one recipe, the server checks its whole dish. @param {string} field */
export const withinRecipe = (field) => field.replace(/^recipes\[\d+\]\./, "");

/** The field in words: "step 4, text (Dutch)". @param {string} field @param {Words} t */
export function fieldWords(field, t) {
  const parts = [];
  for (const { key, index } of segments(field)) {
    if (key === "nl" || key === "en") {
      parts.push(`(${t(`lim.lang.${key}`)})`);
    } else if (index !== null) {
      parts.push(ENTRY_WORDS[key] ? t(ENTRY_WORDS[key], index + 1) : `${key} ${index + 1}`);
    } else {
      parts.push(FIELD_WORDS[key] ? t(FIELD_WORDS[key]) : key);
    }
  }
  return parts.join(", ").replace(/, \(/g, " (");
}

/** The sentence a page shows for a size refusal. @param {LimitRefusal} r @param {Words} t */
export function limitWords(r, t) {
  if (r.reason === "too_many") {
    const list = segments(r.field).at(-1)?.key ?? "";
    return t("lim.tooMany", LIST_WORDS[list] ? t(LIST_WORDS[list]) : list, r.limit);
  }
  return t("lim.tooLong", fieldWords(r.field, t), r.limit);
}
