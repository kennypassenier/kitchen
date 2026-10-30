//! Lifting an older kitchen file to the current format, one format at a time (data-critical: moved verbatim).

mod to_2;
mod to_3;
mod to_4;

use serde_json::Value;

pub(super) use self::{to_2::to_2, to_3::to_3, to_4::to_4};
use super::{Data, FORMAT};

/// Format 4 to 5 (Kenny, 24/10/2026 10:04): a shelf food's `title`,
/// `text` and `gear` and a freezer item's `dish` become `{nl, en}`, the
/// text they had in both halves, so nothing is lost; Kenny translates them
/// from the pages.
pub(super) fn to_5(data: &mut Data) {
    let both = |v: &mut Value| {
        if let Some(text) = v.as_str().map(str::to_string) {
            *v = serde_json::json!({ "nl": text, "en": text });
        }
    };
    for s in &mut data.shelf {
        for k in ["title", "text", "gear"] {
            if let Some(v) = s.get_mut(k) {
                both(v);
            }
        }
    }
    for f in &mut data.freezer {
        if let Some(v) = f.get_mut("dish") {
            both(v);
        }
    }
    data.format = 5;
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
    if data.format < 5 {
        to_5(data);
    }
    data.format = FORMAT;
}
