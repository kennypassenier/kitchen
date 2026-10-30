use super::*;

#[test]
fn format_1_parts_become_sides_with_the_small_wheel_as_choice() {
    let mut d: Data = serde_json::from_value(serde_json::json!({
        "format": 1,
        "dish_parts": [
            {"id": "k-sauce", "name": {"nl": "Saus", "en": "Sauce"}, "order": 2},
            {"id": "k-starch", "name": {"nl": "Aardappelen", "en": "Potatoes"}, "order": 1, "wheel": true}
        ],
        "dishes": [
            {"id": "d1", "name": {"nl": "Biefstuk", "en": "Steak"}, "parts": [
                {"part": "k-sauce", "choices": [{"nl": "Bearnaise", "en": ""}]},
                {"part": "k-starch", "choices": [{"nl": "Frieten", "en": "Fries"}, {"nl": "Puree", "en": "Mash"}]}
            ]},
            {"id": "d2", "name": {"nl": "Soep", "en": "Soup"}, "parts": []}
        ]
    }))
    .unwrap();
    to_2(&mut d);
    assert_eq!(d.format, 2);
    assert!(d.dish_parts.is_empty());
    assert_eq!(d.dishes.len(), 2);
    assert_eq!(
        d.dishes[0]["sides"],
        serde_json::json!([
            {"name": {"nl": "Frieten", "en": "Fries"}, "choice": true},
            {"name": {"nl": "Puree", "en": "Mash"}, "choice": true},
            {"name": {"nl": "Bearnaise", "en": ""}, "choice": false}
        ])
    );
    assert!(d.dishes[0].get("parts").is_none());
    assert_eq!(d.dishes[1]["sides"], serde_json::json!([]));
    assert!(
        serde_json::to_value(&d)
            .unwrap()
            .get("dish_parts")
            .is_none()
    );
}

#[test]
fn format_4_shelf_and_freezer_text_goes_into_both_halves() {
    let mut d: Data = serde_json::from_value(serde_json::json!({
        "format": 4,
        "shelf": [{"id": "s1", "title": "Toast", "text": "Toast it.", "gear": "toaster", "minutes": 3}],
        "freezer": [{"id": "f1", "dish": "Soup", "portions": 2}]
    }))
    .unwrap();
    migrate(&mut d);
    assert_eq!(d.format, FORMAT);
    assert_eq!(
        d.shelf[0]["title"],
        serde_json::json!({"nl": "Toast", "en": "Toast"})
    );
    assert_eq!(
        d.shelf[0]["gear"],
        serde_json::json!({"nl": "toaster", "en": "toaster"})
    );
    assert_eq!(d.shelf[0]["minutes"], 3);
    assert_eq!(
        d.freezer[0]["dish"],
        serde_json::json!({"nl": "Soup", "en": "Soup"})
    );
}

