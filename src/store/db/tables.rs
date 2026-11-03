//! Kitchen's tables, field by field (feat-db-schema-1). The fields are the ones `docs/agent/DATA.md` documents; a
//! field a page adds later lands in `k_extra` until a migration gives it a column of its own. Every list is a table of
//! the same name; a dish's recipes and everything inside a recipe are child tables of the dish (Kenny 03/11/2026 06:12
//! "Binnen het gerecht"), so the dish stays the unit that is saved, revised and synced.

use super::recipe_tables::DISH_RECIPES;
use super::spec::{Child, Kind, Nest, Table, child, field};
use Kind::{Bool, Int, Json, Num, Pair, Text};

/// The four fields every top-level item carries: the server-issued `id`, `created`, `updated` and the revision.
macro_rules! top_fields {
    ($($f:expr),* $(,)?) => {
        &[$($f,)* field("id", Text), field("created", Text), field("updated", Text), field("rev", Int)]
    };
}

/// The children of a table without nested lists.
pub(super) const NO_CHILDREN: &[Child] = &[];

pub static DISHES: Table = Table {
    name: "dishes",
    fields: top_fields![
        field("name", Pair),
        field("category", Text),
        field("parents", Bool)
    ],
    children: &[
        child("ingredients", Nest::Strings("dish_ingredients")),
        child("sides", Nest::Rows(&DISH_SIDES)),
        child("recipes", Nest::Rows(&DISH_RECIPES)),
    ],
};

static DISH_SIDES: Table = Table {
    name: "dish_sides",
    fields: &[field("label", Pair)],
    children: &[child("ingredients", Nest::Strings("side_ingredients"))],
};

pub static DISH_CATEGORIES: Table = Table {
    name: "dish_categories",
    fields: top_fields![field("name", Pair), field("order", Num)],
    children: NO_CHILDREN,
};

pub static INGREDIENTS: Table = Table {
    name: "ingredients",
    fields: top_fields![field("name", Pair), field("category", Text)],
    children: NO_CHILDREN,
};

pub static INGREDIENT_CATEGORIES: Table = Table {
    name: "ingredient_categories",
    fields: top_fields![field("name", Pair), field("order", Num)],
    children: NO_CHILDREN,
};

pub static FREEZER: Table = Table {
    name: "freezer",
    fields: top_fields![
        field("dish", Pair),
        field("dish_id", Text),
        field("portions", Num),
        field("frozen_on", Text)
    ],
    children: NO_CHILDREN,
};

pub static SHELF: Table = Table {
    name: "shelf",
    fields: top_fields![
        field("title", Pair),
        field("text", Pair),
        field("minutes", Num),
        field("gear", Pair),
        field("energy", Text)
    ],
    children: NO_CHILDREN,
};

pub static LOG: Table = Table {
    name: "log",
    fields: top_fields![
        field("dish_id", Text),
        field("recipe_id", Text),
        field("shelf_id", Text),
        field("date", Text),
        field("feeling", Text),
        field("note", Text)
    ],
    children: NO_CHILDREN,
};

pub static RESTING: Table = Table {
    name: "resting",
    fields: top_fields![field("dish_id", Text), field("until", Text)],
    children: NO_CHILDREN,
};

pub static DRAFTS: Table = Table {
    name: "drafts",
    fields: top_fields![
        field("key", Text),
        field("data", Json),
        field("saved", Text)
    ],
    children: NO_CHILDREN,
};

pub static RECIPE_SOURCES: Table = Table {
    name: "recipe_sources",
    fields: top_fields![
        field("name", Text),
        field("url", Text),
        field("language", Text),
        field("note", Pair),
        field("verified", Text),
        field("verified_by", Text)
    ],
    children: NO_CHILDREN,
};

/// The settings' known keys; any other key a page sets lands in `k_extra`. One row, `k_row` 1.
pub static SETTINGS: Table = Table {
    name: "settings",
    fields: &[
        field("dinner_time", Text),
        field("lang", Text),
        field("pace", Text),
        field("spare", Num),
        field("odds", Text),
        field("timer_sound", Text),
    ],
    children: NO_CHILDREN,
};

/// The table of a list a page may read and write (`COLLECTIONS`), by its name.
pub fn list_table(name: &str) -> Option<&'static Table> {
    LISTS.iter().copied().find(|t| t.name == name)
}

/// Every list table, in `COLLECTIONS` order.
pub static LISTS: [&Table; 10] = [
    &FREEZER,
    &SHELF,
    &LOG,
    &RESTING,
    &DISHES,
    &DISH_CATEGORIES,
    &INGREDIENTS,
    &INGREDIENT_CATEGORIES,
    &DRAFTS,
    &RECIPE_SOURCES,
];

/// Every table the codec writes, parents before children, for the schema test.
#[cfg(test)]
pub fn all_tables() -> Vec<&'static Table> {
    let mut out = Vec::new();
    for t in LISTS.iter().copied().chain([&SETTINGS]) {
        collect(t, &mut out);
    }
    out
}

#[cfg(test)]
fn collect(t: &'static Table, out: &mut Vec<&'static Table>) {
    out.push(t);
    for c in t.children {
        if let Nest::Rows(inner) | Nest::One(inner) = c.nest {
            collect(inner, out);
        }
    }
}
