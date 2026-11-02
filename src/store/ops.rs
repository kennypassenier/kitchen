//! Changing a collection: add, replace and remove an item (both checked against `If-Match`), and take portions out of
//! the freezer.

use chassis::core::revision::{self, Precondition};
use serde_json::Value;

use super::caps::within_limits;
use super::photo_gc::{dropped_photos, photo_ids_of};
use super::validate::both_names;
use super::{Refused, Store};

impl Store {
    /// Add an item; the server issues its `id` and `created`.
    pub async fn create(&self, coll: &str, body: Value) -> Result<Value, Refused> {
        let Value::Object(mut obj) = body else {
            return Err(Refused::NotAnObject);
        };
        both_names(coll, &obj)?;
        within_limits(&obj)?;
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

    /// Replace an item whole; `id` and `created` are kept. No revision check (see [`Store::replace_if`]).
    #[cfg(test)]
    pub async fn replace(&self, coll: &str, id: &str, body: Value) -> Result<Value, Refused> {
        self.replace_if(coll, id, body, None).await
    }

    /// Replace an item whole; `id` and `created` are kept and `rev` goes one up (absent counts as 0; fix-stale-save-1).
    /// `if_match` is the precondition the page sent (the kit's `IfMatch`, refactor-rev-kit-1: the `rev` it loaded, or
    /// `*`): when given and the stored revision differs, someone saved in between and the change is refused
    /// ([`Refused::Stale`]) instead of silently winning. The comparison is the kit's (`chassis::core::revision::check`). Photos the item no longer refers to are noted
    /// for the sweep once their undo window closed (photo_gc.rs, fix-undo-photos-1).
    pub async fn replace_if(
        &self,
        coll: &str,
        id: &str,
        body: Value,
        if_match: Option<Precondition>,
    ) -> Result<Value, Refused> {
        let Value::Object(mut obj) = body else {
            return Err(Refused::NotAnObject);
        };
        both_names(coll, &obj)?;
        within_limits(&obj)?;
        if let Some(given) = obj.get("id")
            && given.as_str() != Some(id)
        {
            return Err(Refused::IdMismatch);
        }
        let (item, dropped) = self
            .change(|d| {
                let c = d
                    .collection(coll)
                    .ok_or_else(|| Refused::UnknownCollection(coll.into()))?;
                let slot = c
                    .iter_mut()
                    .find(|v| v.get("id").and_then(Value::as_str) == Some(id))
                    .ok_or(Refused::NotFound)?;
                let have = rev_of(slot);
                revision::check(if_match, have).map_err(Refused::Stale)?;
                obj.insert("id".into(), Value::String(id.into()));
                if let Some(created) = slot.get("created") {
                    obj.insert("created".into(), created.clone());
                }
                obj.insert(
                    "updated".into(),
                    Value::String(chassis::shell::time::now_rfc3339()),
                );
                obj.insert("rev".into(), Value::from(have + 1));
                let new = Value::Object(obj);
                let dropped = dropped_photos(slot, &new);
                *slot = new;
                Ok((slot.clone(), dropped))
            })
            .await?;
        self.dropped.note(dropped, std::time::Instant::now());
        Ok(item)
    }

    /// Remove an item without a revision check (see [`Store::delete_if`]).
    #[cfg(test)]
    pub async fn delete(&self, coll: &str, id: &str) -> Result<Value, Refused> {
        self.delete_if(coll, id, None).await
    }

    /// Remove an item; it stays restorable for a while (`undo::UNDO_KEEP`). `if_match` is the revision the page read
    /// (fix-offline-master-5, Kenny 02/11/2026 19:43 "de server is altijd de master"): when given and the stored one
    /// differs, someone saved the item since, and the delete is refused ([`Refused::Stale`]) instead of silently
    /// removing that newer version; nothing changes. Without it a delete behaves as before.
    pub async fn delete_if(
        &self,
        coll: &str,
        id: &str,
        if_match: Option<Precondition>,
    ) -> Result<Value, Refused> {
        let gone = self
            .change(|d| {
                let c = d
                    .collection(coll)
                    .ok_or_else(|| Refused::UnknownCollection(coll.into()))?;
                let at = c
                    .iter()
                    .position(|v| v.get("id").and_then(Value::as_str) == Some(id))
                    .ok_or(Refused::NotFound)?;
                revision::check(if_match, rev_of(&c[at])).map_err(Refused::Stale)?;
                Ok((at, c.remove(at)))
            })
            .await?;
        let (at, gone) = gone;
        // A discarded draft takes the photos only it referred to along (Kenny, 29/10/2026); anything else can be put
        // back for a while (undo.rs).
        // A deleted dish's photos are noted too: they go once its window closed and nothing refers to them
        // (fix-undo-photos-1).
        if coll == "drafts" {
            self.release_photos(std::slice::from_ref(&gone)).await;
        } else {
            let now = std::time::Instant::now();
            self.dropped.note(photo_ids_of(&gone), now);
            self.removed.keep(coll, at, gone.clone(), now);
        }
        Ok(gone)
    }

    /// Take `n` portions out of a freezer item (negative puts them back,
    /// which is how Undo works). An item at zero stays, so Undo can find it.
    /// The once-per-key form the route uses is [`Store::take_portions_once`]; this keyless form is for the tests.
    #[cfg(test)]
    pub async fn take_portions(&self, id: &str, n: i64) -> Result<Value, Refused> {
        self.take_portions_once(id, n, None).await
    }
}

/// An item's revision: how many times it was replaced; absent (an item stored before fix-stale-save-1) counts as 0.
pub(crate) fn rev_of(item: &Value) -> u64 {
    item.get("rev").and_then(Value::as_u64).unwrap_or(0)
}
