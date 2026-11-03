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

