//! The shape of the kitchen file: its format version, the collections, the data itself and why a change is refused.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

/// The file's own format version; a newer file is refused, not misread.
/// Format 2 (Kenny, 24/10/2026 05:03): a dish holds its own sides and the
/// "kinds of part" list is gone. Format 3 (05:15, 05:26): one shared list
/// of ingredients; a dish has fixed ingredients and sides of one or more
/// ingredients, a recipe line points at an ingredient. [`migrate`] lifts
/// older files. Format 4 (Kenny, 24/10/2026 09:17, 09:18, 09:27): recipes
/// live inside their dish (`dish.recipes`, one the default), and the log,
/// the freezer and resting point at dishes (`dish_id`). Format 5 (10:04):
/// a shelf food's title, text and gear and a freezer item's name are
/// `{nl, en}` like every other name. The `drafts` list (Kenny, 29/10/2026)
/// is optional in the file, so the format stays 5.
pub const FORMAT: u32 = 5;

/// The collections a page may read and write. Settings is a single object
/// and has its own routes.
pub const COLLECTIONS: &[&str] = &[
    "freezer",
    "shelf",
    "log",
    "resting",
    "dishes",
    "dish_categories",
    "ingredients",
    "ingredient_categories",
    "drafts",
    "recipe_sources",
];

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Data {
    pub format: u32,
    /// Format 3's recipes, read only so [`migrate`] can move each into its
    /// dish; never written again.
    #[serde(default, skip_serializing)]
    pub recipes: Vec<Value>,
    #[serde(default)]
    pub freezer: Vec<Value>,
    #[serde(default)]
    pub shelf: Vec<Value>,
    #[serde(default)]
    pub log: Vec<Value>,
    #[serde(default)]
    pub resting: Vec<Value>,
    #[serde(default)]
    pub dishes: Vec<Value>,
    /// Format 1's kinds of part, read only so [`migrate`] can lift them
    /// into the dishes; never written again.
    #[serde(default, skip_serializing)]
    pub dish_parts: Vec<Value>,
    #[serde(default)]
    pub dish_categories: Vec<Value>,
    #[serde(default)]
    pub ingredients: Vec<Value>,
    #[serde(default)]
    pub ingredient_categories: Vec<Value>,
    /// The recipe editor's autosaved forms (Kenny, 29/10/2026): `{key, data, saved}`,
    /// one per `key` (a recipe id, or `new:<dish id>`); see [`Store::create`].
    #[serde(default)]
    pub drafts: Vec<Value>,
    /// Websites whose recipe pages the import reads well (Kenny, 29/10/2026 15:11): `{name, url, language, note?, verified,
    /// verified_by}`. Absent in a file written before it existed, which [`Store::open`] fills once from
    /// [`SOURCES_SEED`]; the format stays 5.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recipe_sources: Option<Vec<Value>>,
    #[serde(default)]
    pub settings: Map<String, Value>,
}

impl Data {
    pub(super) fn collection(&mut self, name: &str) -> Option<&mut Vec<Value>> {
        match name {
            "freezer" => Some(&mut self.freezer),
            "shelf" => Some(&mut self.shelf),
            "log" => Some(&mut self.log),
            "resting" => Some(&mut self.resting),
            "dishes" => Some(&mut self.dishes),
            "dish_categories" => Some(&mut self.dish_categories),
            "ingredients" => Some(&mut self.ingredients),
            "ingredient_categories" => Some(&mut self.ingredient_categories),
            "drafts" => Some(&mut self.drafts),
            "recipe_sources" => Some(self.recipe_sources.get_or_insert_with(Vec::new)),
            _ => None,
        }
    }
}

/// Why a change was refused, in words a page can show as they are.
#[derive(Debug, PartialEq)]
pub enum Refused {
    UnknownCollection(String),
    NotAnObject,
    NotFound,
    IdMismatch,
    /// A draft without its `key`.
    NoKey,
    NoPortionsLeft,
    /// A name that must be in both languages misses one (the field, as `name.en`).
    MissingName(String),
    /// A recipe's `source` that is not an http(s) address (the field, as `recipes[0].source`).
    BadSource(String),
    /// A recipe source that misses its name, address or language (the sentence a page shows).
    BadRecipeSource(String),
    Disk(String),
}

impl std::fmt::Display for Refused {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Refused::UnknownCollection(c) => write!(
                f,
                "there is no list called {c:?}; the lists are {}",
                COLLECTIONS.join(", ")
            ),
            Refused::NotAnObject => write!(f, "send one JSON object"),
            Refused::NotFound => write!(f, "that item does not exist (any more)"),
            Refused::IdMismatch => {
                write!(f, "the id in the body differs from the id in the address")
            }
            Refused::NoKey => write!(f, "a draft needs a key: the recipe it belongs to"),
            Refused::NoPortionsLeft => write!(f, "there are no portions of that dish left"),
            Refused::MissingName(field) => write!(
                f,
                "{field} is empty: every name needs its Dutch and its English half"
            ),
            Refused::BadSource(field) => write!(
                f,
                "{field} must be a web address starting with http:// or https://, or empty"
            ),
            Refused::BadRecipeSource(why) => write!(f, "{why}"),
            Refused::Disk(e) => write!(f, "could not save: {e}"),
        }
    }
}
