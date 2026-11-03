//! The first safety net of the move (Kenny 03/11/2026 06:12, "Geen terugval"): before the import even parses
//! `kitchen.json`, its bytes are copied to `kitchen.json.pre-db`, written atomically (temp file, fsync, rename) by the
//! kit. Only the first attempt makes the copy: a retried import (after a failure, at the next start) never overwrites
//! it, so the copy is always the file as the previous version left it.

use std::path::{Path, PathBuf};

use chassis::Error;

/// The suffix of the pre-database copy.
pub const SUFFIX: &str = "pre-db";

/// Where the copy of `file` goes: `<file>.pre-db` next to it.
pub fn copy_path(file: &Path) -> PathBuf {
    let mut name = file.as_os_str().to_owned();
    name.push(".");
    name.push(SUFFIX);
    PathBuf::from(name)
}

/// Copy `file` to [`copy_path`] unless the file is absent (a fresh kitchen) or the copy exists already. Answers
/// whether it made the copy now.
pub fn keep_first_copy(file: &Path) -> Result<bool, Error> {
    let copy = copy_path(file);
    if copy.exists() {
        return Ok(false);
    }
    let bytes = match std::fs::read(file) {
        Ok(b) => b,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(e) => {
            return Err(Error::config(
                format!(
                    "cannot read {} to copy it before the import: {e}",
                    file.display()
                ),
                "make the file readable for the service user; nothing was imported and the import is retried at the next start",
            ));
        }
    };
    chassis::shell::store::write_atomic(
        &copy,
        &bytes,
        "the copy of kitchen.json taken before the import",
    )?;
    Ok(true)
}
