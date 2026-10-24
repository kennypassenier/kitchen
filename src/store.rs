//! The kitchen's data: one JSON file under the state directory.
//!
//! Everything kitchen knows is small (tens of recipes, a freezer, a shelf,
//! a log), so it lives in memory and is written whole after every change,
//! temp + fsync + rename through the kit's `write_atomic`: a crash leaves the
//! old file or the new one, never half of either. The file is plain JSON on
//! purpose: it is the backup, and a person can read it.
//!
//! The collections are documented field by field in `docs/agent/DATA.md`. The
//! server checks only what it must to stay consistent (an object, an `id`
//! it issued, a known collection); the shape of a recipe belongs to the
//! pages, so the screens can grow without a server change.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use tokio::sync::RwLock;

/// The file's own format version; a newer file is refused, not misread.
/// Format 2 (Kenny, 24/10/2026 05:03): a dish holds its own sides and the
/// "kinds of part" list is gone; [`migrate`] lifts a format-1 file.
pub const FORMAT: u32 = 2;

/// The collections a page may read and write. Settings is a single object
/// and has its own routes.
pub const COLLECTIONS: &[&str] = &[
    "recipes",
    "freezer",
    "shelf",
    "log",
    "resting",
    "dishes",
    "dish_categories",
];

/// The first contents of a new kitchen: the two dish categories and the
/// default dinner time, nothing else (Kenny, 24/10/2026 05:04: he enters
/// the real recipes and dishes himself).
const SEED: &str = include_str!("seed.json");

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Data {
    pub format: u32,
    #[serde(default)]
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
    pub settings: Map<String, Value>,
}

impl Data {
    fn collection(&mut self, name: &str) -> Option<&mut Vec<Value>> {
        match name {
            "recipes" => Some(&mut self.recipes),
            "freezer" => Some(&mut self.freezer),
            "shelf" => Some(&mut self.shelf),
            "log" => Some(&mut self.log),
            "resting" => Some(&mut self.resting),
            "dishes" => Some(&mut self.dishes),
            "dish_categories" => Some(&mut self.dish_categories),
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
    NoPortionsLeft,
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
            Refused::NoPortionsLeft => write!(f, "there are no portions of that dish left"),
            Refused::Disk(e) => write!(f, "could not save: {e}"),
        }
    }
}

pub struct Store {
    path: PathBuf,
    data: RwLock<Data>,
}

impl Store {
    /// Open the kitchen in `dir`, seeding it on the very first start.
    pub fn open(dir: &Path) -> Result<Self, String> {
        let path = dir.join("kitchen.json");
        let data = match std::fs::read(&path) {
            Ok(bytes) => {
                let mut data: Data = serde_json::from_slice(&bytes)
                    .map_err(|e| format!("{} is not a kitchen file: {e}", path.display()))?;
                if data.format > FORMAT {
                    return Err(format!(
                        "{} was written by a newer kitchen (format {}); this one reads format {FORMAT}",
                        path.display(),
                        data.format
                    ));
                }
                if data.format < FORMAT {
                    migrate(&mut data);
                    write(&path, &data)?;
                }
                data
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                let data = seed();
                write(&path, &data)?;
                data
            }
            Err(e) => return Err(format!("cannot read {}: {e}", path.display())),
        };
        Ok(Self {
            path,
            data: RwLock::new(data),
        })
    }

    /// An empty kitchen that is never written, for tests.
    #[cfg(test)]
    pub fn in_memory(data: Data) -> Self {
        Self {
            path: PathBuf::new(),
            data: RwLock::new(data),
        }
    }

    pub async fn snapshot(&self) -> Data {
        self.data.read().await.clone()
    }

    pub async fn list(&self, coll: &str) -> Result<Vec<Value>, Refused> {
        let mut d = self.data.write().await;
        d.collection(coll)
            .map(|c| c.clone())
            .ok_or_else(|| Refused::UnknownCollection(coll.into()))
    }

    /// Add an item; the server issues its `id` and `created`.
    pub async fn create(&self, coll: &str, body: Value) -> Result<Value, Refused> {
        let Value::Object(mut obj) = body else {
            return Err(Refused::NotAnObject);
        };
        obj.insert("id".into(), Value::String(uuid::Uuid::new_v4().to_string()));
        obj.insert(
            "created".into(),
            Value::String(chassis::shell::time::now_rfc3339()),
        );
        let item = Value::Object(obj);
        self.change(|d| {
            let c = d
                .collection(coll)
                .ok_or_else(|| Refused::UnknownCollection(coll.into()))?;
            c.push(item.clone());
            Ok(item.clone())
        })
        .await
    }

