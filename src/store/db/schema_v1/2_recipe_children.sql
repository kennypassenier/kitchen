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