#[test]
fn format_3_recipes_move_into_their_dishes() {
    let mut d: Data = serde_json::from_value(serde_json::json!({
        "format": 3,
        "recipes": [
            {"id": "r1", "name": "Stoofvlees", "minutes": 150, "steps": [], "created": "x"},
            {"id": "r2", "name": "Pancakes", "minutes": 30},
            {"id": "r3", "name": "Soup", "minutes": 20},
            {"id": "r4", "name": "stoofvlees", "minutes": 90}
        ],
        "dishes": [
            {"id": "d1", "name": {"nl": "Stoofvlees", "en": "Beef stew"}, "recipe_id": null},
            {"id": "d2", "name": {"nl": "Soep", "en": "Tomato soup"}, "recipe_id": "r3"}
        ],
        "log": [{"id": "l1", "recipe_id": "r2", "date": "2026-10-01"}, {"id": "l2", "shelf_id": "s1"}],
        "freezer": [{"id": "f1", "dish": "Stew", "recipe_id": "r1"}],
        "resting": [{"id": "x", "recipe_id": "r3", "until": "2026-10-30"}, {"id": "y", "recipe_id": "gone", "until": "2026-10-30"}]
    }))
    .unwrap();
    migrate(&mut d);
    assert_eq!(d.format, FORMAT);
    assert!(d.recipes.is_empty());
    assert_eq!(d.dishes.len(), 3);
    // Two recipes of one dish by name, the first the default; one by link; one in a new dish.
    let stew = d.dishes[0]["recipes"].as_array().unwrap();
    assert_eq!(stew.len(), 2);
    assert_eq!(
        stew[0],
        serde_json::json!({"id": "r1", "minutes": 150, "steps": [], "label": {"nl": "", "en": ""}, "default": true})
    );
    assert_eq!(stew[1]["default"], false);
    assert_eq!(d.dishes[1]["recipes"][0]["id"], "r3");
    assert!(d.dishes[1].get("recipe_id").is_none());
    assert_eq!(
        d.dishes[2]["name"],
        serde_json::json!({"nl": "", "en": "Pancakes"})
    );
    assert_eq!(d.dishes[2]["recipes"][0]["id"], "r2");
    let pancakes = d.dishes[2]["id"].clone();
    assert_eq!(d.log[0]["dish_id"], pancakes);
    assert_eq!(d.log[0]["recipe_id"], "r2");
    assert!(d.log[1].get("dish_id").is_none());
    assert_eq!(d.freezer[0]["dish_id"], "d1");
    assert!(d.freezer[0].get("recipe_id").is_none());
    assert_eq!(d.resting.len(), 1);
    assert_eq!(d.resting[0]["dish_id"], "d2");
    assert!(serde_json::to_value(&d).unwrap().get("recipes").is_none());
}

#[test]
fn format_2_names_become_one_list_of_ingredients() {
    let mut d: Data = serde_json::from_value(serde_json::json!({
        "format": 2,
        "dishes": [
            {"id": "d1", "name": {"nl": "Biefstuk", "en": "Steak"}, "sides": [
                {"name": {"nl": "Frieten", "en": ""}, "choice": true},
                {"name": {"nl": "Sla", "en": "Salad"}, "choice": false}
            ]}
        ],
        "recipes": [
            {"id": "r1", "name": "Steak", "ingredients": [
                {"id": "i1", "name": "FRIES", "amount": 300, "unit": "g", "group": "Ingredients"},
                {"id": "i2", "name": "salad", "amount": 1, "unit": "pc", "group": "Ingredients"},
                {"id": "i3", "name": "butter", "amount": 20, "unit": "g", "group": "From the cupboard"}
            ]}
        ],
        "dish_categories": [{"id": "c1", "name": {"nl": "Dagelijkse kost", "en": "Everyday"}}]
    }))
    .unwrap();
    // "Frieten" has no English half: "FRIES" from the recipe becomes an ingredient of its own; "salad" is "Sla".
    to_3(&mut d);
    assert_eq!(d.format, 3);
    assert_eq!(d.ingredient_categories.len(), 1);
    let other = d.ingredient_categories[0]["id"].clone();
    let names: Vec<_> = d
        .ingredients
        .iter()
        .map(|i| {
            (
                i["name"]["nl"].as_str().unwrap(),
                i["name"]["en"].as_str().unwrap(),
            )
        })
        .collect();
    assert_eq!(
        names,
        [
            ("Frieten", ""),
            ("Sla", "Salad"),
            ("", "FRIES"),
            ("", "butter")
        ]
    );
    assert!(d.ingredients.iter().all(|i| i["category"] == other));
    let id = |n: usize| d.ingredients[n]["id"].clone();
    assert_eq!(
        d.dishes[0]["sides"],
        serde_json::json!([{"ingredients": [id(0)]}])
    );
    assert_eq!(d.dishes[0]["ingredients"], serde_json::json!([id(1)]));
    let lines = &d.recipes[0]["ingredients"];
    assert_eq!(
        lines[1],
        serde_json::json!({"id": "i2", "ingredient": id(1), "amount": 1, "unit": "pc", "group": "Ingredients"})
    );
    assert_eq!(lines[0]["ingredient"], id(2));
    assert!(lines[2].get("name").is_none());
    assert_eq!(d.dish_categories.len(), 1);
}
