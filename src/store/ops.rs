//! Changing a collection: add, replace and remove an item, and take portions out of the freezer.

use serde_json::Value;

use super::validate::both_names;
use super::{Refused, Store};

impl Store {
    /// Add an item; the server issues its `id` and `created`.
    pub async fn create(&self, coll: &str, body: Value) -> Result<Value, Refused> {
        let Value::Object(mut obj) = body else {
            return Err(Refused::NotAnObject);
        };
        both_names(coll, &obj)?;
        if coll == "drafts" {
            return self.save_draft(obj).await;
        }
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

    /// One draft per `key`: saving again replaces the one there (its id and creation kept).
    async fn save_draft(&self, mut obj: serde_json::Map<String, Value>) -> Result<Value, Refused> {
        let key = obj
            .get("key")
            .and_then(Value::as_str)
            .filter(|k| !k.trim().is_empty())
            .ok_or(Refused::NoKey)?
            .to_string();
        obj.insert(
            "saved".into(),
            Value::String(chassis::shell::time::now_rfc3339()),
        );
        self.change(|d| {
            let at = d
                .drafts
                .iter()
                .position(|v| v.get("key").and_then(Value::as_str) == Some(key.as_str()));
            let (id, created) = match at.map(|i| &d.drafts[i]) {
                Some(old) => (old.get("id").cloned(), old.get("created").cloned()),
                None => (None, None),
            };
            obj.insert(
                "id".into(),
                id.unwrap_or_else(|| Value::String(uuid::Uuid::new_v4().to_string())),
            );
            obj.insert(
                "created".into(),
                created.unwrap_or_else(|| Value::String(chassis::shell::time::now_rfc3339())),
            );
            let item = Value::Object(obj);
            match at {
                Some(i) => d.drafts[i] = item.clone(),
                None => d.drafts.push(item.clone()),
            }
            Ok(item)
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
        let gone = self
            .change(|d| {
                let c = d
                    .collection(coll)
                    .ok_or_else(|| Refused::UnknownCollection(coll.into()))?;
                let at = c
                    .iter()
                    .position(|v| v.get("id").and_then(Value::as_str) == Some(id))
                    .ok_or(Refused::NotFound)?;
                Ok(c.remove(at))
            })
            .await?;
        // A discarded draft takes the photos only it referred to along (Kenny, 29/10/2026).
        if coll == "drafts" {
            self.release_photos(std::slice::from_ref(&gone)).await;
        }
        Ok(gone)
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
}
