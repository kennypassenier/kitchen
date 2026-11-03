-- Kitchen's app database, schema version 1 (feat-db-schema-1): one table per list, real columns per field,
-- nested lists as child tables of their item. Mirrors src/store/db/tables.rs column for column (pinned by
-- store::db::tests::schema). Append only: a later change is a new migration, never an edit here.
-- Bookkeeping columns: k_row (row id), k_parent (the owning row of a child table), k_pos (place in its list),
-- k_extra (a JSON object of the keys no column holds, NULL when none), n_<key> (element count of a nested
-- list, NULL when the key is absent).

CREATE TABLE dishes (
    k_row INTEGER PRIMARY KEY,
    k_pos INTEGER NOT NULL,
    k_extra TEXT,
    "name_nl" TEXT,
    "name_en" TEXT,
    "category" TEXT,
    "parents" INTEGER,
    "id" TEXT UNIQUE,
    "created" TEXT,
    "updated" TEXT,
    "rev" INTEGER,
    "n_ingredients" INTEGER,
    "n_sides" INTEGER,
    "n_recipes" INTEGER
) STRICT;
CREATE INDEX dishes_by_pos ON dishes (k_pos);
CREATE INDEX dishes_by_category ON dishes ("category");

CREATE TABLE dish_sides (
    k_row INTEGER PRIMARY KEY,
    k_parent INTEGER NOT NULL REFERENCES dishes(k_row) ON DELETE CASCADE,
    k_pos INTEGER NOT NULL,
    k_extra TEXT,
    "label_nl" TEXT,
    "label_en" TEXT,
    "n_ingredients" INTEGER
) STRICT;
CREATE INDEX dish_sides_by_parent ON dish_sides (k_parent, k_pos);

CREATE TABLE side_ingredients (
    k_row INTEGER PRIMARY KEY,
    k_parent INTEGER NOT NULL REFERENCES dish_sides(k_row) ON DELETE CASCADE,
    k_pos INTEGER NOT NULL,
    "value" TEXT NOT NULL
) STRICT;
CREATE INDEX side_ingredients_by_parent ON side_ingredients (k_parent, k_pos);
CREATE INDEX side_ingredients_by_value ON side_ingredients ("value");

CREATE TABLE dish_ingredients (
    k_row INTEGER PRIMARY KEY,
    k_parent INTEGER NOT NULL REFERENCES dishes(k_row) ON DELETE CASCADE,
    k_pos INTEGER NOT NULL,
    "value" TEXT NOT NULL
) STRICT;
CREATE INDEX dish_ingredients_by_parent ON dish_ingredients (k_parent, k_pos);
CREATE INDEX dish_ingredients_by_value ON dish_ingredients ("value");

CREATE TABLE dish_recipes (
    k_row INTEGER PRIMARY KEY,
    k_parent INTEGER NOT NULL REFERENCES dishes(k_row) ON DELETE CASCADE,
    k_pos INTEGER NOT NULL,
    k_extra TEXT,
    "id" TEXT,
    "label_nl" TEXT,
    "label_en" TEXT,
    "default" INTEGER,
    "short" TEXT,
    "summary" TEXT,
    "minutes" ANY,
    "hands_on" ANY,
    "minutes_override" ANY,
    "hands_on_override" ANY,
    "portions" ANY,
    "prep" TEXT,
    "safe" INTEGER,
    "gear" TEXT,
    "last_note" TEXT,
    "mini_note" TEXT,
    "source" TEXT,
    "photo" TEXT,
    "n_meals" INTEGER,
    "n_ing" INTEGER,
    "n_tools" INTEGER,
    "n_tracks" INTEGER,
    "n_ingredients" INTEGER,
    "n_steps" INTEGER
) STRICT;
CREATE INDEX dish_recipes_by_parent ON dish_recipes (k_parent, k_pos);

CREATE TABLE recipe_meals (
    k_row INTEGER PRIMARY KEY,
    k_parent INTEGER NOT NULL REFERENCES dish_recipes(k_row) ON DELETE CASCADE,
    k_pos INTEGER NOT NULL,
    "value" TEXT NOT NULL
) STRICT;
CREATE INDEX recipe_meals_by_parent ON recipe_meals (k_parent, k_pos);

CREATE TABLE recipe_ing (
    k_row INTEGER PRIMARY KEY,
    k_parent INTEGER NOT NULL REFERENCES dish_recipes(k_row) ON DELETE CASCADE,
    k_pos INTEGER NOT NULL,
    "value" TEXT NOT NULL
) STRICT;
CREATE INDEX recipe_ing_by_parent ON recipe_ing (k_parent, k_pos);

CREATE TABLE recipe_tools (
    k_row INTEGER PRIMARY KEY,
    k_parent INTEGER NOT NULL REFERENCES dish_recipes(k_row) ON DELETE CASCADE,
    k_pos INTEGER NOT NULL,
    k_extra TEXT,
    "id" TEXT,
    "name" TEXT
) STRICT;
CREATE INDEX recipe_tools_by_parent ON recipe_tools (k_parent, k_pos);

