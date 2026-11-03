//! The tables inside a dish's recipes (feat-db-schema-1, Kenny 03/11/2026 06:12 "Binnen het gerecht"): a recipe is
//! a child row of its dish, and its tools, tracks, ingredient lines and steps (with each step's timer, uses and
//! photos) are child rows of the recipe. None of them is synced on its own: the dish is the unit.

use super::spec::{Kind, Nest, Table, child, field};
use super::tables::NO_CHILDREN;
use Kind::{Bool, Num, Pair, Text, TextOrPair};

pub(super) static DISH_RECIPES: Table = Table {
    name: "dish_recipes",
    fields: &[
        field("id", Text),
        field("label", Pair),
        field("default", Bool),
        field("short", Text),
        field("summary", Text),
        field("minutes", Num),
        field("hands_on", Num),
        field("minutes_override", Num),
        field("hands_on_override", Num),
        field("portions", Num),
        field("prep", Text),
        field("safe", Bool),
        field("gear", Text),
        field("last_note", Text),
        field("mini_note", Text),
        field("source", Text),
        field("photo", Text),
    ],
    children: &[
        child("meals", Nest::Strings("recipe_meals")),
        child("ing", Nest::Strings("recipe_ing")),
        child("tools", Nest::Rows(&RECIPE_TOOLS)),
        child("tracks", Nest::Rows(&RECIPE_TRACKS)),
        child("ingredients", Nest::Rows(&RECIPE_LINES)),
        child("steps", Nest::Rows(&RECIPE_STEPS)),
    ],
};

static RECIPE_TOOLS: Table = Table {
    name: "recipe_tools",
    fields: &[field("id", Text), field("name", Text)],
    children: NO_CHILDREN,
};

static RECIPE_TRACKS: Table = Table {
    name: "recipe_tracks",
    fields: &[field("id", Text), field("name", Text)],
    children: NO_CHILDREN,
};

static RECIPE_LINES: Table = Table {
    name: "recipe_lines",
    fields: &[
        field("id", Text),
        field("ingredient", Text),
        field("amount", Num),
        field("unit", Text),
        field("group", Text),
        field("note", TextOrPair),
    ],
    children: NO_CHILDREN,
};

static RECIPE_STEPS: Table = Table {
    name: "recipe_steps",
    fields: &[
        field("id", Text),
        field("track", Text),
        field("text", TextOrPair),
        field("say", Text),
        field("mins", Num),
        field("active", Bool),
        field("note", TextOrPair),
        field("note_tone", Text),
        field("mini", Bool),
        field("start", Num),
        field("with", Text),
    ],
    children: &[
        child("timer", Nest::One(&STEP_TIMERS)),
        child("uses", Nest::Rows(&STEP_USES)),
        child("photos", Nest::Strings("step_photos")),
    ],
};

static STEP_TIMERS: Table = Table {
    name: "step_timers",
    fields: &[field("seconds", Num), field("name", Text)],
    children: NO_CHILDREN,
};

static STEP_USES: Table = Table {
    name: "step_uses",
    fields: &[field("amount", Text), field("name", Text)],
    children: NO_CHILDREN,
};