    /// Replace an item whole; `id` and `created` are kept.
    pub async fn replace(&self, coll: &str, id: &str, body: Value) -> Result<Value, Refused> {
        let Value::Object(mut obj) = body else {
            return Err(Refused::NotAnObject);
        };
        if let Some(given) = obj.get("id")
            && given.as_str() != Some(id)
        {
            return Err(Refused::IdMismatch);
        }
        self.change(|d| {
            let c = d
                .collection(coll)
                .ok_or_else(|| Refused::UnknownCollection(coll.into()))?;
            let slot = c
                .iter_mut()
                .find(|v| v.get("id").and_then(Value::as_str) == Some(id))
                .ok_or(Refused::NotFound)?;
            obj.insert("id".into(), Value::String(id.into()));
            if let Some(created) = slot.get("created") {
                obj.insert("created".into(), created.clone());
            }
            obj.insert(
                "updated".into(),
                Value::String(chassis::shell::time::now_rfc3339()),
            );
            *slot = Value::Object(obj.clone());
            Ok(slot.clone())
        })
        .await
    }

    pub async fn delete(&self, coll: &str, id: &str) -> Result<Value, Refused> {
        self.change(|d| {
            let c = d
                .collection(coll)
                .ok_or_else(|| Refused::UnknownCollection(coll.into()))?;
            let at = c
                .iter()
                .position(|v| v.get("id").and_then(Value::as_str) == Some(id))
                .ok_or(Refused::NotFound)?;
            Ok(c.remove(at))
        })
        .await
    }

    /// Take `n` portions out of a freezer item (negative puts them back,
    /// which is how Undo works). An item at zero stays, so Undo can find it.
    pub async fn take_portions(&self, id: &str, n: i64) -> Result<Value, Refused> {
        self.change(|d| {
            let slot = d
                .freezer
                .iter_mut()
                .find(|v| v.get("id").and_then(Value::as_str) == Some(id))
                .ok_or(Refused::NotFound)?;
            let have = slot.get("portions").and_then(Value::as_i64).unwrap_or(0);
            let left = have - n;
            if left < 0 {
                return Err(Refused::NoPortionsLeft);
            }
            slot["portions"] = Value::from(left);
            Ok(slot.clone())
        })
        .await
    }

    pub async fn settings(&self) -> Map<String, Value> {
        self.data.read().await.settings.clone()
    }

    /// Merge the given keys into the settings; a `null` removes a key.
    pub async fn merge_settings(&self, body: Value) -> Result<Map<String, Value>, Refused> {
        let Value::Object(patch) = body else {
            return Err(Refused::NotAnObject);
        };
        self.change(|d| {
            for (k, v) in &patch {
                if v.is_null() {
                    d.settings.remove(k);
                } else {
                    d.settings.insert(k.clone(), v.clone());
                }
            }
            Ok(d.settings.clone())
        })
        .await
    }

    /// Apply a change and save it; on a failed save the change is undone,
    /// so memory never claims more than the disk holds.
    async fn change<T>(
        &self,
        f: impl FnOnce(&mut Data) -> Result<T, Refused>,
    ) -> Result<T, Refused> {
        let mut d = self.data.write().await;
        let before = d.clone();
        let out = f(&mut d)?;
        if !self.path.as_os_str().is_empty()
            && let Err(e) = write(&self.path, &d)
        {
            *d = before;
            return Err(Refused::Disk(e));
        }
        Ok(out)
    }
}

fn write(path: &Path, data: &Data) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(data).map_err(|e| e.to_string())?;
    chassis::shell::store::write_atomic(path, &bytes, "the kitchen file").map_err(|e| e.to_string())
}

/// Lift a format-1 file to format 2 (Kenny, 24/10/2026 05:03). Each dish's
/// `parts` become its `sides`, in the kinds' order: every choice of a part
/// becomes one side, with `choice` on when its kind was picked by the small
/// wheel. The kinds of part are dropped. Nothing else changes, and no dish
/// is added or removed.
pub fn migrate(data: &mut Data) {
    let kinds = std::mem::take(&mut data.dish_parts);
    let kind = |id: Option<&Value>| {
        let id = id.and_then(Value::as_str)?;
        kinds
            .iter()
            .find(|k| k.get("id").and_then(Value::as_str) == Some(id))
    };
    let order = |k: Option<&Value>| {
        k.and_then(|k| k.get("order"))
            .and_then(Value::as_f64)
            .unwrap_or(f64::MAX)
    };
    for dish in &mut data.dishes {
        let Some(obj) = dish.as_object_mut() else {
            continue;
        };
        let Some(parts) = obj.remove("parts") else {
            continue;
        };
        let mut parts: Vec<&Value> = parts.as_array().into_iter().flatten().collect();
        parts.sort_by(|a, b| order(kind(a.get("part"))).total_cmp(&order(kind(b.get("part")))));
        let mut sides: Vec<Value> = Vec::new();
        for p in parts {
            let choice = kind(p.get("part"))
                .and_then(|k| k.get("wheel"))
                .and_then(Value::as_bool)
                == Some(true);
            for c in p
                .get("choices")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
            {
                sides.push(serde_json::json!({
                    "name": { "nl": c.get("nl").cloned().unwrap_or_default(), "en": c.get("en").cloned().unwrap_or_default() },
                    "choice": choice,
                }));
            }
        }
        obj.entry("sides").or_insert(Value::Array(sides));
    }
    data.format = FORMAT;
}

