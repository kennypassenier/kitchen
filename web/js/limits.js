// The size limits of what the kitchen stores (fix-field-limits-1, 02/11/2026). These MIRROR src/store/limits.rs, where
// the server enforces them: change a number there and here together. The pages use them as the fields' `maxlength`, so
// the browser stops typing at the limit; the server still refuses anything over it (a paste through another path, a script).

/** Characters in one half (Dutch or English) of a name, a title or a label. */
export const MAX_NAME_CHARS = 200;

/** Characters in any other text: a step, a note, a summary, a shelf text, a log note, an address. */
export const MAX_TEXT_CHARS = 5000;

/** Steps, ingredient lines, tools and tracks in one recipe. */
export const MAX_STEPS = 200;
export const MAX_INGREDIENT_LINES = 200;
export const MAX_TOOLS = 200;
export const MAX_TRACKS = 200;
