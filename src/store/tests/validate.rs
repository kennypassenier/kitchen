use super::*;

#[tokio::test]
async fn a_recipe_source_is_an_http_address_or_nothing() {
    let s = Store::in_memory(empty());
    let dish = |src: serde_json::Value| serde_json::json!({"name": {"nl": "a", "en": "a"}, "recipes": [{"source": src}]});
    for ok in [
        serde_json::json!("https://example.com/r?a=1"),
        serde_json::json!(""),
        serde_json::Value::Null,
    ] {
        assert!(s.create("dishes", dish(ok)).await.is_ok());
    }
    for bad in [
        "javascript:alert(1)",
        "ftp://example.com/",
        "not a url",
        "https://",
    ] {
        assert_eq!(
            s.create("dishes", dish(serde_json::json!(bad))).await,
            Err(Refused::BadSource("recipes[0].source".into())),
            "{bad}"
        );
    }
    assert!(
        s.create("dishes", dish(serde_json::json!(5)))
            .await
            .is_err()
    );
}

#[tokio::test]
async fn a_name_needs_both_halves() {
    let s = Store::in_memory(empty());
    let half = serde_json::json!({"name": {"nl": "Frieten", "en": ""}});
    assert_eq!(
        s.create("ingredients", half).await,
        Err(Refused::MissingName("name.en".into()))
    );
    let ok = s
        .create(
            "ingredients",
            serde_json::json!({"name": {"nl": "Frieten", "en": "Fries"}}),
        )
        .await
        .unwrap();
    let id = ok["id"].as_str().unwrap();
    let blank = serde_json::json!({"name": {"nl": " ", "en": "Fries"}});
    assert_eq!(
        s.replace("ingredients", id, blank).await,
        Err(Refused::MissingName("name.nl".into()))
    );
    let side = serde_json::json!({"name": {"nl": "Stoofvlees", "en": "Beef stew"}, "sides": [{"ingredients": [], "label": {"nl": "Kroketten", "en": ""}}]});
    assert_eq!(
        s.create("dishes", side).await,
        Err(Refused::MissingName("sides[0].label.en".into()))
    );
    let no_label = serde_json::json!({"name": {"nl": "Stoofvlees", "en": "Beef stew"}, "sides": [{"ingredients": []}], "recipes": [{"label": {"nl": "", "en": ""}}]});
    assert!(s.create("dishes", no_label).await.is_ok());
    let untitled = serde_json::json!({"title": "Toast"});
    assert_eq!(
        s.create("shelf", untitled).await,
        Err(Refused::MissingName("title.nl".into()))
    );
    let half_text = serde_json::json!({"title": {"nl": "Toast", "en": "Toast"}, "text": {"nl": "Rooster", "en": ""}});
    assert_eq!(
        s.create("shelf", half_text).await,
        Err(Refused::MissingName("text.en".into()))
    );
    assert!(
        s.create(
            "shelf",
            serde_json::json!({"title": {"nl": "Toast", "en": "Toast"}})
        )
        .await
        .is_ok()
    );
    let soup = serde_json::json!({"dish": {"nl": "Soep", "en": ""}});
    assert_eq!(
        s.create("freezer", soup).await,
        Err(Refused::MissingName("dish.en".into()))
    );
}

#[tokio::test]
async fn a_recipe_source_needs_name_address_language_and_a_whole_note() {
    let s = Store::in_memory(empty());
    let ok =
        serde_json::json!({"name": "Site", "url": "https://example.com/recipes", "language": "nl"});
    assert!(s.create("recipe_sources", ok.clone()).await.is_ok());
    let with = |k: &str, v: serde_json::Value| {
        let mut o = ok.clone();
        o[k] = v;
        o
    };
    for bad in [
        with("name", "".into()),
        with("url", "".into()),
        with("url", "ftp://example.com".into()),
        with("language", "fr".into()),
    ] {
        assert!(s.create("recipe_sources", bad).await.is_err());
    }
    assert_eq!(
        s.create(
            "recipe_sources",
            with("note", serde_json::json!({"nl": "x", "en": ""}))
        )
        .await,
        Err(Refused::MissingName("note.en".into()))
    );
    assert!(
        s.create(
            "recipe_sources",
            with("note", serde_json::json!({"nl": "x", "en": "y"}))
        )
        .await
        .is_ok()
    );
}