CREATE TABLE recipe_tracks (
    k_row INTEGER PRIMARY KEY,
    k_parent INTEGER NOT NULL REFERENCES dish_recipes(k_row) ON DELETE CASCADE,
    k_pos INTEGER NOT NULL,
    k_extra TEXT,
    "id" TEXT,
    "name" TEXT
) STRICT;
CREATE INDEX recipe_tracks_by_parent ON recipe_tracks (k_parent, k_pos);

CREATE TABLE recipe_lines (
    k_row INTEGER PRIMARY KEY,
    k_parent INTEGER NOT NULL REFERENCES dish_recipes(k_row) ON DELETE CASCADE,
    k_pos INTEGER NOT NULL,
    k_extra TEXT,
    "id" TEXT,
    "ingredient" TEXT,
    "amount" ANY,
    "unit" TEXT,
    "group" TEXT,
    "note" TEXT,
    "note_nl" TEXT,
    "note_en" TEXT
) STRICT;
CREATE INDEX recipe_lines_by_parent ON recipe_lines (k_parent, k_pos);
CREATE INDEX recipe_lines_by_ingredient ON recipe_lines ("ingredient");

CREATE TABLE recipe_steps (
    k_row INTEGER PRIMARY KEY,
    k_parent INTEGER NOT NULL REFERENCES dish_recipes(k_row) ON DELETE CASCADE,
    k_pos INTEGER NOT NULL,
    k_extra TEXT,
    "id" TEXT,
    "track" TEXT,
    "text" TEXT,
    "text_nl" TEXT,
    "text_en" TEXT,
    "say" TEXT,
    "mins" ANY,
    "active" INTEGER,
    "note" TEXT,
    "note_nl" TEXT,
    "note_en" TEXT,
    "note_tone" TEXT,
    "mini" INTEGER,
    "start" ANY,
    "with" TEXT,
    "n_timer" INTEGER,
    "n_uses" INTEGER,
    "n_photos" INTEGER
) STRICT;
CREATE INDEX recipe_steps_by_parent ON recipe_steps (k_parent, k_pos);

CREATE TABLE step_timers (
    k_row INTEGER PRIMARY KEY,
    k_parent INTEGER NOT NULL REFERENCES recipe_steps(k_row) ON DELETE CASCADE,
    k_pos INTEGER NOT NULL,
    k_extra TEXT,
    "seconds" ANY,
    "name" TEXT
) STRICT;
CREATE INDEX step_timers_by_parent ON step_timers (k_parent, k_pos);

CREATE TABLE step_uses (
    k_row INTEGER PRIMARY KEY,
    k_parent INTEGER NOT NULL REFERENCES recipe_steps(k_row) ON DELETE CASCADE,
    k_pos INTEGER NOT NULL,
    k_extra TEXT,
    "amount" TEXT,
    "name" TEXT
) STRICT;
CREATE INDEX step_uses_by_parent ON step_uses (k_parent, k_pos);

CREATE TABLE step_photos (
    k_row INTEGER PRIMARY KEY,
    k_parent INTEGER NOT NULL REFERENCES recipe_steps(k_row) ON DELETE CASCADE,
    k_pos INTEGER NOT NULL,
    "value" TEXT NOT NULL
) STRICT;
CREATE INDEX step_photos_by_parent ON step_photos (k_parent, k_pos);

CREATE TABLE dish_categories (
    k_row INTEGER PRIMARY KEY,
    k_pos INTEGER NOT NULL,
    k_extra TEXT,
    "name_nl" TEXT,
    "name_en" TEXT,
    "order" ANY,
    "id" TEXT UNIQUE,
    "created" TEXT,
    "updated" TEXT,
    "rev" INTEGER
) STRICT;
CREATE INDEX dish_categories_by_pos ON dish_categories (k_pos);
CREATE INDEX dish_categories_by_order ON dish_categories ("order");

CREATE TABLE ingredients (
    k_row INTEGER PRIMARY KEY,
    k_pos INTEGER NOT NULL,
    k_extra TEXT,
    "name_nl" TEXT,
    "name_en" TEXT,
    "category" TEXT,
    "id" TEXT UNIQUE,
    "created" TEXT,
    "updated" TEXT,
    "rev" INTEGER
) STRICT;
CREATE INDEX ingredients_by_pos ON ingredients (k_pos);
CREATE INDEX ingredients_by_category ON ingredients ("category");

