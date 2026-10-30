use serde_json::Map;

use super::drafts::rfc3339_at;
use super::migrate::{migrate, to_2, to_3};
use super::*;

mod crud;
mod migrate;
mod validate;

pub(super) fn empty() -> Data {
    Data {
        format: FORMAT,
        recipes: vec![],
        freezer: vec![],
        shelf: vec![],
        log: vec![],
        resting: vec![],
        dishes: vec![],
        dish_parts: vec![],
        dish_categories: vec![],
        ingredients: vec![],
        ingredient_categories: vec![],
        drafts: vec![],
        recipe_sources: None,
        settings: Map::new(),
    }
}
