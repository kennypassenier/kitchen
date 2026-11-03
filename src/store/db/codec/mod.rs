//! The generic codec between a JSON object and the rows of a table described in `spec.rs`: `write` splits an object
//! over columns, child tables and `k_extra`; `read` puts it back together; `cell` does one field.

mod cell;
mod read;
mod write;

pub use read::{Rows, load};
pub use write::{insert, to_i64};
