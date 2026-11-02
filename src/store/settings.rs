//! The settings: one object of keys, merged by `PATCH /data/settings`, with a revision of their own.
//!
//! fix-offline-master-5 (Kenny 02/11/2026 19:43, "de server is altijd de master"): a settings change queued offline
//! used to be replayed without any check, so it silently overwrote a newer change made elsewhere. The settings now carry
//! `settings_rev` (absent in an older file: 0), raised on every merge, and a merge may name the revision it read
//! (`If-Match`, the kit's `IfMatch`); a different stored revision refuses it with the kit's stale refusal, nothing
//! changed. Without a precondition a merge behaves as before.

use chassis::core::revision::{self, Precondition};
use serde_json::{Map, Value};

use super::{Refused, Store};

impl Store {
    /// The settings and their revision.
    pub async fn settings(&self) -> (Map<String, Value>, u64) {
        let d = self.data.read().await;
        (d.settings.clone(), d.settings_rev)
    }

    /// Merge the given keys into the settings without a revision check (see [`Store::merge_settings_if`]).
    #[cfg(test)]
    pub async fn merge_settings(&self, body: Value) -> Result<(Map<String, Value>, u64), Refused> {
        self.merge_settings_if(body, None).await
    }

    /// Merge the given keys into the settings; a `null` removes a key, and the revision goes one up. `if_match` is the
    /// revision the page read (or `*`): when given and the stored one differs, the settings changed elsewhere since and
    /// the merge is refused ([`Refused::Stale`]) instead of silently winning. Answers the settings and their new revision.
    pub async fn merge_settings_if(
        &self,
        body: Value,
        if_match: Option<Precondition>,
    ) -> Result<(Map<String, Value>, u64), Refused> {
        let Value::Object(patch) = body else {
            return Err(Refused::NotAnObject);
        };
        self.change(|d| {
            revision::check(if_match, d.settings_rev).map_err(Refused::Stale)?;
            for (k, v) in &patch {
                if v.is_null() {
                    d.settings.remove(k);
                } else {
                    d.settings.insert(k.clone(), v.clone());
                }
            }
            d.settings_rev += 1;
            Ok((d.settings.clone(), d.settings_rev))
        })
        .await
    }
}
