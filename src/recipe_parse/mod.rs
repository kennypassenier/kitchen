//! Reading a recipe out of a web page or pasted text (Kenny, 29/10/2026 14:27).
//!
//! Pure functions, no network and no disk, so the fixtures in the tests below
//! cover them. Two sources end in the same [`Imported`] shape:
//!
//! * a page: every `<script type="application/ld+json">` block is parsed as
//!   JSON; the first `Recipe` node (top level, in an array, in `@graph` or in
//!   `mainEntity`) is read. No HTML parser: a small scanner finds the blocks;
//! * pasted text: split by headings (Ingredients / Method, Dutch or English)
//!   into ingredient lines and step lines, bullets and numbers stripped.
//!
//! Nothing here is trusted: every string is stripped of tags and entities,
//! whitespace is collapsed and lists are capped.

use serde_json::{Value, json};

/// The most ingredient lines or steps one import returns.
const MAX_LINES: usize = 200;
/// The longest a single line may be (characters).
const MAX_LINE: usize = 2000;

/// A recipe as the import page needs it.
#[derive(Debug, Default, PartialEq)]
pub struct Imported {
    pub name: String,
    pub portions: Option<u32>,
    pub ingredients: Vec<String>,
    pub steps: Vec<String>,
    pub prep: Option<u32>,
    pub cook: Option<u32>,
    pub total: Option<u32>,
    pub image_url: Option<String>,
    pub source_url: Option<String>,
}

impl Imported {
    pub fn to_json(&self) -> Value {
        json!({
            "name": self.name,
            "portions": self.portions,
            "ingredients": self.ingredients,
            "steps": self.steps,
            "minutes": { "prep": self.prep, "cook": self.cook, "total": self.total },
            "image_url": self.image_url,
            "source_url": self.source_url,
        })
    }

    /// Something worth opening an editor for.
    pub fn usable(&self) -> bool {
        !self.ingredients.is_empty() || !self.steps.is_empty()
    }
}

// ---- text clean-up ------------------------------------------------------------------------------------------------

mod ld_json;
mod pasted;
mod text;

pub use ld_json::from_page;
pub use pasted::from_text;

#[cfg(test)]
mod tests;
