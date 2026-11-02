//! Drafts that nobody reopened: the week they are kept and the stamp they are compared by; their photos go through
//! photo_gc.rs.

use serde_json::Value;

use super::Store;

/// A draft nobody reopened for this many days is dropped, with the photos only it refers to (Kenny, 29/10/2026; Claude's
/// number, reversible).
pub const DRAFT_DAYS: u64 = 7;

/// `epoch` seconds as the kit writes its stamps (`2026-10-29T14:39:17Z`, UTC), which sort as text.
pub fn rfc3339_at(epoch: u64) -> String {
    let days = (epoch / 86_400) as i64;
    let secs = epoch % 86_400;
    // Days since 1970-01-01 to a civil date (Hinnant's algorithm).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z",
        secs / 3600,
        secs % 3600 / 60,
        secs % 60
    )
}

impl Store {
    /// Drop the drafts last saved more than [`DRAFT_DAYS`] before `now` (epoch seconds), and their photos. Runs when the
    /// kitchen starts; answers how many drafts went, or why the pruned list could not be saved (then every draft stays).
    pub async fn prune_drafts(&self, now: u64) -> Result<usize, String> {
        let cutoff = rfc3339_at(now.saturating_sub(DRAFT_DAYS * 86_400));
        // A draft with no readable `saved` stamp is kept: nothing says it is old.
        let gone = self
            .change(|d| {
                let (old, keep): (Vec<Value>, Vec<Value>) =
                    std::mem::take(&mut d.drafts).into_iter().partition(|v| {
                        v.get("saved")
                            .and_then(Value::as_str)
                            .is_some_and(|s| s < cutoff.as_str())
                    });
                d.drafts = keep;
                Ok(old)
            })
            .await
            .map_err(|e| e.to_string())?;
        self.release_photos(&gone).await;
        Ok(gone.len())
    }
}
