use super::fields::*;
use super::ld_json::*;
use super::pasted::*;
use super::text::*;
use reqwest::Url;

const GRAPH: &str = r#"<html><head><title>x</title>
<script type="text/javascript">var a = 1;</script>
<SCRIPT TYPE="application/ld+json">
{"@context":"https://schema.org","@graph":[
 {"@type":"WebSite","name":"Site"},
 {"@type":["Recipe","NewsArticle"],"name":"Pancakes &amp; syrup",
  "recipeYield":["4","4 servings"],
  "prepTime":"PT10M","cookTime":"PT1H15M","totalTime":"PT1H25M",
  "image":{"@type":"ImageObject","url":"/img/pancakes.jpg"},
  "recipeIngredient":["200 g flour","2 eggs","<b>1 tbsp</b> sugar"],
  "recipeInstructions":[
{"@type":"HowToSection","name":"Batter","itemListElement":[
  {"@type":"HowToStep","text":"Mix the flour and eggs."},
  {"@type":"HowToStep","text":"Rest 10 minutes."}]},
{"@type":"HowToStep","text":"Fry in a pan."}]}
]}
</script></head><body></body></html>"#;

fn page() -> Url {
    Url::parse("https://example.com/recipes/pancakes").unwrap()
}

#[test]
fn a_recipe_in_a_graph_with_sections_and_a_relative_image() {
    let r = from_page(GRAPH, Some(&page())).unwrap();
    assert_eq!(r.name, "Pancakes & syrup");
    assert_eq!(r.portions, Some(4));
    assert_eq!(r.ingredients, ["200 g flour", "2 eggs", "1 tbsp sugar"]);
    assert_eq!(
        r.steps,
        [
            "Mix the flour and eggs.",
            "Rest 10 minutes.",
            "Fry in a pan."
        ]
    );
    assert_eq!((r.prep, r.cook, r.total), (Some(10), Some(75), Some(85)));
    assert_eq!(
        r.image_url.as_deref(),
        Some("https://example.com/img/pancakes.jpg")
    );
    assert_eq!(
        r.source_url.as_deref(),
        Some("https://example.com/recipes/pancakes")
    );
}

/// A real Dagelijkse Kost page (fetched 29/10/2026, cut down to its recipe block and instruction list): the
/// JSON-LD names two steps, the page shows all of them.
#[test]
fn dagelijkse_kost_steps_come_from_the_page_when_the_block_has_only_two() {
    let html = include_str!("../../tests/fixtures/dagelijkse-kost-daube.html");
    let url = Url::parse(
        "https://dagelijksekost.vrt.be/gerechten/daube-varkenswangen-geglaceerde-wortel",
    )
    .unwrap();
    let r = from_page(html, Some(&url)).unwrap();
    assert_eq!(r.portions, Some(4));
    assert_eq!(r.ingredients.len(), 30);
    assert_eq!(r.steps.len(), 20);
    assert_eq!(r.steps[0], "Kruid de varkenswangen met peper en zout.");
    assert!(r.steps[2].starts_with("Doe de wangen in een kom"));
}

/// The sites on the "Recipe sources" list (Kenny, 29/10/2026 15:11): the recipe block of one real page each, fetched
/// through the import on that day and cut down to the block. A site is on the list only while its fixture reads.
#[test]
fn the_verified_recipe_sources_read_whole() {
    // (page, name, portions, ingredients, steps, prep, cook)
    let cases = [
        (
            include_str!("../../tests/fixtures/bbc-good-food-pancakes.html"),
            "Easy pancakes",
            12,
            6,
            5,
            Some(10),
            Some(20),
        ),
        (
            include_str!("../../tests/fixtures/simply-recipes-guacamole.html"),
            "How to Make the Best Guacamole",
            4,
            10,
            5,
            Some(10),
            None,
        ),
        (
            include_str!("../../tests/fixtures/recipetin-eats-fried-rice.html"),
            "Chicken Fried Rice",
            4,
            16,
            9,
            Some(10),
            Some(10),
        ),
        (
            include_str!("../../tests/fixtures/24kitchen-carbonara.html"),
            "Originele spaghetti carbonara",
            4,
            6,
            7,
            Some(15),
            None,
        ),
        (
            include_str!("../../tests/fixtures/leukerecepten-carbonara.html"),
            "Pasta carbonara: romige klassieker",
            4,
            6,
            8,
            Some(10),
            Some(15),
        ),
    ];
    for (html, name, portions, ingredients, steps, prep, cook) in cases {
        let r = from_page(html, None).unwrap_or_else(|| panic!("{name} did not read"));
        assert_eq!(r.name, name);
        assert_eq!(r.portions, Some(portions), "{name} portions");
        assert_eq!(r.ingredients.len(), ingredients, "{name} ingredients");
        assert_eq!(r.steps.len(), steps, "{name} steps");
        assert_eq!(r.prep, prep, "{name} prep");
        assert_eq!(r.cook, cook, "{name} cook");
        assert!(r.image_url.is_some(), "{name} photo");
    }
}

#[test]
fn a_page_without_a_recipe_block_is_none() {
    assert!(
        from_page(
            "<html><script type=\"application/ld+json\">{\"@type\":\"Article\"}</script></html>",
            None
        )
        .is_none()
    );
    assert!(from_page("<html>no scripts</html>", None).is_none());
    assert!(from_page("<script type=\"application/ld+json\">{broken", None).is_none());
}

