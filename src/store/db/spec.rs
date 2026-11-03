//! The vocabulary the kitchen's tables are described in (feat-db-schema-1, Kenny 03/11/2026 06:12 "Echte kolommen").
//!
//! Every list is a table with a real column per known field, and every nested list (a dish's recipes, a recipe's
//! steps, a step's photos) is a child table of its item. The description is data, not code: [`super::tables`] lists
//! each table once, and the generic codec (`codec/`) writes and reads any of them, so the mapping between a JSON
//! item and its rows lives in one place. `schema_v1.sql` holds the same tables as SQL; the schema test pins the two
//! together column for column.
//!
//! Losslessness is the rule, because the shape of an item belongs to the pages (`docs/agent/DATA.md`): a value that
//! does not fit its column's kind (a float where a whole number is usual, a `null`, an object where text is usual)
//! and a key no column knows go to the row's `k_extra` JSON object instead, so an item always reads back exactly as it
//! was written. The import proves that value for value before the kit renames `kitchen.json`.

/// The row id of every table (SQLite's rowid).
pub const ROW: &str = "k_row";
/// The owning row of a child table's row.
pub const PARENT: &str = "k_parent";
/// The row's place in its list, 0-based; the order `GET /data/{list}` answers in.
pub const POS: &str = "k_pos";
/// A JSON object of the keys no column holds, NULL when there are none.
pub const EXTRA: &str = "k_extra";
/// The single column of a [`Nest::Strings`] child table.
pub const VALUE: &str = "value";

/// How one JSON field is held in columns.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    /// A string, in one TEXT column named after the key.
    Text,
    /// A whole number that fits an i64 (a revision), in one INTEGER column.
    Int,
    /// Any JSON number, in one ANY column: SQLite keeps an integer an integer and a float a float, so `2` and `2.0`
    /// read back as they were written.
    Num,
    /// `true` / `false`, in one INTEGER column (1 / 0).
    Bool,
    /// A name or text in both languages, `{nl, en}` with exactly those two string keys, in `<key>_nl` and `<key>_en`.
    Pair,
    /// A plain string or a `{nl, en}` pair (a step's `text`, a line's `note`): `<key>`, `<key>_nl`, `<key>_en`, of which
    /// either the first or the last two are set.
    TextOrPair,
    /// An opaque JSON document in one TEXT column: a draft's editor state, which the editor alone owns.
    Json,
}

impl Kind {
    /// The SQL columns this kind takes for `key`, in the order the codec reads and writes them.
    pub fn columns(self, key: &str) -> Vec<String> {
        match self {
            Kind::Text | Kind::Int | Kind::Num | Kind::Bool | Kind::Json => vec![key.to_string()],
            Kind::Pair => vec![format!("{key}_nl"), format!("{key}_en")],
            Kind::TextOrPair => vec![key.to_string(), format!("{key}_nl"), format!("{key}_en")],
        }
    }
}

/// One JSON field held in columns.
#[derive(Debug)]
pub struct Field {
    pub key: &'static str,
    pub kind: Kind,
}

/// Shorthand for the table lists: `field("name", Kind::Pair)`.
pub const fn field(key: &'static str, kind: Kind) -> Field {
    Field { key, kind }
}

/// How a nested value is held in a child table.
#[derive(Debug)]
pub enum Nest {
    /// A list of objects: one row per element in the given table.
    Rows(&'static Table),
    /// A list of strings: one row per element in the named table, in its `value` column.
    Strings(&'static str),
    /// One object (a step's `timer`): one row in the given table.
    One(&'static Table),
}

/// One nested key of a table, held in a child table; the parent row keeps `n_<key>` (the element count, NULL when
/// the key is absent), so an empty list and an absent key stay apart.
#[derive(Debug)]
pub struct Child {
    pub key: &'static str,
    pub nest: Nest,
}

/// Shorthand for the table lists: `child("steps", Nest::Rows(&STEPS))`.
pub const fn child(key: &'static str, nest: Nest) -> Child {
    Child { key, nest }
}

impl Child {
    /// The parent's column that counts this child's elements.
    pub fn count_column(&self) -> String {
        format!("n_{}", self.key)
    }
}

/// A table: its SQL name, the fields with columns of their own and the nested keys with child tables.
#[derive(Debug)]
pub struct Table {
    pub name: &'static str,
    pub fields: &'static [Field],
    pub children: &'static [Child],
}

impl Table {
    /// Every data column of the table in codec order: each field's columns, then each child's count.
    pub fn data_columns(&self) -> Vec<String> {
        let fields = self.fields.iter().flat_map(|f| f.kind.columns(f.key));
        let counts = self.children.iter().map(Child::count_column);
        fields.chain(counts).collect()
    }
}

/// An identifier quoted for SQL. Every name passed here comes from the compile-time table lists, never from a request,
/// so quoting only guards against keys that are SQL words (`default`, `order`, `group`, `with`).
pub fn quoted(name: &str) -> String {
    format!("\"{name}\"")
}
