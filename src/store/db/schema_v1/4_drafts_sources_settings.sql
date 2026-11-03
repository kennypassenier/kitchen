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
