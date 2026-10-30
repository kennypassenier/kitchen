//! What decides whether an upload is kept: the kinds, the refusals, the id and the sniffing (no disk).

use axum::http::StatusCode;

/// The most a photo may weigh. The browser aims far below this (1600 px).
pub const MAX_BYTES: usize = 4 * 1024 * 1024;

/// The two kinds of picture kitchen keeps.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Jpeg,
    Webp,
}

impl Kind {
    pub fn mime(self) -> &'static str {
        match self {
            Kind::Jpeg => "image/jpeg",
            Kind::Webp => "image/webp",
        }
    }

    pub fn ext(self) -> &'static str {
        match self {
            Kind::Jpeg => "jpg",
            Kind::Webp => "webp",
        }
    }

    pub const ALL: [Kind; 2] = [Kind::Jpeg, Kind::Webp];
}

/// Why an upload was refused, in words a page shows as they are.
#[derive(Debug, PartialEq)]
pub enum Refusal {
    Empty,
    TooLarge,
    WrongType,
    NotWhatItSays,
}

impl Refusal {
    pub(super) fn status(&self) -> StatusCode {
        match self {
            Refusal::Empty | Refusal::NotWhatItSays => StatusCode::BAD_REQUEST,
            Refusal::TooLarge => StatusCode::PAYLOAD_TOO_LARGE,
            Refusal::WrongType => StatusCode::UNSUPPORTED_MEDIA_TYPE,
        }
    }
}

impl std::fmt::Display for Refusal {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Refusal::Empty => write!(f, "the photo is empty"),
            Refusal::TooLarge => write!(f, "the photo is larger than 4 MiB"),
            Refusal::WrongType => write!(f, "send a JPEG or a WebP photo"),
            Refusal::NotWhatItSays => {
                write!(f, "the file is not the kind of picture it says it is")
            }
        }
    }
}

/// A photo id from an address: a plain lower-case hyphenated UUID, nothing else.
pub fn valid_id(id: &str) -> bool {
    match uuid::Uuid::parse_str(id) {
        Ok(u) => u.hyphenated().to_string() == id,
        Err(_) => false,
    }
}

/// The kind the first bytes show, if it is one kitchen keeps.
pub fn sniff(bytes: &[u8]) -> Option<Kind> {
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some(Kind::Jpeg)
    } else if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some(Kind::Webp)
    } else {
        None
    }
}

/// The declared kind of a `Content-Type` value (parameters ignored).
fn declared(content_type: &str) -> Option<Kind> {
    let essence = content_type
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    Kind::ALL.into_iter().find(|k| k.mime() == essence)
}

/// Everything that decides whether an upload is kept.
pub fn check_upload(content_type: &str, bytes: &[u8]) -> Result<Kind, Refusal> {
    let kind = declared(content_type).ok_or(Refusal::WrongType)?;
    if bytes.is_empty() {
        return Err(Refusal::Empty);
    }
    if bytes.len() > MAX_BYTES {
        return Err(Refusal::TooLarge);
    }
    if sniff(bytes) != Some(kind) {
        return Err(Refusal::NotWhatItSays);
    }
    Ok(kind)
}
