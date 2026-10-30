//! The first contents of a new kitchen, and the verified recipe sites a file without that list gets once.

use serde_json::Value;

use super::{Data, FORMAT};

/// The sites a real import fetch proved (Kenny, 29/10/2026 15:11 and 15:12): the first contents of the "Recipe
/// sources" list. A kitchen file without the list gets them once, when it opens; after that the list is Kenny's.
const SOURCES_SEED: &str = include_str!("../recipe_sources_seed.json");

/// The first contents of a new kitchen: the two dish categories and the
/// default dinner time, nothing else (Kenny, 24/10/2026 05:04: he enters
/// the real recipes and dishes himself).
const SEED: &str = include_str!("../seed.json");

/// The seed with ids issued, so every item looks as if a page created it.
pub fn seed() -> Data {
    let mut data: Data = serde_json::from_str(SEED).expect("src/seed.json is valid");
    data.format = FORMAT;
    data.recipe_sources = Some(sources_seed());
    data
}

/// The verified sites, see [`SOURCES_SEED`].
pub(super) fn sources_seed() -> Vec<Value> {
    serde_json::from_str(SOURCES_SEED).expect("src/recipe_sources_seed.json is valid")
}
