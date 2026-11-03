//! A freezer take applied once per `Idempotency-Key` (feat-offline-take-1, Kenny 02/11/2026 19:13 "Kit krijgt
//! post()"). The page's offline client queues "take 1" without a connection and replays it with the same UUID key
//! (chassis-rs `chassisData.post`, `IdempotencyKey`); a replay whose first try reached the kitchen but whose answer was
//! lost must not take a second portion.
//!
//! The key is recorded in the same database transaction as the take ([`Store::change`]: one lock, one transaction;
//! the `answered` table of `kitchen.db` since feat-db-store-1), as the kit's pattern asks, so the answer and the data
//! can never disagree. A repeated key answers the item as the
//! first take left it, without touching the freezer again. A refused take (no portions left, an unknown item) records
//! nothing: it changed nothing, so a retry is judged afresh. Only the last [`ANSWERS_KEEP`] keys are kept, so the table
//! cannot grow without bound (the kit replays within minutes or days, never hundreds of takes later).

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::{Data, Refused, Store};

/// How many answered keys the kitchen keeps, oldest dropped first.
pub const ANSWERS_KEEP: usize = 200;

/// One answered `Idempotency-Key` and the answer its first request got.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Answered {
    pub key: String,
    pub answer: Value,
}

impl Store {
    /// Take `n` portions out of freezer item `id`, once per `key`: a key already answered gets that first answer and
    /// the freezer is not touched. Without a key every call takes (the page's own Undo, an older client).
    pub async fn take_portions_once(
        &self,
        id: &str,
        n: i64,
        key: Option<&str>,
    ) -> Result<Value, Refused> {
        self.change(|d| {
            if let Some(first) = key.and_then(|k| answered(d, k)) {
                return Ok(first);
            }
            let item = take_in(d, id, n)?;
            if let Some(k) = key {
                record(d, k, &item);
            }
            Ok(item)
        })
        .await
    }
}

/// The first answer to `key`, if it was answered.
fn answered(d: &Data, key: &str) -> Option<Value> {
    d.answered
        .iter()
        .find(|a| a.key == key)
        .map(|a| a.answer.clone())
}

/// Remember `key`'s answer, dropping the oldest keys beyond [`ANSWERS_KEEP`].
fn record(d: &mut Data, key: &str, answer: &Value) {
    d.answered.push(Answered {
        key: key.to_owned(),
        answer: answer.clone(),
    });
    let over = d.answered.len().saturating_sub(ANSWERS_KEEP);
    d.answered.drain(..over);
}

/// The take itself: `n` portions off item `id` (negative puts back); never below zero.
fn take_in(d: &mut Data, id: &str, n: i64) -> Result<Value, Refused> {
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
}
