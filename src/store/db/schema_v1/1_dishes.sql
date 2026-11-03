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