#[test]
fn a_recipe_on_the_top_level_with_a_string_method() {
    let html = r#"<script type="application/ld+json">{"@type":"Recipe","name":"Soup",
      "recipeYield":6,"recipeIngredient":["1 onion"],
      "recipeInstructions":"1. Chop the onion.\n2. Boil it.<br>Serve."}</script>"#;
    let r = from_page(html, None).unwrap();
    assert_eq!(r.portions, Some(6));
    assert_eq!(r.steps, ["Chop the onion.", "Boil it.", "Serve."]);
    assert_eq!(r.image_url, None);
}

#[test]
fn the_second_block_is_read_when_the_first_has_no_recipe() {
    let html = r#"<script type="application/ld+json">{"@type":"Organization"}</script>
    <script type="application/ld+json">[{"@type":"Recipe","name":"B","recipeIngredient":["x"]}]</script>"#;
    assert_eq!(from_page(html, None).unwrap().name, "B");
}

#[test]
fn iso_durations_become_minutes() {
    assert_eq!(iso_minutes("PT1H15M"), Some(75));
    assert_eq!(iso_minutes("PT45M"), Some(45));
    assert_eq!(iso_minutes("P0DT20M"), Some(20));
    assert_eq!(iso_minutes("P1DT2H"), Some(1560));
    assert_eq!(iso_minutes("PT90S"), Some(2));
    assert_eq!(iso_minutes("pt30m"), Some(30));
    assert_eq!(iso_minutes("PT0M"), None);
    assert_eq!(iso_minutes("P1Y"), None);
    assert_eq!(iso_minutes("45 minutes"), None);
    assert_eq!(iso_minutes(""), None);
}

#[test]
fn image_forms() {
    let base = page();
    let one = |s: &str| image_of(&serde_json::from_str(s).unwrap(), Some(&base));
    assert_eq!(
        one(r#""https://cdn.example.org/a.jpg""#).as_deref(),
        Some("https://cdn.example.org/a.jpg")
    );
    assert_eq!(
        one(r#"["https://cdn.example.org/a.jpg","b.jpg"]"#).as_deref(),
        Some("https://cdn.example.org/a.jpg")
    );
    assert_eq!(
        one(r#"{"@type":"ImageObject","url":"https://cdn.example.org/o.png"}"#).as_deref(),
        Some("https://cdn.example.org/o.png")
    );
    assert_eq!(
        one(r#"[{"url":"x.webp"}]"#).as_deref(),
        Some("https://example.com/recipes/x.webp")
    );
    assert_eq!(one(r#""javascript:alert(1)""#), None);
    assert_eq!(one(r#""data:image/png;base64,AAAA""#), None);
    assert_eq!(one("42"), None);
}

#[test]
fn the_yield_takes_the_first_number() {
    let p = |s: &str| portions_of(&serde_json::from_str(s).unwrap());
    assert_eq!(p(r#""4-6 people""#), Some(4));
    assert_eq!(p(r#"["Serves 8"]"#), Some(8));
    assert_eq!(p(r#""many""#), None);
    assert_eq!(p("0"), None);
}

#[test]
fn entities_and_tags_are_cleaned() {
    assert_eq!(
        clean("  Tom &amp; Jerry&#39;s <i>big</i>\n pie&nbsp;&#x41; "),
        "Tom & Jerry's big pie A"
    );
    assert_eq!(clean("a &unknown; b"), "a &unknown; b");
    assert_eq!(clean("1 < 2 without close"), "1 2 without close");
}

#[test]
fn dutch_text_is_split_by_its_headings() {
    let text = "Pannenkoeken\n\nIngrediënten\n- 250 g bloem\n• 2 eieren\nVoor de saus:\n1/2 l melk\n\nBereiding:\n1. Meng alles.\n2) Bak 3 minuten per kant.\nStap 3: Serveer.";
    let r = from_text(text);
    assert_eq!(r.name, "Pannenkoeken");
    assert_eq!(r.ingredients, ["250 g bloem", "2 eieren", "1/2 l melk"]);
    assert_eq!(
        r.steps,
        ["Meng alles.", "Bak 3 minuten per kant.", "Serveer."]
    );
    assert_eq!(r.source_url, None);
}

#[test]
fn english_text_with_markdown_headings() {
    let text = "## Ingredients\n* 1 cup rice\n* 2 cloves garlic\n\n## Method\n1. Rinse the rice.\n2. Cook it for 10 minutes.";
    let r = from_text(text);
    assert_eq!(r.name, "");
    assert_eq!(r.ingredients, ["1 cup rice", "2 cloves garlic"]);
    assert_eq!(r.steps, ["Rinse the rice.", "Cook it for 10 minutes."]);
    for h in ["Directions", "INSTRUCTIONS:", "Steps", "Werkwijze"] {
        assert_eq!(from_text(&format!("{h}\nDo it.")).steps, ["Do it."], "{h}");
    }
}

#[test]
fn text_without_headings_splits_on_amounts() {
    let r = from_text("200 g flour\n2 eggs\nMix them well.\nBake.");
    assert_eq!(r.ingredients, ["200 g flour", "2 eggs"]);
    assert_eq!(r.steps, ["Mix them well.", "Bake."]);
    assert!(!from_text("   \n \n").usable());
}

#[test]
fn markers_come_off_but_amounts_stay() {
    assert_eq!(strip_marker("1.5 kg potatoes"), "1.5 kg potatoes");
    assert_eq!(strip_marker("12. Serve"), "Serve");
    assert_eq!(strip_marker("- 3 eggs"), "3 eggs");
    assert_eq!(strip_marker("1 2 eggs"), "1 2 eggs");
}
