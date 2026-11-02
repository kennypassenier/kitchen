//! The size limits of what the store accepts (fix-field-limits-1, 02/11/2026): one place for the numbers.
//!
//! Kitchen is one JSON file read whole on every page, so an unbounded text or list would make every page slower for
//! everyone. These caps sit far above anything a real recipe needs and only stop runaway input (a paste gone wrong, a
//! script). The pages mirror them in `web/js/limits.js` (the `maxlength` of the fields); keep both in step.

/// Characters in one half (`nl` or `en`) of a name, a title or a label, and in any other name-like string.
pub const MAX_NAME_CHARS: usize = 200;

/// Characters in any other text: a step, a note, a summary, a shelf text, a log note, an address.
pub const MAX_TEXT_CHARS: usize = 5_000;

/// Steps in one recipe.
pub const MAX_STEPS: usize = 200;

/// Ingredient lines in one recipe (and fixed ingredients of a dish, which share the key).
pub const MAX_INGREDIENT_LINES: usize = 200;

/// Tools in one recipe.
pub const MAX_TOOLS: usize = 200;

/// Parallel tracks in one recipe.
pub const MAX_TRACKS: usize = 200;

/// The keys whose string (or each `{nl, en}` half of it) is a name, capped at [`MAX_NAME_CHARS`].
pub const NAME_KEYS: &[&str] = &["name", "title", "label", "dish", "new_dish", "short"];

/// The list keys that have a cap of their own, with that cap.
pub const LIST_CAPS: &[(&str, usize)] = &[
    ("steps", MAX_STEPS),
    ("ingredients", MAX_INGREDIENT_LINES),
    ("tools", MAX_TOOLS),
    ("tracks", MAX_TRACKS),
];
