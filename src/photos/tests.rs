use super::*;

const JPEG: &[u8] = &[0xFF, 0xD8, 0xFF, 0xE0, 0, 16];
const WEBP: &[u8] = b"RIFF\x24\0\0\0WEBPVP8 ";

#[test]
fn ids_must_be_plain_uuids() {
    assert!(valid_id("0b9e6c1e-2f4a-4c1d-9a37-5d1f0a6f9b21"));
    for bad in [
        "",
        "..",
        "../kitchen",
        "0b9e6c1e-2f4a-4c1d-9a37-5d1f0a6f9b21.jpg",
        "0b9e6c1e2f4a4c1d9a375d1f0a6f9b21",
        "{0b9e6c1e-2f4a-4c1d-9a37-5d1f0a6f9b21}",
        "0B9E6C1E-2F4A-4C1D-9A37-5D1F0A6F9B21",
        "urn:uuid:0b9e6c1e-2f4a-4c1d-9a37-5d1f0a6f9b21",
        "0b9e6c1e-2f4a-4c1d-9a37-5d1f0a6f9b2/",
    ] {
        assert!(!valid_id(bad), "{bad:?} must be refused");
    }
}

#[test]
fn only_jpeg_and_webp_that_really_are() {
    assert_eq!(check_upload("image/jpeg", JPEG), Ok(Kind::Jpeg));
    assert_eq!(check_upload("image/webp", WEBP), Ok(Kind::Webp));
    assert_eq!(check_upload("IMAGE/WEBP; q=1", WEBP), Ok(Kind::Webp));
    assert_eq!(check_upload("image/png", JPEG), Err(Refusal::WrongType));
    assert_eq!(check_upload("", JPEG), Err(Refusal::WrongType));
    assert_eq!(
        check_upload("image/jpeg", WEBP),
        Err(Refusal::NotWhatItSays)
    );
    assert_eq!(
        check_upload("image/webp", b"<svg onload=x>"),
        Err(Refusal::NotWhatItSays)
    );
    assert_eq!(check_upload("image/jpeg", b""), Err(Refusal::Empty));
}

#[test]
fn the_size_cap_is_four_mib() {
    let mut ok = JPEG.to_vec();
    ok.resize(MAX_BYTES, 0);
    assert_eq!(check_upload("image/jpeg", &ok), Ok(Kind::Jpeg));
    ok.push(0);
    assert_eq!(check_upload("image/jpeg", &ok), Err(Refusal::TooLarge));
}

#[test]
fn a_delete_that_fails_is_an_error_not_a_missing_photo() {
    use std::os::unix::fs::PermissionsExt;
    let dir = tempfile::tempdir().unwrap();
    let id = "0b9e6c1e-2f4a-4c1d-9a37-5d1f0a6f9b21";
    assert_eq!(remove_files(dir.path(), id).unwrap(), 0);
    std::fs::write(dir.path().join(format!("{id}.jpg")), JPEG).unwrap();
    // A directory the server may not change: the file cannot go, and that must not read as "not there".
    std::fs::set_permissions(dir.path(), std::fs::Permissions::from_mode(0o555)).unwrap();
    let locked = remove_files(dir.path(), id);
    std::fs::set_permissions(dir.path(), std::fs::Permissions::from_mode(0o755)).unwrap();
    assert!(locked.is_err(), "{locked:?}");
    assert_eq!(remove_files(dir.path(), id).unwrap(), 1);
}
