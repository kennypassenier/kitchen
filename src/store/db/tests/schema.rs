//! `schema_v1/*.sql` and `tables.rs` describe the same tables column for column, so the codec never writes a column the
//! schema lacks and the schema holds no column the codec ignores.

use std::collections::BTreeSet;

use super::super::spec::{EXTRA, Nest, PARENT, POS, ROW, VALUE};
use super::super::tables::all_tables;
use super::empty_db;

fn columns(db: &chassis::storage::AppDb, table: &str) -> BTreeSet<String> {
    let sql = format!("SELECT name FROM pragma_table_info('{table}')");
    db.read_blocking(move |c| {
        let mut stmt = c.prepare(&sql)?;
        let names = stmt.query_map([], |r| r.get::<_, String>(0))?;
        Ok(names.collect::<Result<BTreeSet<_>, _>>()?)
    })
    .unwrap()
}

#[test]
fn every_table_of_the_spec_has_exactly_its_columns() {
    let db = empty_db();
    for t in all_tables() {
        let mut want: BTreeSet<String> = t.data_columns().into_iter().collect();
        want.extend([ROW, POS, EXTRA].map(String::from));
        let got = columns(&db, t.name);
        let child = got.contains(PARENT);
        if child {
            want.insert(PARENT.into());
        }
        assert_eq!(got, want, "table {}", t.name);
        for c in t.children {
            if let Nest::Strings(name) = c.nest {
                let want: BTreeSet<String> = [ROW, PARENT, POS, VALUE].map(String::from).into();
                assert_eq!(columns(&db, name), want, "table {name}");
            }
        }
    }
}

#[test]
fn every_list_has_a_table_and_the_side_tables_exist() {
    let db = empty_db();
    for list in crate::store::data::COLLECTIONS {
        assert!(super::super::tables::list_table(list).is_some(), "{list}");
        assert!(!columns(&db, list).is_empty(), "{list}");
    }
    for side in ["settings_rev", "answered"] {
        assert!(!columns(&db, side).is_empty(), "{side}");
    }
}