/// The seed with ids issued, so every item looks as if a page created it.
pub fn seed() -> Data {
    let mut data: Data = serde_json::from_str(SEED).expect("src/seed.json is valid");
    data.format = FORMAT;
    data
}

#[cfg(test)]
mod tests {
    use super::*;

    fn empty() -> Data {
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
            settings: Map::new(),
        }
    }

    #[tokio::test]
    async fn create_replace_delete_round_trip() {
        let s = Store::in_memory(empty());
        let made = s
            .create("recipes", serde_json::json!({"name": "Stoemp"}))
            .await
            .unwrap();
        let id = made["id"].as_str().unwrap().to_string();
        let changed = s
            .replace(
                "recipes",
                &id,
                serde_json::json!({"name": "Stoemp with sausage"}),
            )
            .await
            .unwrap();
        assert_eq!(changed["created"], made["created"]);
        assert_eq!(changed["name"], "Stoemp with sausage");
        s.delete("recipes", &id).await.unwrap();
        assert_eq!(s.delete("recipes", &id).await, Err(Refused::NotFound));
        assert!(matches!(
            s.list("cupboard").await,
            Err(Refused::UnknownCollection(_))
        ));
    }

    #[tokio::test]
    async fn a_portion_cannot_go_below_zero_and_undo_puts_it_back() {
        let s = Store::in_memory(empty());
        let p = s
            .create(
                "freezer",
                serde_json::json!({"dish": "Soup", "portions": 1}),
            )
            .await
            .unwrap();
        let id = p["id"].as_str().unwrap();
        assert_eq!(s.take_portions(id, 1).await.unwrap()["portions"], 0);
        assert_eq!(s.take_portions(id, 1).await, Err(Refused::NoPortionsLeft));
        assert_eq!(s.take_portions(id, -1).await.unwrap()["portions"], 1);
    }

    #[test]
    fn the_seed_holds_only_the_categories() {
        let d = seed();
        assert!(
            d.recipes.is_empty() && d.freezer.is_empty() && d.shelf.is_empty() && d.log.is_empty()
        );
        assert!(d.dishes.is_empty());
        assert_eq!(d.dish_categories.len(), 2);
    }

    #[test]
    fn format_1_parts_become_sides_with_the_small_wheel_as_choice() {
        let mut d: Data = serde_json::from_value(serde_json::json!({
            "format": 1,
            "dish_parts": [
                {"id": "k-sauce", "name": {"nl": "Saus", "en": "Sauce"}, "order": 2},
                {"id": "k-starch", "name": {"nl": "Aardappelen", "en": "Potatoes"}, "order": 1, "wheel": true}
            ],
            "dishes": [
                {"id": "d1", "name": {"nl": "Biefstuk", "en": "Steak"}, "parts": [
                    {"part": "k-sauce", "choices": [{"nl": "Bearnaise", "en": ""}]},
                    {"part": "k-starch", "choices": [{"nl": "Frieten", "en": "Fries"}, {"nl": "Puree", "en": "Mash"}]}
                ]},
                {"id": "d2", "name": {"nl": "Soep", "en": "Soup"}, "parts": []}
            ]
        }))
        .unwrap();
        migrate(&mut d);
        assert_eq!(d.format, FORMAT);
        assert!(d.dish_parts.is_empty());
        assert_eq!(d.dishes.len(), 2);
        assert_eq!(
            d.dishes[0]["sides"],
            serde_json::json!([
                {"name": {"nl": "Frieten", "en": "Fries"}, "choice": true},
                {"name": {"nl": "Puree", "en": "Mash"}, "choice": true},
                {"name": {"nl": "Bearnaise", "en": ""}, "choice": false}
            ])
        );
        assert!(d.dishes[0].get("parts").is_none());
        assert_eq!(d.dishes[1]["sides"], serde_json::json!([]));
        assert!(
            serde_json::to_value(&d)
                .unwrap()
                .get("dish_parts")
                .is_none()
        );
    }
}
