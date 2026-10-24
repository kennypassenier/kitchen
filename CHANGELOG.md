# Changelog

All notable changes to kitchen. Semantic versioning: a breaking change
in the API, the configuration knobs or the on-disk state is a major, and
carries a **Migration** section saying what an operator must do.

## [Unreleased]

### Changed
- The kitchen file is format 3, lifted on the first start: dishes have
  fixed ingredients and sides of one or more ingredients instead of parts
  and kinds of part; recipe lines point at one shared list of ingredients.
- A new kitchen starts with only the two dish categories, "Other" for
  ingredients and the dinner time; no sample recipes or dishes.

### Added
- Ingredients and ingredient categories (`/ingredients`), with a page per
  ingredient: its dishes and recipes, filters and a wheel among its dishes.
- Every item has its own page (`/dishes/<id>`, `/freezer/<id>`, …) with
  Edit and Delete; "What I ate" (`/log`) lists the log.
- Cook mode shows the recipe's timeline, as the timing page does.
- A NL/EN toggle in the top bar: every screen in Dutch or English, kept in
  the kitchen's settings; the names follow it.
- Photos on recipes: one or more per step and one for the recipe, added in
  the recipe editor (a phone offers its camera), shown under the step and
  large in cook mode; stored as files next to `kitchen.json`.

### Fixed
- Kitchen's English parents' wheel (`/parents`) loaded its script and
  sheet from `/eten/`, which only the home network may open, so away from
  home it did not draw; only the Dutch page and its data stay home-only.

### Migration
- None by hand: the first start of this version rewrites `kitchen.json`
  to format 3. An older kitchen refuses a format-3 file, so keep the
  backup from before the update if a rollback may be needed.

## [1.0.0] - 2026-10-22

### Added
- First release. Recipes with a wheel that chooses, cook mode with parallel
  tracks, backward timing from the moment dinner should be ready, the
  bad-days freezer and calm settings.
- Dishes page: dishes with a Dutch and an English name, a category and
  parts with choices; kinds and categories are lists of their own.
- The parents' wheel: in Dutch on its own host (`KITCHEN_PARENTS_HOST`)
  without an account, only for the home network (`KITCHEN_PARENTS_ALLOW`,
  default `10.10.10.0/24`); in English at `/parents` behind the login.
- `KITCHEN_TRUSTED_ADMINS`: addresses let in without a login.
- Built on chassis-rs v3.13.0 (kp-themes 11.2.0).

### Security
- rustls-webpki 0.103.16 and webpki-roots 1.0.10.
