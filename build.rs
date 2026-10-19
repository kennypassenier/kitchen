//! The web app's files are the files on disk, not a hand-kept list
//! (the homelab admin dashboard's lesson, fix-179): everything under
//! web/js, web/css and web/img plus web/index.html is embedded in the binary.

use std::fmt::Write as _;
use std::path::{Path, PathBuf};

fn walk(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for e in entries.flatten() {
        let p = e.path();
        if p.is_dir() {
            walk(&p, out);
        } else {
            out.push(p);
        }
    }
}

fn main() {
    // Read when this script runs, never `env!`: a shared target directory
    // would otherwise name the checkout that compiled the script.
    let manifest = std::env::var("CARGO_MANIFEST_DIR").expect("cargo sets CARGO_MANIFEST_DIR");
    let web = Path::new(&manifest).join("web");
    let mut files = vec![web.join("index.html")];
    for root in ["js", "css", "img"] {
        walk(&web.join(root), &mut files);
        println!("cargo:rerun-if-changed=web/{root}");
    }
    println!("cargo:rerun-if-changed=web/index.html");
    files.sort();
    let mut src = String::from("pub const FILES: &[(&str, &[u8])] = &[\n");
    for f in &files {
        let rel = f
            .strip_prefix(&web)
            .expect("under web/")
            .to_string_lossy()
            .replace('\\', "/");
        // The crate directory at compile time, never this script's path.
        writeln!(
            src,
            "    ({rel:?}, include_bytes!(concat!(env!(\"CARGO_MANIFEST_DIR\"), \"/web/{rel}\"))),"
        )
        .expect("write to a String");
    }
    src.push_str("];\n");
    let out = PathBuf::from(std::env::var("OUT_DIR").expect("cargo sets OUT_DIR"));
    std::fs::write(out.join("web_files.rs"), src).expect("write web_files.rs");
}
