//! The failure codes of an import and how each answers.

use axum::Json;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::json;

/// Why an import failed. The code is what the page maps to words.
#[derive(Debug, PartialEq)]
pub enum Fail {
    BadUrl,
    Blocked,
    Unreachable,
    TooManyRedirects,
    NotHtml,
    NotImage,
    TooLarge,
    Timeout,
    Status(u16),
    NoRecipe,
    Empty,
}

impl Fail {
    pub fn code(&self) -> &'static str {
        match self {
            Fail::BadUrl => "bad_url",
            Fail::Blocked => "blocked_address",
            Fail::Unreachable => "unreachable",
            Fail::TooManyRedirects => "too_many_redirects",
            Fail::NotHtml => "not_html",
            Fail::NotImage => "not_image",
            Fail::TooLarge => "too_large",
            Fail::Timeout => "timeout",
            Fail::Status(_) => "http_status",
            Fail::NoRecipe => "no_recipe",
            Fail::Empty => "empty",
        }
    }

    pub(super) fn status(&self) -> StatusCode {
        match self {
            Fail::BadUrl | Fail::Blocked | Fail::Empty => StatusCode::BAD_REQUEST,
            Fail::NoRecipe | Fail::NotHtml | Fail::NotImage => StatusCode::UNPROCESSABLE_ENTITY,
            Fail::TooLarge => StatusCode::PAYLOAD_TOO_LARGE,
            Fail::Timeout => StatusCode::GATEWAY_TIMEOUT,
            Fail::Unreachable | Fail::TooManyRedirects | Fail::Status(_) => StatusCode::BAD_GATEWAY,
        }
    }
}

impl IntoResponse for Fail {
    fn into_response(self) -> Response {
        let mut body = json!({ "error": self.code() });
        if let Fail::Status(s) = self {
            body["status"] = json!(s);
        }
        (self.status(), Json(body)).into_response()
    }
}
