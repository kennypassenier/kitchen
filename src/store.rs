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
/// "kinds of part" list is gone. Format 3 (05:15, 05:26): one shared list
/// of ingredients; a dish has fixed ingredients and sides of one or more
/// ingredients, a recipe line points at an ingredient. [`migrate`] lifts
/// older files. Format 4 (Kenny, 24/10/2026 09:17, 09:18, 09:27): recipes
/// live inside their dish (`dish.recipes`, one the default), and the log,
/// the freezer and resting point at dishes (`dish_id`).
pub const FORMAT: u32 = 4;

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
];

/// The first contents of a new kitchen: the two dish categories and the
/// default dinner time, nothing else (Kenny, 24/10/2026 05:04: he enters
/// the real recipes and dishes himself).
const SEED: &str = include_str!("seed.json");

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
    #[serde(default)]
    pub settings: Map<String, Value>,
}

impl Data {
    fn collection(&mut self, name: &str) -> Option<&mut Vec<Value>> {
        match name {
            "freezer" => Some(&mut self.freezer),
            "shelf" => Some(&mut self.shelf),
            "log" => Some(&mut self.log),
            "resting" => Some(&mut self.resting),
            "dishes" => Some(&mut self.dishes),
            "dish_categories" => Some(&mut self.dish_categories),
            "ingredients" => Some(&mut self.ingredients),
            "ingredient_categories" => Some(&mut self.ingredient_categories),
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
    /// A name that must be in both languages misses one (the field, as `name.en`).
    MissingName(String),
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
            Refused::MissingName(field) => write!(
                f,
                "{field} is empty: every name needs its Dutch and its English half"
            ),
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
        both_names(coll, &obj)?;
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
        both_names(coll, &obj)?;
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

/// Every name in Kitchen has its Dutch and its English half (Kenny,
/// 24/10/2026 10:04): a dish, a dish category, an ingredient and an
/// ingredient category need both, and a side's or a recipe's own label,
/// when it has one, needs both too. Items stored before that rule keep
/// what they have until they are saved again.
fn both_names(coll: &str, obj: &Map<String, Value>) -> Result<(), Refused> {
    let filled = |v: Option<&Value>, lang: &str| {
        v.and_then(|n| n.get(lang))
            .and_then(Value::as_str)
            .is_some_and(|s| !s.trim().is_empty())
    };
    let whole = |v: Option<&Value>, at: &str| -> Result<(), Refused> {
        for lang in ["nl", "en"] {
            if !filled(v, lang) {
                return Err(Refused::MissingName(format!("{at}.{lang}")));
            }
        }
        Ok(())
    };
    // A label is optional, but a label given in one language only is half a name.
    let label = |v: Option<&Value>, at: &str| -> Result<(), Refused> {
        if filled(v, "nl") || filled(v, "en") {
            whole(v, at)?;
        }
        Ok(())
    };
    if !matches!(
        coll,
        "dishes" | "dish_categories" | "ingredients" | "ingredient_categories"
    ) {
        return Ok(());
    }
    whole(obj.get("name"), "name")?;
    if coll == "dishes" {
        for (i, s) in obj
            .get("sides")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .enumerate()
        {
            label(s.get("label"), &format!("sides[{i}].label"))?;
        }
        for (i, r) in obj
            .get("recipes")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .enumerate()
        {
            label(r.get("label"), &format!("recipes[{i}].label"))?;
        }
    }
    Ok(())
}

/// Lift an older file to [`FORMAT`], one format at a time.
pub fn migrate(data: &mut Data) {
    if data.format < 2 {
        to_2(data);
    }
    if data.format < 3 {
        to_3(data);
    }
    if data.format < 4 {
        to_4(data);
    }
    data.format = FORMAT;
}

/// Format 1 to 2 (Kenny, 24/10/2026 05:03). Each dish's `parts` become its
/// `sides`, in the kinds' order: every choice of a part becomes one side,
/// with `choice` on when its kind was picked by the small wheel. The kinds
/// of part are dropped. Nothing else changes, and no dish is added or
/// removed.
fn to_2(data: &mut Data) {
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
    data.format = 2;
}

/// The id of the ingredient named `nl` or `en` (any case), made when there
/// is none yet; a half the ingredient misses is filled from the name given.
fn ingredient_id(list: &mut Vec<Value>, other: &str, nl: &str, en: &str) -> Option<String> {
    let (nl, en) = (nl.trim(), en.trim());
    if nl.is_empty() && en.is_empty() {
        return None;
    }
    let same = |v: &Value, lang: &str, name: &str| {
        !name.is_empty()
            && v["name"][lang]
                .as_str()
                .is_some_and(|n| n.trim().to_lowercase() == name.to_lowercase())
    };
    if let Some(found) = list
        .iter_mut()
        .find(|v| same(v, "nl", nl) || same(v, "en", en))
    {
        for (lang, name) in [("nl", nl), ("en", en)] {
            if !name.is_empty()
                && found["name"][lang]
                    .as_str()
                    .is_none_or(|n| n.trim().is_empty())
            {
                found["name"][lang] = Value::from(name);
            }
        }
        return found["id"].as_str().map(str::to_string);
    }
    let id = uuid::Uuid::new_v4().to_string();
    list.push(serde_json::json!({
        "id": id,
        "name": { "nl": nl, "en": en },
        "category": other,
        "created": chassis::shell::time::now_rfc3339(),
    }));
    Some(id)
}

/// Format 2 to 3 (Kenny, 24/10/2026 05:15, 05:26). Every distinct side name
/// and recipe ingredient name becomes one ingredient (matched on its Dutch
/// or English name, any case; a recipe line's name is English), in the
/// category "Andere" / "Other", made when missing. A dish's side with
/// `choice` on becomes a side of one ingredient (`sides: [{ingredients:
/// [id]}]`, one entry on the small wheel); one with `choice` off becomes
/// one of the dish's fixed `ingredients`. A recipe line keeps its amount,
/// unit, group and note and gets `ingredient` instead of `name`. Nothing
/// else changes.
fn to_3(data: &mut Data) {
    let is_other = |c: &Value| {
        c["name"]["en"]
            .as_str()
            .is_some_and(|n| n.trim().eq_ignore_ascii_case("other"))
    };
    let other = match data.ingredient_categories.iter().find(|c| is_other(c)) {
        Some(c) => c["id"].as_str().unwrap_or_default().to_string(),
        None => {
            let id = uuid::Uuid::new_v4().to_string();
            data.ingredient_categories.push(serde_json::json!({
                "id": id,
                "name": { "nl": "Andere", "en": "Other" },
                "order": data.ingredient_categories.len() + 1,
                "created": chassis::shell::time::now_rfc3339(),
            }));
            id
        }
    };
    let mut list = std::mem::take(&mut data.ingredients);
    for dish in &mut data.dishes {
        let Some(obj) = dish.as_object_mut() else {
            continue;
        };
        let old = obj
            .remove("sides")
            .and_then(|v| v.as_array().cloned())
            .unwrap_or_default();
        let mut fixed: Vec<Value> = Vec::new();
        let mut sides: Vec<Value> = Vec::new();
        for side in &old {
            let half = |lang: &str| side["name"][lang].as_str().unwrap_or_default().to_string();
            let Some(id) = ingredient_id(&mut list, &other, &half("nl"), &half("en")) else {
                continue;
            };
            if side.get("choice").and_then(Value::as_bool) == Some(true) {
                sides.push(serde_json::json!({ "ingredients": [id] }));
            } else if !fixed.contains(&Value::String(id.clone())) {
                fixed.push(Value::String(id));
            }
        }
        obj.insert("ingredients".into(), Value::Array(fixed));
        obj.insert("sides".into(), Value::Array(sides));
    }
    for recipe in &mut data.recipes {
        let Some(lines) = recipe.get_mut("ingredients").and_then(Value::as_array_mut) else {
            continue;
        };
        for line in lines.iter_mut() {
            let Some(obj) = line.as_object_mut() else {
                continue;
            };
            let name = obj
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            if let Some(id) = ingredient_id(&mut list, &other, "", &name) {
                obj.remove("name");
                obj.insert("ingredient".into(), Value::String(id));
            }
        }
    }
    data.ingredients = list;
    data.format = 3;
}

/// Format 3 to 4 (Kenny, 24/10/2026 09:17, 09:18, 09:27): the recipe belongs
/// to the dish, and a dish may have several (`dish.recipes`, one marked
/// `default`). Each recipe moves into the dish that linked it
/// (`recipe_id`), else the dish with its name (Dutch or English, any case),
/// else a new dish named after it; it keeps its id and every field but its
/// name, created and updated, gets an empty `label` (the pages say "Recipe
/// 1", "Recipe 2" until Kenny names it) and is the default when it is the
/// dish's first. A log line keeps its `recipe_id` and gets the dish's
/// `dish_id`; a freezer item and a resting mark get `dish_id` instead of
/// `recipe_id`. Nothing is added or removed but the new dishes that carry a
/// recipe and the resting marks whose recipe is gone.
fn to_4(data: &mut Data) {
    let recipes = std::mem::take(&mut data.recipes);
    let mut moved: Vec<(String, String)> = Vec::new();
    for r in recipes {
        let Some(rid) = r.get("id").and_then(Value::as_str).map(str::to_string) else {
            continue;
        };
        let name = r
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .trim()
            .to_string();
        let mut body = r.clone();
        if let Some(obj) = body.as_object_mut() {
            for k in ["name", "created", "updated"] {
                obj.remove(k);
            }
            obj.insert("label".into(), serde_json::json!({ "nl": "", "en": "" }));
        }
        let same = |d: &Value| {
            ["nl", "en"].iter().any(|l| {
                !name.is_empty()
                    && d["name"][l]
                        .as_str()
                        .is_some_and(|n| n.trim().eq_ignore_ascii_case(&name))
            })
        };
        let at = data
            .dishes
            .iter()
            .position(|d| d.get("recipe_id").and_then(Value::as_str) == Some(rid.as_str()))
            .or_else(|| data.dishes.iter().position(same));
        let at = match at {
            Some(i) => i,
            None => {
                data.dishes.push(serde_json::json!({
                    "id": uuid::Uuid::new_v4().to_string(),
                    "name": { "nl": "", "en": name },
                    "category": null,
                    "parents": false,
                    "ingredients": [],
                    "sides": [],
                    "recipes": [],
                    "created": r.get("created").cloned().unwrap_or(Value::Null),
                }));
                data.dishes.len() - 1
            }
        };
        let dish = &mut data.dishes[at];
        if !dish.get("recipes").is_some_and(Value::is_array) {
            dish["recipes"] = Value::Array(Vec::new());
        }
        let list = dish["recipes"].as_array_mut().expect("just made an array");
        body["default"] = Value::Bool(list.is_empty());
        list.push(body);
        moved.push((rid, dish["id"].as_str().unwrap_or_default().to_string()));
    }
    for d in &mut data.dishes {
        if let Some(obj) = d.as_object_mut() {
            obj.remove("recipe_id");
            obj.entry("recipes").or_insert(Value::Array(Vec::new()));
        }
    }
    let dish_of = |rid: &Value| -> Value {
        rid.as_str()
            .and_then(|rid| moved.iter().find(|(r, _)| r == rid))
            .map(|(_, d)| Value::String(d.clone()))
            .unwrap_or(Value::Null)
    };
    for line in &mut data.log {
        if let Some(obj) = line.as_object_mut()
            && let Some(rid) = obj.get("recipe_id").cloned()
        {
            obj.insert("dish_id".into(), dish_of(&rid));
        }
    }
    for list in [&mut data.freezer, &mut data.resting] {
        for item in list.iter_mut() {
            if let Some(obj) = item.as_object_mut()
                && let Some(rid) = obj.remove("recipe_id")
            {
                obj.insert("dish_id".into(), dish_of(&rid));
            }
        }
    }
    data.resting
        .retain(|r| r.get("dish_id").is_some_and(|d| !d.is_null()));
    data.format = 4;
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
            ingredients: vec![],
            ingredient_categories: vec![],
            settings: Map::new(),
        }
    }

    #[tokio::test]
    async fn create_replace_delete_round_trip() {
        let s = Store::in_memory(empty());
        let made = s
            .create("shelf", serde_json::json!({"name": "Stoemp"}))
            .await
            .unwrap();
        let id = made["id"].as_str().unwrap().to_string();
        let changed = s
            .replace(
                "shelf",
                &id,
                serde_json::json!({"name": "Stoemp with sausage"}),
            )
            .await
            .unwrap();
        assert_eq!(changed["created"], made["created"]);
        assert_eq!(changed["name"], "Stoemp with sausage");
        s.delete("shelf", &id).await.unwrap();
        assert_eq!(s.delete("shelf", &id).await, Err(Refused::NotFound));
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
        assert!(d.ingredients.is_empty());
        assert_eq!(d.ingredient_categories.len(), 1);
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
        to_2(&mut d);
        assert_eq!(d.format, 2);
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

    #[tokio::test]
    async fn a_name_needs_both_halves() {
        let s = Store::in_memory(empty());
        let half = serde_json::json!({"name": {"nl": "Frieten", "en": ""}});
        assert_eq!(
            s.create("ingredients", half).await,
            Err(Refused::MissingName("name.en".into()))
        );
        let ok = s
            .create(
                "ingredients",
                serde_json::json!({"name": {"nl": "Frieten", "en": "Fries"}}),
            )
            .await
            .unwrap();
        let id = ok["id"].as_str().unwrap();
        let blank = serde_json::json!({"name": {"nl": " ", "en": "Fries"}});
        assert_eq!(
            s.replace("ingredients", id, blank).await,
            Err(Refused::MissingName("name.nl".into()))
        );
        let side = serde_json::json!({"name": {"nl": "Stoofvlees", "en": "Beef stew"}, "sides": [{"ingredients": [], "label": {"nl": "Kroketten", "en": ""}}]});
        assert_eq!(
            s.create("dishes", side).await,
            Err(Refused::MissingName("sides[0].label.en".into()))
        );
        let no_label = serde_json::json!({"name": {"nl": "Stoofvlees", "en": "Beef stew"}, "sides": [{"ingredients": []}], "recipes": [{"label": {"nl": "", "en": ""}}]});
        assert!(s.create("dishes", no_label).await.is_ok());
        assert!(
            s.create("shelf", serde_json::json!({"title": "Toast"}))
                .await
                .is_ok()
        );
    }

    #[test]
    fn format_3_recipes_move_into_their_dishes() {
        let mut d: Data = serde_json::from_value(serde_json::json!({
            "format": 3,
            "recipes": [
                {"id": "r1", "name": "Stoofvlees", "minutes": 150, "steps": [], "created": "x"},
                {"id": "r2", "name": "Pancakes", "minutes": 30},
                {"id": "r3", "name": "Soup", "minutes": 20},
                {"id": "r4", "name": "stoofvlees", "minutes": 90}
            ],
            "dishes": [
                {"id": "d1", "name": {"nl": "Stoofvlees", "en": "Beef stew"}, "recipe_id": null},
                {"id": "d2", "name": {"nl": "Soep", "en": "Tomato soup"}, "recipe_id": "r3"}
            ],
            "log": [{"id": "l1", "recipe_id": "r2", "date": "2026-10-01"}, {"id": "l2", "shelf_id": "s1"}],
            "freezer": [{"id": "f1", "dish": "Stew", "recipe_id": "r1"}],
            "resting": [{"id": "x", "recipe_id": "r3", "until": "2026-10-30"}, {"id": "y", "recipe_id": "gone", "until": "2026-10-30"}]
        }))
        .unwrap();
        migrate(&mut d);
        assert_eq!(d.format, FORMAT);
        assert!(d.recipes.is_empty());
        assert_eq!(d.dishes.len(), 3);
        // Two recipes of one dish by name, the first the default; one by link; one in a new dish.
        let stew = d.dishes[0]["recipes"].as_array().unwrap();
        assert_eq!(stew.len(), 2);
        assert_eq!(
            stew[0],
            serde_json::json!({"id": "r1", "minutes": 150, "steps": [], "label": {"nl": "", "en": ""}, "default": true})
        );
        assert_eq!(stew[1]["default"], false);
        assert_eq!(d.dishes[1]["recipes"][0]["id"], "r3");
        assert!(d.dishes[1].get("recipe_id").is_none());
        assert_eq!(
            d.dishes[2]["name"],
            serde_json::json!({"nl": "", "en": "Pancakes"})
        );
        assert_eq!(d.dishes[2]["recipes"][0]["id"], "r2");
        let pancakes = d.dishes[2]["id"].clone();
        assert_eq!(d.log[0]["dish_id"], pancakes);
        assert_eq!(d.log[0]["recipe_id"], "r2");
        assert!(d.log[1].get("dish_id").is_none());
        assert_eq!(d.freezer[0]["dish_id"], "d1");
        assert!(d.freezer[0].get("recipe_id").is_none());
        assert_eq!(d.resting.len(), 1);
        assert_eq!(d.resting[0]["dish_id"], "d2");
        assert!(serde_json::to_value(&d).unwrap().get("recipes").is_none());
    }

    #[test]
    fn format_2_names_become_one_list_of_ingredients() {
        let mut d: Data = serde_json::from_value(serde_json::json!({
            "format": 2,
            "dishes": [
                {"id": "d1", "name": {"nl": "Biefstuk", "en": "Steak"}, "sides": [
                    {"name": {"nl": "Frieten", "en": ""}, "choice": true},
                    {"name": {"nl": "Sla", "en": "Salad"}, "choice": false}
                ]}
            ],
            "recipes": [
                {"id": "r1", "name": "Steak", "ingredients": [
                    {"id": "i1", "name": "FRIES", "amount": 300, "unit": "g", "group": "Ingredients"},
                    {"id": "i2", "name": "salad", "amount": 1, "unit": "pc", "group": "Ingredients"},
                    {"id": "i3", "name": "butter", "amount": 20, "unit": "g", "group": "From the cupboard"}
                ]}
            ],
            "dish_categories": [{"id": "c1", "name": {"nl": "Dagelijkse kost", "en": "Everyday"}}]
        }))
        .unwrap();
        // "Frieten" has no English half: "FRIES" from the recipe becomes an ingredient of its own; "salad" is "Sla".
        to_3(&mut d);
        assert_eq!(d.format, 3);
        assert_eq!(d.ingredient_categories.len(), 1);
        let other = d.ingredient_categories[0]["id"].clone();
        let names: Vec<_> = d
            .ingredients
            .iter()
            .map(|i| {
                (
                    i["name"]["nl"].as_str().unwrap(),
                    i["name"]["en"].as_str().unwrap(),
                )
            })
            .collect();
        assert_eq!(
            names,
            [
                ("Frieten", ""),
                ("Sla", "Salad"),
                ("", "FRIES"),
                ("", "butter")
            ]
        );
        assert!(d.ingredients.iter().all(|i| i["category"] == other));
        let id = |n: usize| d.ingredients[n]["id"].clone();
        assert_eq!(
            d.dishes[0]["sides"],
            serde_json::json!([{"ingredients": [id(0)]}])
        );
        assert_eq!(d.dishes[0]["ingredients"], serde_json::json!([id(1)]));
        let lines = &d.recipes[0]["ingredients"];
        assert_eq!(
            lines[1],
            serde_json::json!({"id": "i2", "ingredient": id(1), "amount": 1, "unit": "pc", "group": "Ingredients"})
        );
        assert_eq!(lines[0]["ingredient"], id(2));
        assert!(lines[2].get("name").is_none());
        assert_eq!(d.dish_categories.len(), 1);
    }
}