CREATE TABLE ingredient_categories (
    k_row INTEGER PRIMARY KEY,
    k_pos INTEGER NOT NULL,
    k_extra TEXT,
    "name_nl" TEXT,
    "name_en" TEXT,
    "order" ANY,
    "id" TEXT UNIQUE,
    "created" TEXT,
    "updated" TEXT,
    "rev" INTEGER
) STRICT;
CREATE INDEX ingredient_categories_by_pos ON ingredient_categories (k_pos);
CREATE INDEX ingredient_categories_by_order ON ingredient_categories ("order");

CREATE TABLE freezer (
    k_row INTEGER PRIMARY KEY,
    k_pos INTEGER NOT NULL,
    k_extra TEXT,
    "dish_nl" TEXT,
    "dish_en" TEXT,
    "dish_id" TEXT,
    "portions" ANY,
    "frozen_on" TEXT,
    "id" TEXT UNIQUE,
    "created" TEXT,
    "updated" TEXT,
    "rev" INTEGER
) STRICT;
CREATE INDEX freezer_by_pos ON freezer (k_pos);
CREATE INDEX freezer_by_dish_id ON freezer ("dish_id");

CREATE TABLE shelf (
    k_row INTEGER PRIMARY KEY,
    k_pos INTEGER NOT NULL,
    k_extra TEXT,
    "title_nl" TEXT,
    "title_en" TEXT,
    "text_nl" TEXT,
    "text_en" TEXT,
    "minutes" ANY,
    "gear_nl" TEXT,
    "gear_en" TEXT,
    "energy" TEXT,
    "id" TEXT UNIQUE,
    "created" TEXT,
    "updated" TEXT,
    "rev" INTEGER
) STRICT;
CREATE INDEX shelf_by_pos ON shelf (k_pos);
CREATE INDEX shelf_by_energy ON shelf ("energy");

CREATE TABLE log (
    k_row INTEGER PRIMARY KEY,
    k_pos INTEGER NOT NULL,
    k_extra TEXT,
    "dish_id" TEXT,
    "recipe_id" TEXT,
    "shelf_id" TEXT,
    "date" TEXT,
    "feeling" TEXT,
    "note" TEXT,
    "id" TEXT UNIQUE,
    "created" TEXT,
    "updated" TEXT,
    "rev" INTEGER
) STRICT;
CREATE INDEX log_by_pos ON log (k_pos);
CREATE INDEX log_by_dish_id ON log ("dish_id");
CREATE INDEX log_by_shelf_id ON log ("shelf_id");
CREATE INDEX log_by_date ON log ("date");

CREATE TABLE resting (
    k_row INTEGER PRIMARY KEY,
    k_pos INTEGER NOT NULL,
    k_extra TEXT,
    "dish_id" TEXT,
    "until" TEXT,
    "id" TEXT UNIQUE,
    "created" TEXT,
    "updated" TEXT,
    "rev" INTEGER
) STRICT;
CREATE INDEX resting_by_pos ON resting (k_pos);
CREATE INDEX resting_by_dish_id ON resting ("dish_id");

CREATE TABLE drafts (
    k_row INTEGER PRIMARY KEY,
    k_pos INTEGER NOT NULL,
    k_extra TEXT,
    "key" TEXT,
    "data" TEXT,
    "saved" TEXT,
    "id" TEXT UNIQUE,
    "created" TEXT,
    "updated" TEXT,
    "rev" INTEGER
) STRICT;
CREATE INDEX drafts_by_pos ON drafts (k_pos);
CREATE INDEX drafts_by_key ON drafts ("key");

CREATE TABLE recipe_sources (
    k_row INTEGER PRIMARY KEY,
    k_pos INTEGER NOT NULL,
    k_extra TEXT,
    "name" TEXT,
    "url" TEXT,
    "language" TEXT,
    "note_nl" TEXT,
    "note_en" TEXT,
    "verified" TEXT,
    "verified_by" TEXT,
    "id" TEXT UNIQUE,
    "created" TEXT,
    "updated" TEXT,
    "rev" INTEGER
) STRICT;
CREATE INDEX recipe_sources_by_pos ON recipe_sources (k_pos);

-- The settings' revision (fix-offline-master-5), one row.
CREATE TABLE settings_rev (
    k_row INTEGER PRIMARY KEY CHECK (k_row = 1),
    rev INTEGER NOT NULL
) STRICT;

-- The settings: one row of known keys plus k_extra for any other key.
CREATE TABLE settings (
    k_row INTEGER PRIMARY KEY CHECK (k_row = 1),
    k_pos INTEGER NOT NULL,
    k_extra TEXT,
    "dinner_time" TEXT,
    "lang" TEXT,
    "pace" TEXT,
    "spare" ANY,
    "odds" TEXT,
    "timer_sound" TEXT
) STRICT;

-- The freezer takes' Idempotency-Keys (feat-offline-take-1), oldest first, with the answer the first take got.
CREATE TABLE answered (
    k_pos INTEGER PRIMARY KEY,
    "key" TEXT NOT NULL UNIQUE,
    answer TEXT NOT NULL
) STRICT;
