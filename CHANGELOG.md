# Changelog

All notable changes to kitchen. Semantic versioning: a breaking change
in the API, the configuration knobs or the on-disk state is a major, and
carries a **Migration** section saying what an operator must do.

## [Unreleased]

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
