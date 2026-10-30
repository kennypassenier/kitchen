use super::super::pasted::*;

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
